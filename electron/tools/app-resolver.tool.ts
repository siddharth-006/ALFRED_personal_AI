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
    "vs code": "code",
    "vscode": "code",
    "visual studio code": "code",
    "chrome": "chrome",
    "google chrome": "chrome",
    "spotify": "spotify",
    "windows terminal": "wt",
    "terminal": "wt",
    "wt": "wt",
    "power bi": "PBIDesktop",
    "powerbi": "PBIDesktop",
    "power bi desktop": "PBIDesktop",
};

/**
 * Regex to validate that executable names contain ONLY safe alphanumeric characters,
 * hyphens, or underscores. No shell metacharacters, spaces, or paths allowed.
 */
const SAFE_EXECUTABLE_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Regex to detect potential shell metacharacters or dangerous control sequences in raw inputs.
 */
const SHELL_METACHARACTERS_REGEX = /[;&|`$()<>{}\\\n\r]/;

export class AppResolverTool {
    /**
     * Resolves a human-readable application name to a safe executable command.
     *
     * @param rawAppName Human-readable application name (e.g. "VS Code", "Chrome")
     * @returns AppResolutionResult containing executable name or failure explanation
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

export const appResolverTool = new AppResolverTool();
