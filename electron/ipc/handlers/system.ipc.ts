import { ipcMain } from "electron";
import { IPC_CHANNELS, SystemPingResult } from "../../config/constants";
import { systemService } from "../../services/system.service";
import { workspaceService } from "../../services/workspace.service";
import { taskService, Task } from "../../services/task.service";
import { goalService, Goal } from "../../services/goal.service";
import { projectService, Project } from "../../services/project.service";
import { conversationContextService } from "../../services/conversation-context.service";
import { commandAgentService } from "../../agent/command-agent.service";
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

    ipcMain.handle(IPC_CHANNELS.WORKSPACE.LAUNCH, async (_event, payload: any) => {
        logger.info(`IPC workspace:launch received`);
        return await workspaceService.launchWorkspace(payload);
    });

    ipcMain.handle(IPC_CHANNELS.COMMAND_AGENT.EXECUTE, async (_event, prompt: string, options?: any) => {
        logger.info(`IPC command-agent:execute received prompt: "${prompt}"`);
        // If context was not explicitly supplied, attach current tasks context from taskService
        const effectiveOptions = options || {};
        if (!effectiveOptions.context) {
            effectiveOptions.context = {
                tasks: taskService.getTasks(),
                goals: goalService.getGoals(),
                projects: projectService.getProjects(),
                recentConversation: conversationContextService.getRecentTurns(),
            };
        } else if (!effectiveOptions.context.recentConversation) {
            effectiveOptions.context.recentConversation = conversationContextService.getRecentTurns();
        }
        return await commandAgentService.executeCommand(prompt, effectiveOptions);
    });

    ipcMain.handle(IPC_CHANNELS.COMMAND_AGENT.CONFIRM, async (_event, confirmationId: string) => {
        logger.info(`IPC command-agent:confirm received for ID: ${confirmationId}`);
        return await commandAgentService.confirmAction(confirmationId);
    });

    ipcMain.handle(IPC_CHANNELS.COMMAND_AGENT.CANCEL, async (_event, confirmationId: string) => {
        logger.info(`IPC command-agent:cancel received for ID: ${confirmationId}`);
        return await commandAgentService.cancelAction(confirmationId);
    });

    ipcMain.handle(IPC_CHANNELS.TASKS.GET, () => {
        return taskService.getTasks();
    });

    ipcMain.handle(IPC_CHANNELS.TASKS.SYNC, (_event, tasks: Task[]) => {
        taskService.syncTasks(tasks);
        return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.GOALS.GET, () => {
        return goalService.getGoals();
    });

    ipcMain.handle(IPC_CHANNELS.GOALS.SYNC, (_event, goals: Goal[]) => {
        goalService.syncGoals(goals);
        return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.PROJECTS.GET, () => {
        return projectService.getProjects();
    });

    ipcMain.handle(IPC_CHANNELS.PROJECTS.SYNC, (_event, projects: Project[]) => {
        projectService.syncProjects(projects);
        return { success: true };
    });
}
