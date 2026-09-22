"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openUrlTool = void 0;
const system_service_1 = require("../../../services/system.service");
const logger_1 = require("../../../utils/logger");
/**
 * open_url tool adapter (Phase 3.3 - Step 1)
 *
 * Safely opens an external URL using SystemService.
 * Enforces protocol safety (http:// or https:// only). Rejects file://, javascript:, data:, or shell execution URLs.
 */
exports.openUrlTool = {
    name: "open_url",
    description: "Safely open an external web URL (HTTP/HTTPS only) in default system browser",
    category: "utility",
    validateInput: (input) => {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Input must be an object with a 'url' string property." };
        }
        const { url } = input;
        if (typeof url !== "string" || !url.trim()) {
            return { valid: false, error: "URL ('url') must be a non-empty string." };
        }
        const trimmed = url.trim().toLowerCase();
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            return { valid: false, error: "Invalid protocol. Only 'http://' and 'https://' URLs are permitted." };
        }
        // Reject whitespace or control characters
        if (/\s/.test(trimmed)) {
            return { valid: false, error: "URL cannot contain spaces or whitespace characters." };
        }
        return { valid: true };
    },
    execute: async (input) => {
        logger_1.logger.info(`open_url tool: Opening URL '${input.url}' via SystemService...`);
        try {
            const opened = await system_service_1.systemService.openExternalUrl(input.url.trim());
            return {
                success: true,
                data: {
                    url: input.url.trim(),
                    opened,
                },
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to open URL";
            logger_1.logger.error(`open_url tool error: ${message}`);
            return {
                success: false,
                error: message,
            };
        }
    },
};
