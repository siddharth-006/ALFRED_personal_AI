"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemStatusTool = void 0;
const system_service_1 = require("../../../services/system.service");
const logger_1 = require("../../../utils/logger");
/**
 * system_status tool adapter (Phase 3.3 - Step 1)
 *
 * Retrieves system vital statistics using existing systemService.
 */
exports.systemStatusTool = {
    name: "system_status",
    description: "Retrieve system status, OS platform, memory, and CPU info via SystemService",
    category: "system",
    execute: () => {
        logger_1.logger.info("system_status tool: Fetching system info via SystemService...");
        try {
            const info = system_service_1.systemService.getSystemInfo();
            return {
                success: true,
                data: {
                    info,
                    status: "ALL SYSTEMS NOMINAL",
                },
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "System status check failed";
            logger_1.logger.error(`system_status tool error: ${message}`);
            return {
                success: false,
                error: message,
            };
        }
    },
};
