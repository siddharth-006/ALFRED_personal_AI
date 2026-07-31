"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSystemIpcHandlers = registerSystemIpcHandlers;
const electron_1 = require("electron");
const constants_1 = require("../../config/constants");
const system_service_1 = require("../../services/system.service");
const workspace_service_1 = require("../../services/workspace.service");
const exec_tool_1 = require("../../tools/exec.tool");
const logger_1 = require("../../utils/logger");
function registerSystemIpcHandlers() {
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SYSTEM.PING, () => {
        logger_1.logger.info("IPC system:ping received");
        return { status: "ok", timestamp: Date.now() };
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SYSTEM.GET_INFO, () => {
        logger_1.logger.info("IPC system:get-info received");
        return system_service_1.systemService.getSystemInfo();
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SYSTEM.OPEN_URL, async (_event, url) => {
        logger_1.logger.info(`IPC system:open-url received for: ${url}`);
        return await system_service_1.systemService.openExternalUrl(url);
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SYSTEM.OPEN_PATH, async (_event, targetPath) => {
        logger_1.logger.info(`IPC system:open-path received for: ${targetPath}`);
        return await system_service_1.systemService.openPath(targetPath);
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SYSTEM.SHOW_NOTIFICATION, (_event, { title, body }) => {
        logger_1.logger.info(`IPC system:show-notification received: ${title}`);
        return system_service_1.systemService.sendNotification(title, body);
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.SYSTEM.EXECUTE_COMMAND, async (_event, { command, cwd }) => {
        logger_1.logger.info(`IPC system:execute-command received: ${command}`);
        return await exec_tool_1.execTool.runCommand(command, cwd);
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.WORKSPACE.GET_STATUS, () => {
        logger_1.logger.info("IPC workspace:get-status received");
        return workspace_service_1.workspaceService.getWorkspaceStatus();
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.WORKSPACE.LAUNCH, async (_event, workspaceId) => {
        logger_1.logger.info(`IPC workspace:launch received for ID: ${workspaceId}`);
        return await workspace_service_1.workspaceService.launchWorkspace(workspaceId);
    });
}
