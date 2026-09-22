import { spawn, execFile } from "child_process";
import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

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
 * Known Windows installation paths for whitelisted executable keys.
 * Constructed dynamically using system environment variables (%LOCALAPPDATA%, %PROGRAMFILES%, etc.).
 * No user-specific paths or hardcoded machine usernames are used.
 */
function getCandidateExecutablePaths(key: string): string[] {
    const localAppData = process.env.LOCALAPPDATA || "";
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
                path.join(localAppData, "Spotify", "Spotify.exe"),
                path.join(programFiles, "Spotify", "Spotify.exe"),
            ];
        default:
            return [];
    }
}

/**
 * Safe Application Execution Tool for ALFRED (Phase 3.2 - Step 3 Debugged)
 *
 * Strictly executes pre-whitelisted application executables passed from AppResolverTool.
 * Dynamically resolves installation paths on Windows without relying on %PATH%.
 * NEVER accepts unvalidated user prompts or raw shell command strings.
 */
export class AppExecutorTool {
    /**
     * Spawns a whitelisted application executable safely as a detached process.
     *
     * @param executable Whitelisted executable key (e.g. "code", "chrome", "wt")
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
        const resolvedPath = candidatePaths.find((p) => fs.existsSync(p));

        if (resolvedPath) {
            logger.info(`AppExecutorTool: Found verified application binary at '${resolvedPath}'`);
            return this.spawnBinary(resolvedPath, executable);
        }

        // 2. Fallback: Try launching via Windows Shell 'start' command for App Execution Aliases / PATH
        logger.info(
            `AppExecutorTool: Binary not found in standard paths for '${executable}'. Trying Windows Shell start fallback...`
        );
        return this.launchViaWindowsStart(executable);
    }

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

    private launchViaWindowsStart(executableKey: string): Promise<AppExecutionResult> {
        return new Promise((resolve) => {
            // Use execFile with cmd.exe /c start "" "<whitelisted_executable_key>"
            // Note: Only the pre-whitelisted key is passed, NEVER raw user prompt
            execFile("cmd.exe", ["/c", "start", "", executableKey], (error) => {
                if (error) {
                    logger.error(`AppExecutorTool: Windows start failed for '${executableKey}': ${error.message}`);
                    resolve({
                        success: false,
                        executable: executableKey,
                        executed: false,
                        error: `Application '${executableKey}' is not installed or could not be found on this system.`,
                    });
                } else {
                    logger.info(`AppExecutorTool: Successfully launched '${executableKey}' via Windows start.`);
                    resolve({
                        success: true,
                        executable: executableKey,
                        executed: true,
                    });
                }
            });
        });
    }
}

export const appExecutorTool = new AppExecutorTool();
