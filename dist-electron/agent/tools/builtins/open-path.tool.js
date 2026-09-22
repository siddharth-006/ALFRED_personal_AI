"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openPathTool = void 0;
const system_service_1 = require("../../../services/system.service");
const logger_1 = require("../../../utils/logger");
/** Shell metacharacters that invalidate raw path inputs to prevent command injection */
const SHELL_METACHARACTERS_REGEX = /[;&|`$()<>{}\n\r]/;
/**
 * open_path tool adapter (Phase 3.3 - Step 1)
 *
 * Safely opens a local file or directory path via SystemService (Electron shell.openPath).
 * Enforces input string validation and metacharacter checks.
 */
exports.openPathTool = {
    name: "open_path",
    description: "Safely open a local folder or file path using system default handler",
    category: "utility",
    validateInput: (input) => {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Input must be an object with a 'path' string property." };
        }
        const { path } = input;
        if (typeof path !== "string" || !path.trim()) {
            return { valid: false, error: "Target path ('path') must be a non-empty string." };
        }
        if (SHELL_METACHARACTERS_REGEX.test(path)) {
            return { valid: false, error: "Path contains invalid or unsafe shell metacharacters." };
        }
        return { valid: true };
    },
    execute: async (input) => {
        const targetPath = input.path.trim();
        logger_1.logger.info(`open_path tool: Opening path '${targetPath}' via SystemService...`);
        try {
            const errorMsg = await system_service_1.systemService.openPath(targetPath);
            if (errorMsg) {
                logger_1.logger.warn(`open_path tool returned warning/error: ${errorMsg}`);
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
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to open path";
            logger_1.logger.error(`open_path tool error: ${message}`);
            return {
                success: false,
                error: message,
            };
        }
    },
};
