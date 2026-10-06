import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";
import { APP_DISPLAY_NAMES } from "./app-resolver.tool";
import { approvedAppsService } from "../services/approved-apps.service";

export interface AppExecutionOptions {
    isMock?: boolean;
    context?: Record<string, unknown>;
    appId?: string;
    arguments?: string[];
    workingDirectory?: string;
}

export interface AppExecutionResult {
    success: boolean;
    executable: string;
    executed: boolean;
    error?: string;
}

/**
 * Safely checks if a file exists on Windows.
 * Handles both standard files and Windows Store App Execution Alias reparse points
 * (which may throw EACCES on statSync but succeed on lstatSync).
 */
function fileExists(filePath: string): boolean {
    if (!filePath || typeof filePath !== "string") return false;
    try {
        if (fs.existsSync(filePath)) return true;
        const stat = fs.lstatSync(filePath);
        return Boolean(stat);
    } catch {
        return false;
    }
}

/**
 * Known Windows installation paths for whitelisted executable keys.
 * Constructed dynamically using system environment variables (%LOCALAPPDATA%, %PROGRAMFILES%, %APPDATA%, etc.).
 * No user-specific paths or hardcoded machine usernames are used.
 */
function getCandidateExecutablePaths(key: string): string[] {
    const localAppData = process.env.LOCALAPPDATA || "";
    const appData = process.env.APPDATA || "";
    const programFiles = process.env.PROGRAMFILES || "";
    const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "";

    switch (key.toLowerCase()) {
        case "code":
            return [
                path.join(localAppData, "Programs", "Microsoft VS Code", "Code.exe"),
                path.join(programFiles, "Microsoft VS Code", "Code.exe"),
                path.join(programFilesX86, "Microsoft VS Code", "Code.exe"),
            ];

        case "chrome":
            return [
                path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
                path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
                path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
            ];

        case "wt":
            return [
                path.join(localAppData, "Microsoft", "WindowsApps", "wt.exe"),
            ];

        case "pbidesktop":
            return [
                path.join(programFiles, "Microsoft Power BI Desktop", "bin", "PBIDesktop.exe"),
                path.join(programFilesX86, "Microsoft Power BI Desktop", "bin", "PBIDesktop.exe"),
            ];

        case "spotify":
            return [
                path.join(appData, "Spotify", "Spotify.exe"),
                path.join(localAppData, "Spotify", "Spotify.exe"),
                path.join(localAppData, "Microsoft", "WindowsApps", "Spotify.exe"),
                path.join(programFiles, "Spotify", "Spotify.exe"),
                path.join(programFilesX86, "Spotify", "Spotify.exe"),
            ];

        case "discord": {
            const paths: string[] = [];
            const discordDir = path.join(localAppData, "Discord");
            if (fileExists(discordDir)) {
                try {
                    const entries = fs.readdirSync(discordDir, { withFileTypes: true });
                    const appDirs = entries
                        .filter((d) => d.isDirectory() && d.name.startsWith("app-"))
                        .map((d) => d.name)
                        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));

                    for (const appDir of appDirs) {
                        paths.push(path.join(discordDir, appDir, "Discord.exe"));
                    }
                } catch {
                    // Ignore directory read failure
                }
            }
            paths.push(path.join(discordDir, "Discord.exe"));
            paths.push(path.join(programFiles, "Discord", "Discord.exe"));
            paths.push(path.join(programFilesX86, "Discord", "Discord.exe"));
            return paths;
        }

        default:
            return [];
    }
}

/**
 * Searches the Windows PATH environment directories safely without invoking any shell.
 * Only searches for exact, verified filenames associated with the whitelisted executable.
 */
function findOnPath(executableKey: string): string | null {
    const filenameMap: Record<string, string[]> = {
        code: ["Code.exe"],
        chrome: ["chrome.exe"],
        wt: ["wt.exe"],
        spotify: ["Spotify.exe"],
        discord: ["Discord.exe"],
        pbidesktop: ["PBIDesktop.exe"],
    };

    const filenames = filenameMap[executableKey.toLowerCase()] || [];
    if (filenames.length === 0) return null;

    const pathEnv = process.env.PATH || "";
    const directories = pathEnv.split(path.delimiter);

    for (const dir of directories) {
        if (!dir || !dir.trim()) continue;
        for (const filename of filenames) {
            try {
                const candidate = path.join(dir.trim(), filename);
                if (fileExists(candidate)) {
                    return candidate;
                }
            } catch {
                // Ignore invalid or inaccessible paths
            }
        }
    }

    return null;
}

/**
 * Safe Application Execution Tool for ALFRED (Phase 5.1 - Native Desktop Application Control)
 *
 * Strictly executes pre-whitelisted application executables passed from AppResolverTool.
 * Dynamically resolves installation paths on Windows without arbitrary execution or shell invocation.
 * NEVER accepts unvalidated user prompts, raw shell strings, or unwhitelisted binaries.
 * NEVER falls back to cmd.exe, PowerShell, or shell execution.
 */
export class AppExecutorTool {
    /**
     * Spawns a whitelisted application executable safely as a detached process.
     *
     * @param executable Whitelisted executable key or path
     * @param options Execution options (supports mock execution, custom arguments, workingDirectory)
     */
    public async execute(
        executable: string,
        options: AppExecutionOptions = {}
    ): Promise<AppExecutionResult> {
        if (options.isMock) {
            logger.info(`[MOCK EXECUTION] Executable '${executable}' would be launched.`);
            return {
                success: true,
                executable,
                executed: true,
            };
        }

        logger.info(`AppExecutorTool: Resolving executable target: '${executable}' (appId: ${options.appId || "none"})`);

        // Check if executable target corresponds to an approved application
        let approvedApp = options.appId ? approvedAppsService.getApprovedAppById(options.appId) : null;
        if (!approvedApp) {
            approvedApp = approvedAppsService.findApprovedApp(executable);
        }

        if (approvedApp && !approvedApp.isBuiltIn) {
            if (fileExists(approvedApp.executablePath)) {
                const effectiveArgs = options.arguments ?? approvedApp.arguments ?? [];
                const effectiveCwd = options.workingDirectory ?? approvedApp.workingDirectory;
                logger.info(
                    `AppExecutorTool: Executing approved application '${approvedApp.name}' [id: ${approvedApp.id}, exe: ${approvedApp.executablePath}, argsCount: ${effectiveArgs.length}]`
                );
                return this.spawnBinary(
                    approvedApp.executablePath,
                    approvedApp.name,
                    effectiveArgs,
                    effectiveCwd
                );
            } else {
                return {
                    success: false,
                    executable,
                    executed: false,
                    error: `Approved application '${approvedApp.name}' executable could not be found at '${approvedApp.executablePath}'.`,
                };
            }
        }

        // Direct executable path check if it's already an absolute path
        if (path.isAbsolute(executable) && fileExists(executable)) {
            const matchedApp = approvedApp || approvedAppsService.findApprovedApp(executable);
            if (matchedApp) {
                const effectiveArgs = options.arguments ?? matchedApp.arguments ?? [];
                const effectiveCwd = options.workingDirectory ?? matchedApp.workingDirectory;
                logger.info(
                    `AppExecutorTool: Found verified approved direct path for '${matchedApp.name}' at '${executable}'`
                );
                return this.spawnBinary(
                    executable,
                    matchedApp.name || path.basename(executable, ".exe"),
                    effectiveArgs,
                    effectiveCwd
                );
            } else if (approvedAppsService.isApplicationApproved(executable)) {
                logger.info(`AppExecutorTool: Found verified approved direct path at '${executable}'`);
                return this.spawnBinary(
                    executable,
                    path.basename(executable, ".exe"),
                    options.arguments || [],
                    options.workingDirectory
                );
            } else {
                return {
                    success: false,
                    executable,
                    executed: false,
                    error: `Application binary at '${executable}' is not approved by ALFRED.`,
                };
            }
        }

        // 1. Check known dynamic Windows installation paths for the whitelisted executable key
        const candidatePaths = getCandidateExecutablePaths(executable);
        const resolvedPath = candidatePaths.find((p) => fileExists(p));

        if (resolvedPath) {
            logger.info(`AppExecutorTool: Found verified application binary at '${resolvedPath}'`);
            return this.spawnBinary(
                resolvedPath,
                executable,
                options.arguments || [],
                options.workingDirectory
            );
        }

        // 2. Safe PATH inspection (no shell execution)
        const pathBinary = findOnPath(executable);
        if (pathBinary) {
            logger.info(`AppExecutorTool: Found verified application binary on PATH at '${pathBinary}'`);
            return this.spawnBinary(
                pathBinary,
                executable,
                options.arguments || [],
                options.workingDirectory
            );
        }

        // 3. Application not installed on this system — return clean error without shell fallback
        const displayName = APP_DISPLAY_NAMES[executable] || executable;
        logger.warn(
            `AppExecutorTool: Binary not found on system for '${executable}'. Returning safe not-found error.`
        );
        return {
            success: false,
            executable,
            executed: false,
            error: `${displayName} could not be found on this system.`,
        };
    }

    /**
     * Spawns verified native binary directly with shell: false.
     * Passes validated arguments and working directory if provided.
     */
    private spawnBinary(
        binaryPath: string,
        originalExecutableKey: string,
        args: string[] = [],
        cwd?: string
    ): Promise<AppExecutionResult> {
        return new Promise((resolve) => {
            try {
                // Secondary security sanitization of arguments
                const safeArgs = args.filter((a) => typeof a === "string" && !/[;&|`$<>\n\r]/.test(a));

                const spawnOptions: import("child_process").SpawnOptions = {
                    detached: true,
                    stdio: "ignore",
                    shell: false,
                };

                if (cwd && typeof cwd === "string" && fileExists(cwd)) {
                    spawnOptions.cwd = cwd;
                }

                logger.info(
                    `AppExecutorTool: Spawning '${binaryPath}' with args [${safeArgs.join(", ")}] and cwd: ${spawnOptions.cwd || "default"}`
                );

                const child = spawn(binaryPath, safeArgs, spawnOptions);

                let errorOccurred = false;

                child.on("error", (err: Error) => {
                    errorOccurred = true;
                    logger.error(`AppExecutorTool: Failed to spawn '${binaryPath}': ${err.message}`);
                    resolve({
                        success: false,
                        executable: originalExecutableKey,
                        executed: false,
                        error: `Application binary found at '${binaryPath}', but failed to start: ${err.message}`,
                    });
                });

                // Unref detached process so parent Electron process isn't blocked
                child.unref();

                // Small tick delay to allow synchronous spawn error event to register if binary missing/corrupt
                setTimeout(() => {
                    if (!errorOccurred) {
                        logger.info(`AppExecutorTool: Successfully launched '${binaryPath}' (PID: ${child.pid})`);
                        resolve({
                            success: true,
                            executable: originalExecutableKey,
                            executed: true,
                        });
                    }
                }, 100);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Spawn error";
                logger.error(`AppExecutorTool: Exception spawning '${binaryPath}': ${message}`);
                resolve({
                    success: false,
                    executable: originalExecutableKey,
                    executed: false,
                    error: message,
                });
            }
        });
    }
}

export const appExecutorTool = new AppExecutorTool();
