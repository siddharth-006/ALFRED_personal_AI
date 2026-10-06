/**
 * ALFRED Desktop Context — Service
 *
 * Provides safe, non-invasive contextual telemetry for ALFRED's reasoning agents.
 * Connects focus, workspace, tasks, projects, and routines into one unified snapshot.
 * Guarantees zero surveillance: no screenshots, no keylogging, no browser scraping.
 */

import { SafeDesktopContext } from "./desktop-context.types";
import { backgroundLifecycleService } from "./background-lifecycle.service";
import { focusService } from "./focus.service";
import { workspaceService } from "./workspace.service";
import { projectService } from "./project.service";
import { taskService } from "./task.service";
import { goalService } from "./goal.service";
import { getMainWindow } from "../windows/main-window";
import { logger } from "../utils/logger";

export class DesktopContextService {
    private static instance: DesktopContextService | null = null;

    private constructor() {}

    public static getInstance(): DesktopContextService {
        if (!DesktopContextService.instance) {
            DesktopContextService.instance = new DesktopContextService();
        }
        return DesktopContextService.instance;
    }

    /**
     * Captures a unified, safe desktop context snapshot.
     */
    public getContextSnapshot(): SafeDesktopContext {
        // 1. Foreground/Window state
        const win = getMainWindow();
        const isForeground = Boolean(
            win && !win.isDestroyed() && win.isVisible() && win.isFocused()
        );

        // 2. Active Focus Session
        const focusState = focusService.getFocusSummary();
        const focusSession = {
            isActive: focusState.isActive,
            state: focusState.state,
            sessionName: focusState.sessionName || "Focus Session",
            durationMinutes: focusState.sessionDurationMinutes,
            elapsedSeconds: focusState.elapsedSeconds,
            remainingSeconds: focusState.remainingSeconds,
            workspace: focusState.activeWorkspace,
        };

        // 3. Workspace state
        const managedWorkspaces = workspaceService.getWorkspaces();
        const activeWorkspaceMeta = managedWorkspaces.find(
            (w) => w.name.toLowerCase() === (focusState.activeWorkspace || "").toLowerCase()
        ) || managedWorkspaces[0];

        const activeWorkspace = activeWorkspaceMeta
            ? {
                  id: activeWorkspaceMeta.id,
                  name: activeWorkspaceMeta.name,
                  type: activeWorkspaceMeta.type,
                  lastLaunched: activeWorkspaceMeta.lastLaunched,
              }
            : undefined;

        // 4. Projects state
        const projects = projectService.getProjects();
        const activeProjects = projects.filter((p) => p.status !== "Completed");
        const topProject = activeProjects[0];
        const activeProject = topProject
            ? {
                  id: String(topProject.id),
                  name: topProject.name,
                  progress: typeof topProject.progress === "number" ? topProject.progress : 0,
                  category: topProject.category,
              }
            : undefined;

        // 5. Tasks summary
        const tasks = taskService.getTasks();
        const pendingTasks = tasks.filter((t) => !t.completed);
        const now = new Date();
        const overdueTasks = pendingTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);
        const urgentTasks = pendingTasks.filter((t) => t.priority === "high");
        const topTask = urgentTasks[0] || overdueTasks[0] || pendingTasks[0];

        const pendingTasksSummary = {
            overdueCount: overdueTasks.length,
            urgentCount: urgentTasks.length,
            topTaskText: topTask ? topTask.text : undefined,
        };

        // 6. Goals summary
        const goals = goalService.getGoals();
        const activeGoals = goals.filter((g) => !g.completed);
        const topGoal = activeGoals[0];

        const activeGoalsSummary = {
            activeCount: activeGoals.length,
            topGoalTitle: topGoal ? topGoal.title : undefined,
        };

        const snapshot: SafeDesktopContext = {
            timestamp: Date.now(),
            isForeground,
            activeWorkspace,
            focusSession,
            activeProject,
            pendingTasksSummary,
            activeGoalsSummary,
            privacyGuarantee: {
                screenCaptureEnabled: false,
                keystrokeLoggingEnabled: false,
                browserHistoryScrapingEnabled: false,
                arbitraryProcessInspectionEnabled: false,
            },
        };

        return snapshot;
    }

    /**
     * Synthesizes desktop context into a concise grounded narrative.
     */
    public formatContextSummary(): string {
        const ctx = this.getContextSnapshot();
        const parts: string[] = [];

        if (ctx.focusSession?.isActive) {
            parts.push(`Focus session "${ctx.focusSession.sessionName}" is active (${Math.round(ctx.focusSession.remainingSeconds / 60)}m remaining).`);
        }

        if (ctx.activeWorkspace) {
            parts.push(`Active workspace: ${ctx.activeWorkspace.name}.`);
        }

        if (ctx.activeProject) {
            parts.push(`Primary project: ${ctx.activeProject.name} (${ctx.activeProject.progress}% complete).`);
        }

        if (ctx.pendingTasksSummary.overdueCount > 0) {
            parts.push(`${ctx.pendingTasksSummary.overdueCount} overdue task(s).`);
        } else if (ctx.pendingTasksSummary.topTaskText) {
            parts.push(`Top task: "${ctx.pendingTasksSummary.topTaskText}".`);
        }

        return parts.join(" ") || "System is idle with no active focus session or urgent tasks.";
    }
}

export const desktopContextService = DesktopContextService.getInstance();
