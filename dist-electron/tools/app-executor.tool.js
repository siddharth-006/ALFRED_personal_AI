"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.appExecutorTool = exports.AppExecutorTool = void 0;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
/**
 * Known Windows installation paths for whitelisted executable keys.
 * Constructed dynamically using system environment variables (%LOCALAPPDATA%, %PROGRAMFILES%, etc.).
 * No user-specific paths or hardcoded machine usernames are used.
 */
function getCandidateExecutablePaths(key) {
    const localAppData = process.env.LOCALAPPDATA || "";
    const programFiles = process.env.PROGRAMFILES || "";
    const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "";
    switch (key.toLowerCase()) {
        case "code":
            return [
                path_1.default.join(localAppData, "Programs", "Microsoft VS Code", "Code.exe"),
                path_1.default.join(programFiles, "Microsoft VS Code", "Code.exe"),
                path_1.default.join(programFilesX86, "Microsoft VS Code", "Code.exe"),
            ];
        case "chrome":
            return [
                path_1.default.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
                path_1.default.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
                path_1.default.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
            ];
        case "wt":
            return [
                path_1.default.join(localAppData, "Microsoft", "WindowsApps", "wt.exe"),
            ];
        case "pbidesktop":
            return [
                path_1.default.join(programFiles, "Microsoft Power BI Desktop", "bin", "PBIDesktop.exe"),
                path_1.default.join(programFilesX86, "Microsoft Power BI Desktop", "bin", "PBIDesktop.exe"),
            ];
        case "spotify":
            return [
                path_1.default.join(localAppData, "Spotify", "Spotify.exe"),
                path_1.default.join(programFiles, "Spotify", "Spotify.exe"),
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
class AppExecutorTool {
    /**
     * Spawns a whitelisted application executable safely as a detached process.
     *
     * @param executable Whitelisted executable key (e.g. "code", "chrome", "wt")
     * @param options Execution options (supports mock execution for unit tests)
     */
    async execute(executable, options = {}) {
        if (options.isMock) {
            logger_1.logger.info(`[MOCK EXECUTION] Executable '${executable}' would be launched.`);
            return {
                success: true,
                executable,
                executed: true,
            };
        }
        logger_1.logger.info(`AppExecutorTool: Resolving executable target: '${executable}'`);
        // 1. Check known dynamic Windows installation paths for the whitelisted executable key
        const candidatePaths = getCandidateExecutablePaths(executable);
        const resolvedPath = candidatePaths.find((p) => fs_1.default.existsSync(p));
        if (resolvedPath) {
            logger_1.logger.info(`AppExecutorTool: Found verified application binary at '${resolvedPath}'`);
            return this.spawnBinary(resolvedPath, executable);
        }
        // 2. Fallback: Try launching via Windows Shell 'start' command for App Execution Aliases / PATH
        logger_1.logger.info(`AppExecutorTool: Binary not found in standard paths for '${executable}'. Trying Windows Shell start fallback...`);
        return this.launchViaWindowsStart(executable);
    }
    spawnBinary(binaryPath, originalExecutableKey) {
        return new Promise((resolve) => {
            try {
                const child = (0, child_process_1.spawn)(binaryPath, [], {
                    detached: true,
                    stdio: "ignore",
                    shell: false,
                });
                let errorOccurred = false;
                child.on("error", (err) => {
                    errorOccurred = true;
                    logger_1.logger.error(`AppExecutorTool: Failed to spawn '${binaryPath}': ${err.message}`);
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
                        logger_1.logger.info(`AppExecutorTool: Successfully launched '${binaryPath}' (PID: ${child.pid})`);
                        resolve({
                            success: true,
                            executable: originalExecutableKey,
                            executed: true,
                        });
                    }
                }, 100);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : "Spawn error";
                logger_1.logger.error(`AppExecutorTool: Exception spawning '${binaryPath}': ${message}`);
                resolve({
                    success: false,
                    executable: originalExecutableKey,
                    executed: false,
                    error: message,
                });
            }
        });
    }
    launchViaWindowsStart(executableKey) {
        return new Promise((resolve) => {
            // Use execFile with cmd.exe /c start "" "<whitelisted_executable_key>"
            // Note: Only the pre-whitelisted key is passed, NEVER raw user prompt
            (0, child_process_1.execFile)("cmd.exe", ["/c", "start", "", executableKey], (error) => {
                if (error) {
                    logger_1.logger.error(`AppExecutorTool: Windows start failed for '${executableKey}': ${error.message}`);
                    resolve({
                        success: false,
                        executable: executableKey,
                        executed: false,
                        error: `Application '${executableKey}' is not installed or could not be found on this system.`,
                    });
                }
                else {
                    logger_1.logger.info(`AppExecutorTool: Successfully launched '${executableKey}' via Windows start.`);
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
exports.AppExecutorTool = AppExecutorTool;
exports.appExecutorTool = new AppExecutorTool();
