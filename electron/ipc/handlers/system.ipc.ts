import { ipcMain } from "electron";
import { IPC_CHANNELS, SystemPingResult } from "../../config/constants";
import { systemService } from "../../services/system.service";
import { workspaceService } from "../../services/workspace.service";
import { execTool } from "../../tools/exec.tool";
import { logger } from "../../utils/logger";

export function registerSystemIpcHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.SYSTEM.PING, (): SystemPingResult => {
        logger.info("IPC system:ping received");
        return { status: "ok", timestamp: Date.now() };
    });

    ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_INFO, () => {
        logger.info("IPC system:get-info received");
        return systemService.getSystemInfo();
    });

    ipcMain.handle(IPC_CHANNELS.SYSTEM.OPEN_URL, async (_event, url: string) => {
        logger.info(`IPC system:open-url received for: ${url}`);
        return await systemService.openExternalUrl(url);
    });

    ipcMain.handle(IPC_CHANNELS.SYSTEM.OPEN_PATH, async (_event, targetPath: string) => {
        logger.info(`IPC system:open-path received for: ${targetPath}`);
        return await systemService.openPath(targetPath);
    });

    ipcMain.handle(
        IPC_CHANNELS.SYSTEM.SHOW_NOTIFICATION,
        (_event, { title, body }: { title: string; body: string }) => {
            logger.info(`IPC system:show-notification received: ${title}`);
            return systemService.sendNotification(title, body);
        }
    );

    ipcMain.handle(
        IPC_CHANNELS.SYSTEM.EXECUTE_COMMAND,
        async (_event, { command, cwd }: { command: string; cwd?: string }) => {
            logger.info(`IPC system:execute-command received: ${command}`);
            return await execTool.runCommand(command, cwd);
        }
    );

    ipcMain.handle(IPC_CHANNELS.WORKSPACE.GET_STATUS, () => {
        logger.info("IPC workspace:get-status received");
        return workspaceService.getWorkspaceStatus();
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACE.LAUNCH, async (_event, workspaceId: string) => {
        logger.info(`IPC workspace:launch received for ID: ${workspaceId}`);
        return await workspaceService.launchWorkspace(workspaceId);
    });
}
