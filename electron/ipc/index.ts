import { registerSystemIpcHandlers } from "./handlers/system.ipc";
import { logger } from "../utils/logger";

export function registerAllIpcHandlers(): void {
    logger.info("Registering IPC Handlers...");
    registerSystemIpcHandlers();
    logger.info("IPC Handlers registered successfully.");
}
