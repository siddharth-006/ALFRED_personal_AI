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
const app_resolver_tool_1 = require("./app-resolver.tool");
/**
 * Safely checks if a file exists on Windows.
 * Handles both standard files and Windows Store App Execution Alias reparse points
 * (which may throw EACCES on statSync but succeed on lstatSync).
 */
function fileExists(filePath) {
    if (!filePath || typeof filePath !== "string")
        return false;
    try {
        if (fs_1.default.existsSync(filePath))
            return true;
        const stat = fs_1.default.lstatSync(filePath);
        return Boolean(stat);
    }
    catch {
        return false;
    }
}
/**
 * Known Windows installation paths for whitelisted executable keys.
 * Constructed dynamically using system environment variables (%LOCALAPPDATA%, %PROGRAMFILES%, %APPDATA%, etc.).
 * No user-specific paths or hardcoded machine usernames are used.
 */
function getCandidateExecutablePaths(key) {
    const localAppData = process.env.LOCALAPPDATA || "";
    const appData = process.env.APPDATA || "";
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
                path_1.default.join(appData, "Spotify", "Spotify.exe"),
                path_1.default.join(localAppData, "Spotify", "Spotify.exe"),
                path_1.default.join(localAppData, "Microsoft", "WindowsApps", "Spotify.exe"),
                path_1.default.join(programFiles, "Spotify", "Spotify.exe"),
                path_1.default.join(programFilesX86, "Spotify", "Spotify.exe"),
            ];
        case "discord": {
            const paths = [];
            const discordDir = path_1.default.join(localAppData, "Discord");
            if (fileExists(discordDir)) {
                try {
                    const entries = fs_1.default.readdirSync(discordDir, { withFileTypes: true });
                    const appDirs = entries
                        .filter((d) => d.isDirectory() && d.name.startsWith("app-"))
                        .map((d) => d.name)
                        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));
                    for (const appDir of appDirs) {
                        paths.push(path_1.default.join(discordDir, appDir, "Discord.exe"));
                    }
                }
                catch {
                    // Ignore directory read failure
                }
            }
            paths.push(path_1.default.join(discordDir, "Discord.exe"));
            paths.push(path_1.default.join(programFiles, "Discord", "Discord.exe"));
            paths.push(path_1.default.join(programFilesX86, "Discord", "Discord.exe"));
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
function findOnPath(executableKey) {
    const filenameMap = {
        code: ["Code.exe"],
        chrome: ["chrome.exe"],
        wt: ["wt.exe"],
        spotify: ["Spotify.exe"],
        discord: ["Discord.exe"],
        pbidesktop: ["PBIDesktop.exe"],
    };
    const filenames = filenameMap[executableKey.toLowerCase()] || [];
    if (filenames.length === 0)
        return null;
    const pathEnv = process.env.PATH || "";
    const directories = pathEnv.split(path_1.default.delimiter);
    for (const dir of directories) {
        if (!dir || !dir.trim())
            continue;
        for (const filename of filenames) {
            try {
                const candidate = path_1.default.join(dir.trim(), filename);
                if (fileExists(candidate)) {
                    return candidate;
                }
            }
            catch {
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
class AppExecutorTool {
    /**
     * Spawns a whitelisted application executable safely as a detached process.
     *
     * @param executable Whitelisted executable key (e.g. "code", "chrome", "wt", "discord", "spotify")
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
        const resolvedPath = candidatePaths.find((p) => fileExists(p));
        if (resolvedPath) {
            logger_1.logger.info(`AppExecutorTool: Found verified application binary at '${resolvedPath}'`);
            return this.spawnBinary(resolvedPath, executable);
        }
        // 2. Safe PATH inspection (no shell execution)
        const pathBinary = findOnPath(executable);
        if (pathBinary) {
            logger_1.logger.info(`AppExecutorTool: Found verified application binary on PATH at '${pathBinary}'`);
            return this.spawnBinary(pathBinary, executable);
        }
        // 3. Application not installed on this system — return clean error without shell fallback
        const displayName = app_resolver_tool_1.APP_DISPLAY_NAMES[executable] || executable;
        logger_1.logger.warn(`AppExecutorTool: Binary not found on system for '${executable}'. Returning safe not-found error.`);
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
}
exports.AppExecutorTool = AppExecutorTool;
exports.appExecutorTool = new AppExecutorTool();
