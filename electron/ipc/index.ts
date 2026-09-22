import { registerSystemIpcHandlers } from "./handlers/system.ipc";
import { registerAIProviderIpcHandlers } from "./handlers/ai-provider.ipc";
import { logger } from "../utils/logger";

export function registerAllIpcHandlers(): void {
    logger.info("Registering IPC Handlers...");
    registerSystemIpcHandlers();
    registerAIProviderIpcHandlers();
    logger.info("IPC Handlers registered successfully.");
}
