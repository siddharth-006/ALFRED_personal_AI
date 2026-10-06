/**
 * ALFRED Phase 5.8B — Morning Briefing Service
 *
 * Provides a read-only daily intelligence layer summarizing ALFRED's current factual state:
 * Tasks, Projects, Goals, Focus Tracking, Contextual Memory, Recommendations, and Routines.
 *
 * ARCHITECTURAL GUARANTEES:
 * 1. Read-Only Intelligence: Never calls child_process, shell, eval, or ToolRegistry.
 * 2. Real Current State: Evaluates fresh AgentContext on every request (no stale cache).
 * 3. Zero Fabrication: Never invents statistics, fake tasks, artificial scores, or fake deadlines.
 * 4. Memory Safety: Memories remain passive data and are never converted into tool calls.
 * 5. Safe Spoken Output: Spoken summary never includes internal IDs, JSON, or filesystem paths.
 */

import {
    MorningBriefing,
    MorningBriefingOptions,
    MorningBriefingTimeContext,
    MorningBriefingFocusSummary,
    MorningBriefingMemoryItem,
    MorningBriefingRoutineItem,
    MorningBriefingCounts,
} from "./briefing.types";
import { agentContextService } from "../agent-context/agent-context.service";
import {
    AgentContextSnapshot,
    TaskItemSummary,
    ProjectItemSummary,
    GoalItemSummary,
} from "../agent-context/agent-context.types";
import { taskService, Task } from "../../services/task.service";
import { projectService, Project } from "../../services/project.service";
import { goalService, Goal } from "../../services/goal.service";
import { recommendationAgentService } from "../recommendation/recommendation-agent.service";
import { memoryService } from "../memory/memory.service";
import { routineService } from "../routines/routine.service";
import { Routine } from "../routines/routine.types";
import { logger } from "../../utils/logger";

/**
 * Clean markdown symbols, bullets, URLs, code fences, and tokens into clean natural speech text.
 */
function sanitizeTextForSpeech(raw: string): string {
    if (!raw) return "";
    let text = raw;
    text = text.replace(/```[\s\S]*?```/g, "");
    text = text.replace(/`([^`]+)`/g, "$1");
    text = text.replace(/\{[\s\S]*?\}/g, "");
    text = text.replace(/(?:sk-[a-zA-Z0-9_\-]+|[a-zA-Z0-9_\-]{24,})/g, "");
    text = text.replace(/https?:\/\/[^\s]+/gi, "");
    text = text.replace(/[a-zA-Z]:\\[^\s]+/g, "");
    text = text.replace(/^#+\s+/gm, "");
    text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
    text = text.replace(/\*([^*]+)\*/g, "$1");
    text = text.replace(/__([^_]+)__/g, "$1");
    text = text.replace(/_([^_]+)_/g, "$1");
    text = text.replace(/^[•\*\-\+]\s+/gm, "");
    text = text.replace(/[{}[\]"]/g, " ");
    text = text.replace(/\r?\n+/g, ". ");
    text = text.replace(/\s+/g, " ");
    text = text.replace(/\.{2,}/g, ".");
    text = text.replace(/\s*([.,?!])\s*/g, "$1 ");
    return text.trim();
}

/** Conversational prefixes to strip from incoming queries */
const CONVERSATIONAL_PREFIXES = [
    /^hey\s+alfred[,\s]*/i,
    /^alfred[,\s]*/i,
    /^can\s+you\s+(?:please\s+)?/i,
    /^could\s+you\s+(?:please\s+)?/i,
    /^would\s+you\s+(?:please\s+)?/i,
    /^please\s+/i,
    /^tell\s+me\s+/i,
    /^show\s+me\s+/i,
    /^give\s+me\s+/i,
    /^i\s+want\s+to\s+see\s+/i,
    /^what\s+is\s+/i,
    /^what's\s+/i,
];

/** Deterministic Morning Briefing match patterns */
const BRIEFING_PATTERNS = [
    /^(?:my\s+)?morning\s+briefing$/i,
    /^(?:today'?s\s+|the\s+)?briefing$/i,
    /^brief\s+me$/i,
    /^(?:what(?:'s|\s+is)\s+)?on\s+my\s+agenda(?:\s+today)?$/i,
    /^what\s+do\s+i\s+have(?:\s+for)?\s+today$/i,
    /^what\s+do\s+i\s+have\s+planned(?:\s+for\s+today)?$/i,
    /^how\s+does\s+my\s+day\s+look(?:ing)?$/i,
    /^good\s+morning(?:\s+alfred)?$/i,
    /^today'?s\s+overview$/i,
    /^(?:daily|morning)\s+overview$/i,
    /^what\s+is\s+my\s+day\s+like$/i,
    /^daily\s+briefing$/i,
    /^agenda\s+for\s+today$/i,
    /^here'?s\s+your\s+day$/i,
];

/** Strict exclusion patterns to ensure normal commands are never intercepted */
const EXCLUDED_PATTERNS = [
    /^(?:open|launch|run|start)\s+/i,
    /^(?:create|add|new|complete|delete|remove)\s+(?:task|project|goal)/i,
    /^(?:remember|forget)\s+/i,
    /^(?:what|which)\s+routines/i,
    /^(?:list|show)\s+routines/i,
    /^what\s+should\s+i\s+work\s+on/i,
    /^what\s+should\s+i\s+do\s+next/i,
    /^what\s+should\s+i\s+focus\s+on/i,
    /^system\s+(?:status|vitals)/i,
];

export class MorningBriefingService {
    /**
     * Determines whether a natural language query is requesting the Morning Briefing.
     */
    public isBriefingQuery(prompt: string): boolean {
        if (!prompt || typeof prompt !== "string") return false;
        const trimmed = prompt.trim();
        if (!trimmed) return false;

        // Check exclusions first
        for (const pattern of EXCLUDED_PATTERNS) {
            if (pattern.test(trimmed)) {
                return false;
            }
        }

        // Clean trailing punctuation
        const clean = trimmed.replace(/[?.!,]+$/, "").trim();

        // Strip conversational prefixes
        let normalized = clean;
        for (const prefix of CONVERSATIONAL_PREFIXES) {
            normalized = normalized.replace(prefix, "").trim();
        }

        // Test direct matches against normalized text or clean text
        for (const pattern of BRIEFING_PATTERNS) {
            if (pattern.test(normalized) || pattern.test(clean) || pattern.test(trimmed)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generates a strongly typed, read-only Morning Briefing from real ALFRED state.
     */
    public generateBriefing(options: MorningBriefingOptions = {}): MorningBriefing {
        logger.info("MorningBriefingService: Generating fresh, read-only morning briefing...");

        const now = options.now || new Date();
        const tasksLimit = options.tasksLimit || 5;
        const projectsLimit = options.projectsLimit || 3;
        const goalsLimit = options.goalsLimit || 3;
        const memoriesLimit = options.memoriesLimit || 3;

        // 1. Obtain fresh, real AgentContextSnapshot (Section 2)
        const effectiveContext = options.context || {};
        const freshSnapshot: AgentContextSnapshot = agentContextService.getContextSnapshot({
            now,
            query: options.query || "morning briefing",
            tasks: (effectiveContext.tasks || taskService.getTasks()) as any,
            projects: (effectiveContext.projects || projectService.getProjects()) as any,
            goals: (effectiveContext.goals || goalService.getGoals()) as any,
            focus: effectiveContext.focus as any,
            activity: effectiveContext.activity as any,
            streak: effectiveContext.streak as any,
        });

        // 2. Compute Greeting and Time Context (Section 11)
        const hour = now.getHours();
        let greeting = "Good morning";
        if (hour >= 12 && hour < 17) {
            greeting = "Good afternoon";
        } else if (hour >= 17 || hour < 5) {
            greeting = "Good evening";
        }

        const timeContext: MorningBriefingTimeContext = {
            currentTime: freshSnapshot.system.currentTime,
            currentDate: freshSnapshot.system.currentDate,
            currentDayOfWeek: freshSnapshot.system.currentDayOfWeek,
            timezone: freshSnapshot.system.timezone,
        };

        // 3. Factual Task Breakdown (Section 3)
        const rawTasks: Task[] = Array.isArray(effectiveContext.tasks)
            ? (effectiveContext.tasks as Task[])
            : taskService.getTasks();

        const todayStr = freshSnapshot.system.currentDate;

        const overdueRaw: Task[] = [];
        const dueTodayRaw: Task[] = [];
        const highPriorityRaw: Task[] = [];
        const otherPendingRaw: Task[] = [];

        for (const t of rawTasks) {
            if (t.completed) continue;

            const isDueToday = Boolean(t.dueDate && t.dueDate.startsWith(todayStr));
            const isOverdue = Boolean(t.dueDate && t.dueDate < todayStr);
            const isHighPriority = t.priority === "high";

            if (isOverdue) {
                overdueRaw.push(t);
            } else if (isDueToday) {
                dueTodayRaw.push(t);
            }

            if (isHighPriority && !isOverdue && !isDueToday) {
                highPriorityRaw.push(t);
            } else if (!isOverdue && !isDueToday && !isHighPriority) {
                otherPendingRaw.push(t);
            }
        }

        const mapTaskToSummary = (t: Task): TaskItemSummary => ({
            id: String(t.id),
            text: t.text,
            category: t.category || "General",
            completed: Boolean(t.completed),
            priority: t.priority,
            dueDate: t.dueDate,
            isOverdue: Boolean(t.dueDate && t.dueDate < todayStr && !t.completed),
            isDueToday: Boolean(t.dueDate && t.dueDate.startsWith(todayStr) && !t.completed),
        });

        const overdueTasks = overdueRaw.slice(0, tasksLimit).map(mapTaskToSummary);
        const dueTodayTasks = dueTodayRaw.slice(0, tasksLimit).map(mapTaskToSummary);
        const highPriorityTasks = highPriorityRaw.slice(0, tasksLimit).map(mapTaskToSummary);
        const pendingTasks = otherPendingRaw.slice(0, tasksLimit).map(mapTaskToSummary);

        const totalPendingCount = overdueRaw.length + dueTodayRaw.length + highPriorityRaw.length + otherPendingRaw.length;

        // 4. Project Summary (Section 4)
        const rawProjects: Project[] = Array.isArray(effectiveContext.projects)
            ? (effectiveContext.projects as Project[])
            : projectService.getProjects();

        const activeProjectsRaw = rawProjects.filter((p) => p.status !== "Completed");
        const activeProjects: ProjectItemSummary[] = activeProjectsRaw.slice(0, projectsLimit).map((p) => ({
            id: String(p.id),
            name: p.name,
            category: p.category,
            status: p.status,
            progress: typeof p.progress === "number" ? p.progress : 0,
            description: p.description,
        }));

        // 5. Goal Summary (Section 5)
        const rawGoals: Goal[] = Array.isArray(effectiveContext.goals)
            ? (effectiveContext.goals as Goal[])
            : goalService.getGoals();

        const activeGoalsRaw = rawGoals.filter((g) => !g.completed);
        const activeGoals: GoalItemSummary[] = activeGoalsRaw.slice(0, goalsLimit).map((g) => ({
            id: String(g.id),
            title: g.title,
            type: g.type,
            target: g.target,
            current: g.current,
            completed: g.completed,
            progressPercentage: g.target > 0 ? Math.round((g.current / g.target) * 100) : 0,
        }));

        // 6. Focus Summary (Section 6)
        const focusState = freshSnapshot.focus;
        let focusDescription = "No focus sessions logged yet today.";
        if (focusState.state === "running") {
            const minRemaining = Math.ceil(focusState.remainingSeconds / 60);
            focusDescription = `Active focus session in progress (${minRemaining} min remaining).`;
        } else if (focusState.todayFocusMinutes > 0) {
            focusDescription = `${focusState.todayFocusMinutes} minutes of focus completed today.`;
        }

        const focusSummary: MorningBriefingFocusSummary = {
            state: focusState.state,
            todayFocusMinutes: focusState.todayFocusMinutes || 0,
            totalFocusMinutes: focusState.totalFocusMinutes || 0,
            activeSession: focusState.activeWorkspace || focusState.sessionType,
            description: focusDescription,
        };

        // 7. Recent Activity (Section 7)
        const recentActivity = (freshSnapshot.activity || []).slice(0, 4);

        // 8. Relevant Memories (Section 8 - strictly bounded & passive data)
        const activeProjectNames = activeProjects.map((p) => p.name);
        const activeWorkspaceNames = (freshSnapshot.workspaces?.workspaces || []).map((w) => w.name);
        const memoryQuery = ["morning", "briefing", ...activeProjectNames, ...activeWorkspaceNames].join(" ");

        const candidateMemories = memoryService.findRelevantMemories(memoryQuery, {
            currentWorkspace: activeWorkspaceNames[0],
            currentProject: activeProjectNames[0],
            limit: memoriesLimit,
        });

        // Memory items must only be included if they have relevant content match
        const relevantMemories: MorningBriefingMemoryItem[] = candidateMemories.map((m) => ({
            id: m.id,
            category: m.category,
            content: m.content,
        }));

        // 9. Recommendations (Section 9)
        const recResult = recommendationAgentService.generateRecommendations(freshSnapshot);
        const recommendations = recResult.recommendations || [];

        // 10. Available Routines (Section 10 - read-only listing)
        const allRoutines: Routine[] = routineService.getRoutines();
        const availableRoutines: MorningBriefingRoutineItem[] = allRoutines.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            aliases: r.aliases,
        }));

        // Aggregate counts
        const counts: MorningBriefingCounts = {
            overdueTasks: overdueRaw.length,
            dueTodayTasks: dueTodayRaw.length,
            highPriorityTasks: highPriorityRaw.length,
            totalPendingTasks: totalPendingCount,
            activeProjects: activeProjectsRaw.length,
            activeGoals: activeGoalsRaw.length,
            todayFocusMinutes: focusSummary.todayFocusMinutes,
        };

        const isEmpty =
            totalPendingCount === 0 &&
            activeProjectsRaw.length === 0 &&
            activeGoalsRaw.length === 0 &&
            focusSummary.todayFocusMinutes === 0;

        // Build Natural Text Summary
        const summary = this.buildDetailedSummary(
            greeting,
            timeContext,
            counts,
            overdueTasks,
            dueTodayTasks,
            highPriorityTasks,
            activeProjects,
            activeGoals,
            focusSummary,
            relevantMemories,
            recommendations,
            availableRoutines,
            isEmpty
        );

        // Build Concise Spoken Summary for TTS (Section 15)
        const spokenSummary = this.buildSpokenSummary(
            greeting,
            counts,
            overdueTasks,
            dueTodayTasks,
            highPriorityTasks,
            activeProjects,
            isEmpty
        );

        return {
            generatedAt: new Date().toISOString(),
            greeting,
            timeContext,
            overdueTasks,
            dueTodayTasks,
            highPriorityTasks,
            pendingTasks,
            activeProjects,
            activeGoals,
            focusSummary,
            recentActivity,
            relevantMemories,
            recommendations,
            availableRoutines,
            counts,
            summary,
            spokenSummary,
            isEmpty,
        };
    }

    /**
     * Constructs the detailed natural language text summary for terminal and UI display.
     */
    private buildDetailedSummary(
        greeting: string,
        time: MorningBriefingTimeContext,
        counts: MorningBriefingCounts,
        overdue: TaskItemSummary[],
        dueToday: TaskItemSummary[],
        highPriority: TaskItemSummary[],
        projects: ProjectItemSummary[],
        goals: GoalItemSummary[],
        focus: MorningBriefingFocusSummary,
        memories: MorningBriefingMemoryItem[],
        recommendations: any[],
        routines: MorningBriefingRoutineItem[],
        isEmpty: boolean
    ): string {
        if (isEmpty) {
            return `${greeting}. Here's your day for ${time.currentDayOfWeek}, ${time.currentDate}.\n\nYou have no overdue tasks and nothing due today. You can start a routine or add a task when you're ready.`;
        }

        const lines: string[] = [];
        lines.push(`${greeting}. Here is your operational overview for ${time.currentDayOfWeek}, ${time.currentDate}:`);
        lines.push("");

        // Tasks section
        if (counts.overdueTasks > 0 || counts.dueTodayTasks > 0 || counts.highPriorityTasks > 0) {
            lines.push("📋 TASKS & PRIORITIES");
            if (counts.overdueTasks > 0) {
                lines.push(`• Overdue (${counts.overdueTasks}): ${overdue.map((t) => `"${t.text}"`).join(", ")}`);
            }
            if (counts.dueTodayTasks > 0) {
                lines.push(`• Due Today (${counts.dueTodayTasks}): ${dueToday.map((t) => `"${t.text}"`).join(", ")}`);
            }
            if (counts.highPriorityTasks > 0 && highPriority.length > 0) {
                lines.push(`• High Priority: ${highPriority.map((t) => `"${t.text}"`).join(", ")}`);
            }
            lines.push("");
        }

        // Projects section
        if (projects.length > 0) {
            lines.push("🚀 ACTIVE PROJECTS");
            for (const p of projects) {
                lines.push(`• ${p.name} (${p.progress}% progress) — ${p.status}`);
            }
            lines.push("");
        }

        // Goals section
        if (goals.length > 0) {
            lines.push("🎯 ACTIVE GOALS");
            for (const g of goals) {
                lines.push(`• ${g.title}: ${g.current}/${g.target} (${g.progressPercentage}%)`);
            }
            lines.push("");
        }

        // Focus section
        lines.push("⏱️ FOCUS TRACKING");
        lines.push(`• ${focus.description}`);
        lines.push("");

        // Relevant memories (if any)
        if (memories.length > 0) {
            lines.push("🧠 PERSONALIZED PREFERENCES");
            for (const m of memories) {
                lines.push(`• [${m.category}] ${m.content}`);
            }
            lines.push("");
        }

        // Recommendations (if any)
        if (recommendations.length > 0) {
            lines.push("💡 STRATEGIC OBSERVATION");
            lines.push(`• ${recommendations[0].title}: ${recommendations[0].rationale}`);
            lines.push("");
        }

        // Available Routines prompt
        if (routines.length > 0) {
            const routineNames = routines.map((r) => r.name).join(", ");
            lines.push(`⚡ READY ROUTINES: Say "Start coding mode" or ask to launch: ${routineNames}.`);
        }

        return lines.join("\n").trim();
    }

    /**
     * Constructs a safe, concise, conversational spoken summary for Text-to-Speech (Section 15).
     * Never contains internal IDs, JSON, tool names, or filesystem paths.
     */
    private buildSpokenSummary(
        greeting: string,
        counts: MorningBriefingCounts,
        overdue: TaskItemSummary[],
        dueToday: TaskItemSummary[],
        highPriority: TaskItemSummary[],
        projects: ProjectItemSummary[],
        isEmpty: boolean
    ): string {
        if (isEmpty) {
            return `${greeting}. You have no overdue tasks and nothing due today. You can start a routine or add a task when you're ready.`;
        }

        const parts: string[] = [];
        parts.push(`${greeting}.`);

        // Task situation
        if (counts.overdueTasks > 0 && counts.dueTodayTasks > 0) {
            parts.push(`You have ${counts.overdueTasks} overdue task${counts.overdueTasks > 1 ? "s" : ""} and ${counts.dueTodayTasks} task${counts.dueTodayTasks > 1 ? "s" : ""} due today.`);
        } else if (counts.overdueTasks > 0) {
            parts.push(`You have ${counts.overdueTasks} overdue task${counts.overdueTasks > 1 ? "s" : ""}.`);
        } else if (counts.dueTodayTasks > 0) {
            parts.push(`You have ${counts.dueTodayTasks} task${counts.dueTodayTasks > 1 ? "s" : ""} due today.`);
        } else if (counts.totalPendingTasks > 0) {
            parts.push(`You have ${counts.totalPendingTasks} pending task${counts.totalPendingTasks > 1 ? "s" : ""}.`);
        } else {
            parts.push("You are completely caught up on tasks.");
        }

        // Top focus item
        const topTask = overdue[0] || dueToday[0] || highPriority[0];
        if (topTask) {
            const cleanText = sanitizeTextForSpeech(topTask.text);
            parts.push(`Your top priority is ${cleanText}.`);
        } else if (projects.length > 0) {
            const cleanProject = sanitizeTextForSpeech(projects[0].name);
            parts.push(`Your primary active project is ${cleanProject}.`);
        }

        // Ready call-to-action
        parts.push("You can say 'start coding mode' when you're ready.");

        return parts.join(" ");
    }
}

export const morningBriefingService = new MorningBriefingService();
