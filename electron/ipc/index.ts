import { registerSystemIpcHandlers } from "./handlers/system.ipc";
import { registerAIProviderIpcHandlers } from "./handlers/ai-provider.ipc";
import { registerVoiceIpcHandlers } from "./handlers/voice.ipc";
import { registerTtsIpcHandlers } from "./handlers/tts.ipc";
import { registerProactiveIpcHandlers } from "./handlers/proactive.ipc";
import { registerMemoryIpcHandlers } from "./handlers/memory.ipc";
import { logger } from "../utils/logger";

export function registerAllIpcHandlers(): void {
    logger.info("Registering IPC Handlers...");
    registerSystemIpcHandlers();
    registerAIProviderIpcHandlers();
    registerVoiceIpcHandlers();
    registerTtsIpcHandlers();
    registerProactiveIpcHandlers();
    registerMemoryIpcHandlers();
    logger.info("IPC Handlers registered successfully.");
}
