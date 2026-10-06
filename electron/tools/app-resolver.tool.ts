/**
 * Secure Application Command Resolver for ALFRED (Phase 3.1 - Step 1)
 *
 * Maps known human-readable application names to whitelisted executable commands.
 * Strictly prevents arbitrary string execution and command injection vulnerabilities.
 */

export interface AppResolutionSuccess {
    success: true;
    appName: string;
    executable: string;
    appId?: string;
    arguments?: string[];
    workingDirectory?: string;
    isPWA?: boolean;
}

export interface AppResolutionFailure {
    success: false;
    appName: string;
    executable: null;
    error: string;
}

export type AppResolutionResult = AppResolutionSuccess | AppResolutionFailure;

/**
 * Strict whitelist mapping normalized application names (lowercase, trimmed)
 * to exact, safe executable names.
 */
const APP_WHITELIST: Record<string, string> = {
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
export const APP_DISPLAY_NAMES: Record<string, string> = {
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
import { approvedAppsService } from "../services/approved-apps.service";
import { appDiscoveryService } from "../services/app-discovery.service";

/**
 * Regex to validate that executable names contain ONLY safe alphanumeric characters,
 * hyphens, underscores, or valid Windows absolute path format ending with .exe.
 */
const SAFE_EXECUTABLE_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Regex to detect potential shell metacharacters or dangerous control sequences in raw inputs.
 * Strictly blocks command delimiters, subshells, redirections, and pipes.
 * Allows safe display characters such as spaces, parentheses (e.g. "haveloc (1)"), hyphens, and plus signs.
 */
const SHELL_METACHARACTERS_REGEX = /[;&|`$<>{}\n\r]/;

export class AppResolverTool {
    /**
     * Resolves a human-readable application name to a safe executable command or approved path.
     *
     * @param rawAppName Human-readable application name (e.g. "VS Code", "Chrome", "Notepad")
     * @returns AppResolutionResult containing executable name/path or failure explanation
     */
    public resolveApplication(rawAppName: string): AppResolutionResult {
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

        // Normalize input for lookup
        const normalized = trimmedInput.toLowerCase().replace(/\s+/g, " ");

        // Step 1: Built-in application whitelist lookup
        const builtInExecutable = APP_WHITELIST[normalized];
        if (builtInExecutable && SAFE_EXECUTABLE_REGEX.test(builtInExecutable)) {
            return {
                success: true,
                appName: trimmedInput,
                executable: builtInExecutable,
            };
        }

        // Step 2: Check Approved Application Registry
        const approvedApp = approvedAppsService.findApprovedApp(trimmedInput);
        if (approvedApp) {
            return {
                success: true,
                appName: approvedApp.name,
                executable: approvedApp.executablePath,
                appId: approvedApp.id,
                arguments: approvedApp.arguments,
                workingDirectory: approvedApp.workingDirectory,
                isPWA: approvedApp.isPWA,
            };
        }

        // Step 3: Check if application was discovered on Windows but not yet approved by user
        const cachedDiscovered = appDiscoveryService.getCachedDiscovered();
        const discoveredMatch = cachedDiscovered.find(
            (d) =>
                d.name.toLowerCase() === normalized ||
                d.id.toLowerCase() === normalized ||
                (d.aliases && d.aliases.some((a) => a.toLowerCase() === normalized))
        );

        if (discoveredMatch) {
            return {
                success: false,
                appName: trimmedInput,
                executable: null,
                error: `${discoveredMatch.name} is installed on Windows but has not been approved for ALFRED. Approve it in Application Settings first.`,
            };
        }

        // Step 4: Unknown application
        return {
            success: false,
            appName: trimmedInput,
            executable: null,
            error: `I couldn't find an approved application named '${trimmedInput}'.`,
        };
    }
}

export const appResolverTool = new AppResolverTool();
