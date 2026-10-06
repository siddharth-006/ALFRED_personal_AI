import { ipcMain } from "electron";
import { IPC_CHANNELS, SystemPingResult } from "../../config/constants";
import { systemService } from "../../services/system.service";
import { backgroundLifecycleService } from "../../services/background-lifecycle.service";
import { trayManager } from "../../tray/tray-manager";
import { notificationService, NativeNotificationOptions } from "../../services/notification.service";
import { workspaceService } from "../../services/workspace.service";
import { taskService, Task } from "../../services/task.service";
import { goalService, Goal } from "../../services/goal.service";
import { projectService, Project } from "../../services/project.service";
import { conversationContextService } from "../../services/conversation-context.service";
import { commandAgentService } from "../../agent/command-agent.service";
import { routineService } from "../../agent/routines";
import { morningBriefingService } from "../../agent/briefing";
import { endOfDayReviewService } from "../../agent/review";
import { weeklyReviewService } from "../../agent/review/weekly-review.service";
import { routineScheduler } from "../../agent/scheduler/routine-scheduler.service";
import { conditionalAutomationService } from "../../agent/automation/conditional-automation.service";
import { notificationManager } from "../../services/notification-manager.service";
import { eventBus } from "../../events/event-bus";
import { focusService } from "../../services/focus.service";
import { knowledgeService } from "../../knowledge/knowledge.service";
import { desktopContextService } from "../../services/desktop-context.service";
import { settingsService } from "../../services/settings.service";
import { hotkeyService } from "../../services/hotkey.service";
import { appDiscoveryService } from "../../services/app-discovery.service";
import { approvedAppsService } from "../../services/approved-apps.service";
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
            return notificationService.send({ title, body, category: "system" });
        }
    );

    ipcMain.handle(IPC_CHANNELS.DESKTOP.GET_STATE, () => {
        logger.info("IPC desktop:get-state received");
        return backgroundLifecycleService.getState();
    });

    ipcMain.handle(IPC_CHANNELS.DESKTOP.SHOW, () => {
        logger.info("IPC desktop:show received");
        trayManager.showWindow();
        return true;
    });

    ipcMain.handle(IPC_CHANNELS.DESKTOP.HIDE, () => {
        logger.info("IPC desktop:hide received");
        trayManager.hideWindow();
        return true;
    });

    ipcMain.handle(
        IPC_CHANNELS.NOTIFICATIONS.SEND,
        (_event, options: any) => {
            logger.info(`IPC notifications:send received for category: ${options?.category || "system"}`);
            return notificationManager.send(options);
        }
    );

    ipcMain.handle(
        IPC_CHANNELS.SYSTEM.EXECUTE_COMMAND,
        async (_event, { command }: { command: string; cwd?: string }) => {
            logger.warn(`IPC system:execute-command rejected: Direct shell execution from renderer is forbidden (command: ${command}). All execution must route through ToolRegistry.`);
            return {
                stdout: "",
                stderr: "Direct shell execution is strictly disabled. Actions must route through validated ToolRegistry tools.",
                exitCode: 1,
            };
        }
    );

    ipcMain.handle(IPC_CHANNELS.WORKSPACE.GET_STATUS, () => {
        logger.info("IPC workspace:get-status received");
        return workspaceService.getWorkspaceStatus();
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACE.GET_ALL, () => {
        logger.info("IPC workspace:get-all received");
        return workspaceService.getWorkspaces();
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACE.SYNC, (_event, workspaces: any[]) => {
        logger.info(`IPC workspace:sync received (${workspaces?.length || 0} workspaces)`);
        workspaceService.syncWorkspaces(workspaces);
        return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACE.LAUNCH, async (_event, payload: any) => {
        logger.info(`IPC workspace:launch received`);
        return await workspaceService.launchWorkspace(payload);
    });

    // Windows Installed Applications & Approved Registry IPC Handlers
    ipcMain.handle(IPC_CHANNELS.APPS.DISCOVER, async () => {
        logger.info("IPC apps:discover received");
        return await appDiscoveryService.discoverApplications();
    });

    ipcMain.handle(IPC_CHANNELS.APPS.GET_DISCOVERED, async () => {
        logger.info("IPC apps:get-discovered received");
        const cached = appDiscoveryService.getCachedDiscovered();
        if (cached && cached.length > 0) {
            return cached;
        }
        return await appDiscoveryService.discoverApplications();
    });

    ipcMain.handle(IPC_CHANNELS.APPS.GET_APPROVED, () => {
        logger.info("IPC apps:get-approved received");
        return approvedAppsService.getApprovedApplications();
    });

    ipcMain.handle(IPC_CHANNELS.APPS.APPROVE, (_event, { app, aliases }: { app: any; aliases?: string[] }) => {
        logger.info(`IPC apps:approve received for: ${app?.name}`);
        return approvedAppsService.approveApplication(app, aliases);
    });

    ipcMain.handle(IPC_CHANNELS.APPS.REVOKE, (_event, id: string) => {
        logger.info(`IPC apps:revoke received for ID: ${id}`);
        return approvedAppsService.revokeApplication(id);
    });

    ipcMain.handle(IPC_CHANNELS.APPS.UPDATE_ALIASES, (_event, { id, aliases }: { id: string; aliases: string[] }) => {
        logger.info(`IPC apps:update-aliases received for ID: ${id}`);
        return approvedAppsService.updateAliases(id, aliases);
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
                workspaces: workspaceService.getWorkspaces(),
                recentConversation: conversationContextService.getRecentTurns(),
            };
        } else {
            if (!effectiveOptions.context.recentConversation) {
                effectiveOptions.context.recentConversation = conversationContextService.getRecentTurns();
            }
            if (!effectiveOptions.context.workspaces) {
                effectiveOptions.context.workspaces = workspaceService.getWorkspaces();
            }
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

    ipcMain.handle(IPC_CHANNELS.ROUTINES.GET_ALL, () => {
        logger.info("IPC routines:get-all received");
        return routineService.getRoutines();
    });

    ipcMain.handle(IPC_CHANNELS.BRIEFING.GET, (_event, options) => {
        logger.info("IPC briefing:get received");
        return morningBriefingService.generateBriefing(options);
    });

    ipcMain.handle(IPC_CHANNELS.REVIEW.GET, (_event, options) => {
        logger.info("IPC review:get received");
        return endOfDayReviewService.generateReview(options);
    });

    ipcMain.handle(IPC_CHANNELS.FOCUS.GET_STATUS, () => {
        logger.info("IPC focus:get-status received");
        return focusService.getFocusSummary();
    });

    ipcMain.handle(IPC_CHANNELS.FOCUS.START, (_event, options) => {
        logger.info("IPC focus:start received", options);
        return focusService.startSession(options || {});
    });

    ipcMain.handle(IPC_CHANNELS.FOCUS.PAUSE, () => {
        logger.info("IPC focus:pause received");
        return focusService.pauseSession();
    });

    ipcMain.handle(IPC_CHANNELS.FOCUS.RESUME, () => {
        logger.info("IPC focus:resume received");
        return focusService.resumeSession();
    });

    ipcMain.handle(IPC_CHANNELS.FOCUS.STOP, () => {
        logger.info("IPC focus:stop received");
        return focusService.stopSession();
    });

    ipcMain.handle(IPC_CHANNELS.FOCUS.ADD_MINUTES, () => {
        logger.info("IPC focus:add-minutes received");
        return focusService.addFiveMinutes();
    });

    // Phase 5.10: Weekly Review & Planning
    ipcMain.handle(IPC_CHANNELS.WEEKLY_REVIEW.GET, (_event, options) => {
        logger.info("IPC weekly-review:get received");
        return weeklyReviewService.generateWeeklyReview(options);
    });

    ipcMain.handle(IPC_CHANNELS.WEEKLY_PLAN.GET, (_event, options) => {
        logger.info("IPC weekly-plan:get received");
        return weeklyReviewService.generateWeeklyPlanProposal(options);
    });

    // Phase 5.10: Scheduled Routines
    ipcMain.handle(IPC_CHANNELS.SCHEDULES.GET_ALL, () => {
        logger.info("IPC schedules:get-all received");
        return routineScheduler.getSchedules();
    });

    ipcMain.handle(IPC_CHANNELS.SCHEDULES.CREATE, (_event, input) => {
        logger.info("IPC schedules:create received");
        return routineScheduler.createSchedule(input);
    });

    ipcMain.handle(IPC_CHANNELS.SCHEDULES.SET_ENABLED, (_event, { id, enabled }: { id: string; enabled: boolean }) => {
        logger.info(`IPC schedules:set-enabled received for ${id}: ${enabled}`);
        return routineScheduler.setEnabled(id, enabled);
    });

    ipcMain.handle(IPC_CHANNELS.SCHEDULES.DELETE, (_event, id: string) => {
        logger.info(`IPC schedules:delete received for ${id}`);
        return routineScheduler.deleteSchedule(id);
    });

    ipcMain.handle(IPC_CHANNELS.SCHEDULES.EXECUTE_NOW, async (_event, schedule) => {
        logger.info(`IPC schedules:execute-now received for ${schedule?.name}`);
        return await routineScheduler.executeScheduledTarget(schedule);
    });

    // Phase 5.10: Conditional Automation
    ipcMain.handle(IPC_CHANNELS.AUTOMATIONS.GET_ALL, () => {
        logger.info("IPC automations:get-all received");
        return conditionalAutomationService.getRules();
    });

    ipcMain.handle(IPC_CHANNELS.AUTOMATIONS.CREATE, (_event, input) => {
        logger.info("IPC automations:create received");
        return conditionalAutomationService.createRule(input);
    });

    ipcMain.handle(IPC_CHANNELS.AUTOMATIONS.SET_ENABLED, (_event, { id, enabled }: { id: string; enabled: boolean }) => {
        logger.info(`IPC automations:set-enabled received for ${id}: ${enabled}`);
        return conditionalAutomationService.setEnabled(id, enabled);
    });

    ipcMain.handle(IPC_CHANNELS.AUTOMATIONS.DELETE, (_event, id: string) => {
        logger.info(`IPC automations:delete received for ${id}`);
        return conditionalAutomationService.deleteRule(id);
    });

    // Phase 5.10: Events
    ipcMain.handle(IPC_CHANNELS.EVENTS.GET_RECENT, (_event, limit?: number) => {
        logger.info("IPC events:get-recent received");
        return eventBus.getRecentEvents(limit);
    });

    ipcMain.handle(IPC_CHANNELS.EVENTS.PUBLISH, (_event, { type, payload }: { type: any; payload: any }) => {
        logger.info(`IPC events:publish received for ${type}`);
        return eventBus.publish(type, payload);
    });

    // Phase 5.10: Notification Manager Preferences & History
    ipcMain.handle(IPC_CHANNELS.NOTIFICATIONS.GET_PREFERENCES, () => {
        logger.info("IPC notifications:get-preferences received");
        return notificationManager.getPreferences();
    });

    ipcMain.handle(IPC_CHANNELS.NOTIFICATIONS.UPDATE_PREFERENCES, (_event, updates) => {
        logger.info("IPC notifications:update-preferences received");
        return notificationManager.updatePreferences(updates);
    });

    ipcMain.handle(IPC_CHANNELS.NOTIFICATIONS.GET_HISTORY, (_event, options) => {
        logger.info("IPC notifications:get-history received");
        return notificationManager.getHistory(options);
    });

    ipcMain.handle(IPC_CHANNELS.NOTIFICATIONS.DISMISS, (_event, id: string) => {
        logger.info(`IPC notifications:dismiss received for ${id}`);
        return notificationManager.dismiss(id);
    });

    ipcMain.handle(IPC_CHANNELS.NOTIFICATIONS.CLEAR_HISTORY, () => {
        logger.info("IPC notifications:clear-history received");
        notificationManager.clearHistory();
        return true;
    });

    // Phase 6.1: Personal Knowledge / Local RAG
    ipcMain.handle(IPC_CHANNELS.KNOWLEDGE.SEARCH, (_event, options) => {
        logger.info(`IPC knowledge:search received for query: "${options?.query}"`);
        return knowledgeService.search(options);
    });

    ipcMain.handle(IPC_CHANNELS.KNOWLEDGE.IMPORT, (_event, input) => {
        logger.info(`IPC knowledge:import received for: "${input?.name}"`);
        return knowledgeService.importDocument(input);
    });

    ipcMain.handle(IPC_CHANNELS.KNOWLEDGE.GET_DOCUMENTS, (_event, filter) => {
        logger.info("IPC knowledge:get-documents received");
        return knowledgeService.getDocuments(filter);
    });

    ipcMain.handle(IPC_CHANNELS.KNOWLEDGE.GET_SUMMARY, () => {
        logger.info("IPC knowledge:get-summary received");
        return knowledgeService.getSummary();
    });

    ipcMain.handle(IPC_CHANNELS.KNOWLEDGE.DELETE, (_event, id: string) => {
        logger.info(`IPC knowledge:delete received for ${id}`);
        return knowledgeService.deleteDocument(id);
    });

    ipcMain.handle(IPC_CHANNELS.KNOWLEDGE.CLEAR, () => {
        logger.info("IPC knowledge:clear received");
        knowledgeService.clearAll();
        return true;
    });

    // Phase 6.1: Desktop Context
    ipcMain.handle(IPC_CHANNELS.DESKTOP_CONTEXT.GET, () => {
        logger.info("IPC desktop-context:get received");
        return desktopContextService.getContextSnapshot();
    });

    // Phase 6.1: Settings & Permissions
    ipcMain.handle(IPC_CHANNELS.SETTINGS.GET, () => {
        logger.info("IPC settings:get received");
        return settingsService.getSettings();
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS.UPDATE, (_event, partial) => {
        logger.info("IPC settings:update received");
        return settingsService.updateSettings(partial);
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS.RESET, () => {
        logger.info("IPC settings:reset received");
        return settingsService.resetToDefaults();
    });

    // Phase 6.1: Global Hotkey
    ipcMain.handle(IPC_CHANNELS.HOTKEY.GET_STATUS, () => {
        logger.info("IPC hotkey:get-status received");
        return {
            registered: hotkeyService.isRegistered(),
            shortcut: hotkeyService.getShortcut(),
        };
    });

    ipcMain.handle(IPC_CHANNELS.HOTKEY.REGISTER, (_event, shortcut: string) => {
        logger.info(`IPC hotkey:register received for: ${shortcut}`);
        return hotkeyService.register(shortcut);
    });

    // Application Process Session Boot Lifecycle
    let sessionBootCompleted = false;

    ipcMain.handle(IPC_CHANNELS.SYSTEM.IS_BOOT_COMPLETED, () => {
        return sessionBootCompleted;
    });

    ipcMain.handle(IPC_CHANNELS.SYSTEM.MARK_BOOT_COMPLETED, () => {
        logger.info("[System] Boot sequence marked completed for current application process.");
        sessionBootCompleted = true;
        return true;
    });

    ipcMain.handle(IPC_CHANNELS.SYSTEM.RESET_BOOT_STATE, () => {
        sessionBootCompleted = false;
        return true;
    });
}
