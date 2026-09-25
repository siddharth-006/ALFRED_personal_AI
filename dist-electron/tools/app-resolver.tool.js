"use strict";
/**
 * Secure Application Command Resolver for ALFRED (Phase 3.1 - Step 1)
 *
 * Maps known human-readable application names to whitelisted executable commands.
 * Strictly prevents arbitrary string execution and command injection vulnerabilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.appResolverTool = exports.AppResolverTool = exports.APP_DISPLAY_NAMES = void 0;
/**
 * Strict whitelist mapping normalized application names (lowercase, trimmed)
 * to exact, safe executable names.
 */
const APP_WHITELIST = {
    // Visual Studio Code
    "vs code": "code",
    "vscode": "code",
    "visual studio code": "code",
    "vs_code": "code",
    "vs-code": "code",
    "code": "code",
    // Google Chrome
    "chrome": "chrome",
    "google chrome": "chrome",
    "googlechrome": "chrome",
    "google-chrome": "chrome",
    "google_chrome": "chrome",
    // Spotify
    "spotify": "spotify",
    // Discord
    "discord": "discord",
    // Windows Terminal
    "windows terminal": "wt",
    "terminal": "wt",
    "wt": "wt",
    "windowsterminal": "wt",
    "windows-terminal": "wt",
    "windows_terminal": "wt",
    // Power BI Desktop
    "power bi": "PBIDesktop",
    "powerbi": "PBIDesktop",
    "power bi desktop": "PBIDesktop",
    "pbidesktop": "PBIDesktop",
};
/**
 * Human-readable display names for whitelisted executable keys.
 */
exports.APP_DISPLAY_NAMES = {
    code: "Visual Studio Code",
    chrome: "Google Chrome",
    spotify: "Spotify",
    discord: "Discord",
    wt: "Windows Terminal",
    PBIDesktop: "Power BI Desktop",
};
/**
 * Regex to validate that executable names contain ONLY safe alphanumeric characters,
 * hyphens, or underscores. No shell metacharacters, spaces, or paths allowed.
 */
const SAFE_EXECUTABLE_REGEX = /^[a-zA-Z0-9_-]+$/;
/**
 * Regex to detect potential shell metacharacters or dangerous control sequences in raw inputs.
 * Strictly blocks path separators (/ and \), command delimiters, subshells, redirections, and pipes.
 */
const SHELL_METACHARACTERS_REGEX = /[;&|`$()<>{}\\/\n\r]/;
class AppResolverTool {
    /**
     * Resolves a human-readable application name to a safe executable command.
     *
     * @param rawAppName Human-readable application name (e.g. "VS Code", "Chrome")
     * @returns AppResolutionResult containing executable name or failure explanation
     */
    resolveApplication(rawAppName) {
        if (typeof rawAppName !== "string" || !rawAppName.trim()) {
            return {
                success: false,
                appName: String(rawAppName),
                executable: null,
                error: "Invalid application name provided.",
            };
        }
        const trimmedInput = rawAppName.trim();
        // Security check 1: Reject any input containing explicit shell metacharacters
        if (SHELL_METACHARACTERS_REGEX.test(trimmedInput)) {
            return {
                success: false,
                appName: trimmedInput,
                executable: null,
                error: "Application name contains invalid or unsafe characters.",
            };
        }
        // Normalize input for strict lookup (lowercase, collapse multiple spaces)
        const normalized = trimmedInput.toLowerCase().replace(/\s+/g, " ");
        // Security check 2: Strict whitelist lookup (no dynamic evaluation or fuzzy matching)
        const resolvedExecutable = APP_WHITELIST[normalized];
        if (!resolvedExecutable) {
            return {
                success: false,
                appName: trimmedInput,
                executable: null,
                error: "Unsupported application.",
            };
        }
        // Security check 3: Verify the resolved executable strictly matches safe format
        if (!SAFE_EXECUTABLE_REGEX.test(resolvedExecutable)) {
            return {
                success: false,
                appName: trimmedInput,
                executable: null,
                error: "Resolved executable failed security validation.",
            };
        }
        return {
            success: true,
            appName: trimmedInput,
            executable: resolvedExecutable,
        };
    }
}
exports.AppResolverTool = AppResolverTool;
exports.appResolverTool = new AppResolverTool();
