import { ToolDefinition, ToolResult } from "../types";
import { systemService, SystemInfo } from "../../../services/system.service";
import { logger } from "../../../utils/logger";

export interface SystemStatusOutput {
    info: SystemInfo;
    status: string;
}

/**
 * system_status tool adapter (Phase 3.3 - Step 1)
 *
 * Retrieves system vital statistics using existing systemService.
 */
export const systemStatusTool: ToolDefinition<void, SystemStatusOutput> = {
    name: "system_status",
    description: "Retrieve system status, OS platform, memory, and CPU info via SystemService",
    category: "system",
    execute: (): ToolResult<SystemStatusOutput> => {
        logger.info("system_status tool: Fetching system info via SystemService...");
        try {
            const info = systemService.getSystemInfo();
            return {
                success: true,
                data: {
                    info,
                    status: "ALL SYSTEMS NOMINAL",
                },
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "System status check failed";
            logger.error(`system_status tool error: ${message}`);
            return {
                success: false,
                error: message,
            };
        }
    },
};
