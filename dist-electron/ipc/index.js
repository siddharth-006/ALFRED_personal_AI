"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllIpcHandlers = registerAllIpcHandlers;
const system_ipc_1 = require("./handlers/system.ipc");
const ai_provider_ipc_1 = require("./handlers/ai-provider.ipc");
const logger_1 = require("../utils/logger");
function registerAllIpcHandlers() {
    logger_1.logger.info("Registering IPC Handlers...");
    (0, system_ipc_1.registerSystemIpcHandlers)();
    (0, ai_provider_ipc_1.registerAIProviderIpcHandlers)();
    logger_1.logger.info("IPC Handlers registered successfully.");
}
