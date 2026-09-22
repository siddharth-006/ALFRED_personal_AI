import { ToolDefinition, ToolResult } from "../types";
import { systemService } from "../../../services/system.service";
import { logger } from "../../../utils/logger";

export interface OpenPathInput {
    path: string;
}

export interface OpenPathOutput {
    path: string;
    opened: boolean;
}

/** Shell metacharacters that invalidate raw path inputs to prevent command injection */
const SHELL_METACHARACTERS_REGEX = /[;&|`$()<>{}\n\r]/;

/**
 * open_path tool adapter (Phase 3.3 - Step 1)
 *
 * Safely opens a local file or directory path via SystemService (Electron shell.openPath).
 * Enforces input string validation and metacharacter checks.
 */
export const openPathTool: ToolDefinition<OpenPathInput, OpenPathOutput> = {
    name: "open_path",
    description: "Safely open a local folder or file path using system default handler",
    category: "utility",
    validateInput: (input: unknown) => {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Input must be an object with a 'path' string property." };
        }
        const { path } = input as Record<string, unknown>;
        if (typeof path !== "string" || !path.trim()) {
            return { valid: false, error: "Target path ('path') must be a non-empty string." };
        }
        if (SHELL_METACHARACTERS_REGEX.test(path)) {
            return { valid: false, error: "Path contains invalid or unsafe shell metacharacters." };
        }
        return { valid: true };
    },
    execute: async (input: OpenPathInput): Promise<ToolResult<OpenPathOutput>> => {
        const targetPath = input.path.trim();
        logger.info(`open_path tool: Opening path '${targetPath}' via SystemService...`);
        try {
            const errorMsg = await systemService.openPath(targetPath);
            if (errorMsg) {
                logger.warn(`open_path tool returned warning/error: ${errorMsg}`);
                return {
                    success: false,
                    error: errorMsg,
                };
            }
            return {
                success: true,
                data: {
                    path: targetPath,
                    opened: true,
                },
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to open path";
            logger.error(`open_path tool error: ${message}`);
            return {
                success: false,
                error: message,
            };
        }
    },
};
