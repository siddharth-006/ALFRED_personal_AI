"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSystemIpcHandlers = registerSystemIpcHandlers;
const electron_1 = require("electron");
const constants_1 = require("../../config/constants");
const system_service_1 = require("../../services/system.service");
const workspace_service_1 = require("../../services/workspace.service");
const task_service_1 = require("../../services/task.service");
const goal_service_1 = require("../../services/goal.service");
const project_service_1 = require("../../services/project.service");
const conversation_context_service_1 = require("../../services/conversation-context.service");
const command_agent_service_1 = require("../../agent/command-agent.service");
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
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.WORKSPACE.LAUNCH, async (_event, payload) => {
        logger_1.logger.info(`IPC workspace:launch received`);
        return await workspace_service_1.workspaceService.launchWorkspace(payload);
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.COMMAND_AGENT.EXECUTE, async (_event, prompt, options) => {
        logger_1.logger.info(`IPC command-agent:execute received prompt: "${prompt}"`);
        // If context was not explicitly supplied, attach current tasks context from taskService
        const effectiveOptions = options || {};
        if (!effectiveOptions.context) {
            effectiveOptions.context = {
                tasks: task_service_1.taskService.getTasks(),
                goals: goal_service_1.goalService.getGoals(),
                projects: project_service_1.projectService.getProjects(),
                workspaces: workspace_service_1.workspaceService.getWorkspaces(),
                recentConversation: conversation_context_service_1.conversationContextService.getRecentTurns(),
            };
        }
        else {
            if (!effectiveOptions.context.recentConversation) {
                effectiveOptions.context.recentConversation = conversation_context_service_1.conversationContextService.getRecentTurns();
            }
            if (!effectiveOptions.context.workspaces) {
                effectiveOptions.context.workspaces = workspace_service_1.workspaceService.getWorkspaces();
            }
        }
        return await command_agent_service_1.commandAgentService.executeCommand(prompt, effectiveOptions);
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.COMMAND_AGENT.CONFIRM, async (_event, confirmationId) => {
        logger_1.logger.info(`IPC command-agent:confirm received for ID: ${confirmationId}`);
        return await command_agent_service_1.commandAgentService.confirmAction(confirmationId);
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.COMMAND_AGENT.CANCEL, async (_event, confirmationId) => {
        logger_1.logger.info(`IPC command-agent:cancel received for ID: ${confirmationId}`);
        return await command_agent_service_1.commandAgentService.cancelAction(confirmationId);
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.TASKS.GET, () => {
        return task_service_1.taskService.getTasks();
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.TASKS.SYNC, (_event, tasks) => {
        task_service_1.taskService.syncTasks(tasks);
        return { success: true };
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.GOALS.GET, () => {
        return goal_service_1.goalService.getGoals();
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.GOALS.SYNC, (_event, goals) => {
        goal_service_1.goalService.syncGoals(goals);
        return { success: true };
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.PROJECTS.GET, () => {
        return project_service_1.projectService.getProjects();
    });
    electron_1.ipcMain.handle(constants_1.IPC_CHANNELS.PROJECTS.SYNC, (_event, projects) => {
        project_service_1.projectService.syncProjects(projects);
        return { success: true };
    });
}
