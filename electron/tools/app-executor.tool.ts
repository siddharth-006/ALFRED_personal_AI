import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";
import { APP_DISPLAY_NAMES } from "./app-resolver.tool";

export interface AppExecutionOptions {
    isMock?: boolean;
    context?: Record<string, unknown>;
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
     * @param executable Whitelisted executable key (e.g. "code", "chrome", "wt", "discord", "spotify")
     * @param options Execution options (supports mock execution for unit tests)
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

        logger.info(`AppExecutorTool: Resolving executable target: '${executable}'`);

        // 1. Check known dynamic Windows installation paths for the whitelisted executable key
        const candidatePaths = getCandidateExecutablePaths(executable);
        const resolvedPath = candidatePaths.find((p) => fileExists(p));

        if (resolvedPath) {
            logger.info(`AppExecutorTool: Found verified application binary at '${resolvedPath}'`);
            return this.spawnBinary(resolvedPath, executable);
        }

        // 2. Safe PATH inspection (no shell execution)
        const pathBinary = findOnPath(executable);
        if (pathBinary) {
            logger.info(`AppExecutorTool: Found verified application binary on PATH at '${pathBinary}'`);
            return this.spawnBinary(pathBinary, executable);
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
     */
    private spawnBinary(binaryPath: string, originalExecutableKey: string): Promise<AppExecutionResult> {
        return new Promise((resolve) => {
            try {
                const child = spawn(binaryPath, [], {
                    detached: true,
                    stdio: "ignore",
                    shell: false,
                });

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
