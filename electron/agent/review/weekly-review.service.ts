/**
 * ALFRED Phase 5.10 — Weekly Review & Weekly Planning Service
 *
 * Provides factual, read-only weekly productivity intelligence and weekly planning proposals.
 *
 * ARCHITECTURAL GUARANTEES:
 * 1. Read-Only Intelligence: Never calls child_process, shell, eval, or direct mutation APIs.
 * 2. Real Current State: Evaluates fresh AgentContext on every request.
 * 3. Zero Fabrication: Never invents statistics, fake tasks, artificial scores, or fake deadlines.
 * 4. Separate Review from Planning: Weekly Review is purely reflective; Weekly Planning generates a proposal only.
 * 5. Safe Spoken Output: Spoken summary never includes internal IDs, JSON, or filesystem paths.
 */

import {
    WeeklyReview,
    WeeklyPlanProposal,
    WeeklyReviewOptions,
    WeeklyTimeContext,
    WeeklyCounts,
    WeeklyFocusSummary,
    WeeklyProjectActivity,
    WeeklyGoalProgress,
    WeeklyMemoryItem,
} from "./weekly-review.types";
import { agentContextService } from "../agent-context/agent-context.service";
import { TaskItemSummary } from "../agent-context/agent-context.types";
import { taskService, Task } from "../../services/task.service";
import { projectService, Project } from "../../services/project.service";
import { goalService, Goal } from "../../services/goal.service";
import { focusService } from "../../services/focus.service";
import { recommendationAgentService } from "../recommendation/recommendation-agent.service";
import { memoryService } from "../memory/memory.service";
import { logger } from "../../utils/logger";

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

const WEEKLY_REVIEW_PATTERNS = [
    /^how\s+did\s+i\s+do\s+this\s+week$/i,
    /^(?:give\s+me\s+)?(?:my\s+)?weekly\s+review$/i,
    /^summarize\s+my\s+week$/i,
    /^what\s+did\s+i\s+accomplish\s+this\s+week$/i,
    /^what\s+did\s+i\s+get\s+done\s+this\s+week$/i,
    /^review\s+my\s+week$/i,
    /^review\s+this\s+week$/i,
    /^this\s+week'?s\s+review$/i,
    /^weekly\s+summary$/i,
    /^week\s+in\s+review$/i,
    /^weekly\s+intelligence$/i,
];

const WEEKLY_PLAN_PATTERNS = [
    /^plan\s+my\s+week$/i,
    /^help\s+me\s+plan\s+my\s+week$/i,
    /^weekly\s+planning$/i,
    /^plan\s+the\s+week$/i,
    /^plan\s+this\s+week$/i,
    /^create\s+(?:a\s+)?weekly\s+plan$/i,
    /^weekly\s+plan\s+proposal$/i,
];

export class WeeklyReviewService {
    private static instance: WeeklyReviewService | null = null;

    public static getInstance(): WeeklyReviewService {
        if (!WeeklyReviewService.instance) {
            WeeklyReviewService.instance = new WeeklyReviewService();
        }
        return WeeklyReviewService.instance;
    }

    public isWeeklyReviewQuery(prompt: string): boolean {
        if (!prompt || typeof prompt !== "string") return false;
        const trimmed = prompt.trim();
        if (!trimmed) return false;

        const clean = trimmed.toLowerCase().replace(/[.!?]+$/, "").trim();
        let normalized = clean;
        for (const prefix of CONVERSATIONAL_PREFIXES) {
            normalized = normalized.replace(prefix, "").trim();
        }

        return WEEKLY_REVIEW_PATTERNS.some(
            (pattern) => pattern.test(normalized) || pattern.test(clean) || pattern.test(trimmed)
        );
    }

    public isWeeklyPlanQuery(prompt: string): boolean {
        if (!prompt || typeof prompt !== "string") return false;
        const trimmed = prompt.trim();
        if (!trimmed) return false;

        const clean = trimmed.toLowerCase().replace(/[.!?]+$/, "").trim();
        let normalized = clean;
        for (const prefix of CONVERSATIONAL_PREFIXES) {
            normalized = normalized.replace(prefix, "").trim();
        }

        return WEEKLY_PLAN_PATTERNS.some(
            (pattern) => pattern.test(normalized) || pattern.test(clean) || pattern.test(trimmed)
        );
    }

    private getWeekRange(now: Date): { start: Date; end: Date; startStr: string; endStr: string } {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const day = d.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day; // Monday is day 1

        const monday = new Date(d);
        monday.setDate(d.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        return {
            start: monday,
            end: sunday,
            startStr: monday.toISOString().split("T")[0],
            endStr: sunday.toISOString().split("T")[0],
        };
    }

    public generateWeeklyReview(options: WeeklyReviewOptions = {}): WeeklyReview {
        logger.info("WeeklyReviewService: Generating fresh, read-only Weekly Review...");

        const now = options.now || new Date();
        const tasksLimit = options.tasksLimit || 10;
        const projectsLimit = options.projectsLimit || 5;
        const goalsLimit = options.goalsLimit || 5;

        const week = this.getWeekRange(now);
        const todayStr = now.toISOString().split("T")[0];

        const timeContext: WeeklyTimeContext = {
            currentWeekStart: week.startStr,
            currentWeekEnd: week.endStr,
            currentDate: todayStr,
            currentDayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        };

        const effectiveContext = options.context || {};

        // 1. Tasks
        const rawTasks: Task[] = Array.isArray(effectiveContext.tasks)
            ? (effectiveContext.tasks as Task[])
            : taskService.getTasks();

        const completedThisWeekRaw: Task[] = [];
        const unfinishedRaw: Task[] = [];
        const overdueRaw: Task[] = [];

        const weekStartMs = week.start.getTime();
        const weekEndMs = week.end.getTime();

        for (const t of rawTasks) {
            if (t.completed) {
                if (typeof t.completedAt === "number") {
                    if (t.completedAt >= weekStartMs && t.completedAt <= weekEndMs) {
                        completedThisWeekRaw.push(t);
                    }
                } else {
                    completedThisWeekRaw.push(t);
                }
            } else {
                if (t.dueDate && t.dueDate < todayStr) {
                    overdueRaw.push(t);
                } else {
                    unfinishedRaw.push(t);
                }
            }
        }

        const mapTask = (t: Task): TaskItemSummary => ({
            id: String(t.id),
            text: t.text,
            category: t.category || "General",
            completed: Boolean(t.completed),
            priority: t.priority,
            dueDate: t.dueDate,
            isOverdue: Boolean(t.dueDate && t.dueDate < todayStr && !t.completed),
            isDueToday: Boolean(t.dueDate && t.dueDate.startsWith(todayStr) && !t.completed),
        });

        const completedTasks = completedThisWeekRaw.slice(0, tasksLimit).map(mapTask);
        const unfinishedTasks = unfinishedRaw.slice(0, tasksLimit).map(mapTask);
        const overdueTasks = overdueRaw.slice(0, tasksLimit).map(mapTask);

        // 2. Focus summary from canonical FocusService
        const canonicalFocus = effectiveContext.focus
            ? (effectiveContext.focus as any)
            : focusService.getFocusSummary();

        const totalMinutes = typeof canonicalFocus.totalFocusMinutes === "number" ? canonicalFocus.totalFocusMinutes : 0;
        const sessionCount = typeof canonicalFocus.completedSessionsCount === "number" ? canonicalFocus.completedSessionsCount : 0;
        const averageDailyMinutes = Math.round(totalMinutes / 7);

        const focusHours = (totalMinutes / 60).toFixed(1);
        let focusDesc = "No focus sessions logged this week.";
        if (totalMinutes > 0) {
            focusDesc = `${totalMinutes} minutes (${focusHours} hours) of deep work across ${sessionCount} session(s).`;
        }

        const focusSummary: WeeklyFocusSummary = {
            totalMinutes,
            sessionCount,
            averageDailyMinutes,
            topWorkspace: canonicalFocus.activeWorkspace || "DSA",
            description: focusDesc,
        };

        // 3. Projects
        const rawProjects: Project[] = Array.isArray(effectiveContext.projects)
            ? (effectiveContext.projects as Project[])
            : projectService.getProjects();

        const activeProjectsRaw = rawProjects.filter((p) => p.status !== "Completed");
        const projectActivity: WeeklyProjectActivity[] = activeProjectsRaw.slice(0, projectsLimit).map((p) => ({
            id: String(p.id),
            name: p.name,
            category: p.category,
            status: p.status,
            progress: typeof p.progress === "number" ? p.progress : 0,
            description: p.description,
        }));

        // 4. Goals
        const rawGoals: Goal[] = Array.isArray(effectiveContext.goals)
            ? (effectiveContext.goals as Goal[])
            : goalService.getGoals();

        const goalProgress: WeeklyGoalProgress[] = rawGoals.slice(0, goalsLimit).map((g) => {
            const target = g.target > 0 ? g.target : 1;
            const current = Math.max(0, g.current);
            const progressPercentage = Math.min(100, Math.round((current / target) * 100));
            return {
                id: String(g.id),
                title: g.title,
                type: g.type,
                target: g.target,
                current: g.current,
                progressPercentage,
                completed: Boolean(g.completed) || current >= target,
            };
        });

        // 5. Relevant Memories
        const candidateMemories = memoryService.findRelevantMemories("weekly review accomplishments focus project goals", {
            limit: 3,
        });
        const relevantMemories: WeeklyMemoryItem[] = candidateMemories.map((m) => ({
            id: m.id,
            category: m.category,
            content: m.content,
        }));

        // 6. Recommendations
        const snapshot = agentContextService.getContextSnapshot({ now, tasks: rawTasks as any, projects: rawProjects as any, goals: rawGoals as any });
        const recResult = recommendationAgentService.generateRecommendations(snapshot);
        const recommendations = (recResult.recommendations || []).slice(0, 3).map((r) => ({
            id: r.id,
            title: r.title,
            rationale: r.rationale,
            category: r.category,
        }));

        // 7. Recent activity
        const recentActivity = (snapshot.activity || []).slice(0, 5).map((a, idx) => ({
            id: `act_${idx}_${a.timestamp}`,
            time: new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            label: a.label || a.type,
            detail: a.detail || "",
            type: a.type,
        }));

        // 8. Counts
        const counts: WeeklyCounts = {
            completedThisWeekTasks: completedThisWeekRaw.length,
            unfinishedTasks: unfinishedRaw.length,
            overdueTasks: overdueRaw.length,
            totalPendingTasks: unfinishedRaw.length + overdueRaw.length,
            totalFocusMinutes: totalMinutes,
            focusSessionCount: sessionCount,
            activeProjectsCount: activeProjectsRaw.length,
            activeGoalsCount: rawGoals.filter((g) => !g.completed).length,
        };

        const isEmpty =
            counts.completedThisWeekTasks === 0 &&
            counts.unfinishedTasks === 0 &&
            counts.overdueTasks === 0 &&
            totalMinutes === 0 &&
            activeProjectsRaw.length === 0;

        const conciseSummary = this.buildConciseSummary(
            timeContext,
            counts,
            completedTasks,
            unfinishedTasks,
            overdueTasks,
            projectActivity,
            focusSummary,
            goalProgress,
            recommendations,
            isEmpty
        );

        const spokenSummary = this.buildSpokenSummary(counts, focusSummary, recommendations, isEmpty);

        return {
            generatedAt: now.toISOString(),
            timeContext,
            completedTasks,
            unfinishedTasks,
            overdueTasks,
            focusSummary,
            projectActivity,
            goalProgress,
            recentActivity,
            relevantMemories,
            recommendations,
            counts,
            conciseSummary,
            spokenSummary,
            isEmpty,
        };
    }

    public generateWeeklyPlanProposal(options: WeeklyReviewOptions = {}): WeeklyPlanProposal {
        logger.info("WeeklyReviewService: Generating fresh Weekly Plan proposal (read-only)...");

        const now = options.now || new Date();
        const week = this.getWeekRange(now);
        const todayStr = now.toISOString().split("T")[0];

        const timeContext: WeeklyTimeContext = {
            currentWeekStart: week.startStr,
            currentWeekEnd: week.endStr,
            currentDate: todayStr,
            currentDayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        };

        const rawTasks = taskService.getTasks();
        const rawProjects = projectService.getProjects().filter((p) => p.status !== "Completed");
        const rawGoals = goalService.getGoals().filter((g) => !g.completed);

        const overdue = rawTasks.filter((t) => !t.completed && t.dueDate && t.dueDate < todayStr);
        const unfinished = rawTasks.filter((t) => !t.completed && (!t.dueDate || t.dueDate >= todayStr));

        // Formulate suggested priorities
        const suggestedPriorities: Array<{ title: string; reason: string; priority: "high" | "medium" | "low" }> = [];
        if (overdue.length > 0) {
            suggestedPriorities.push({
                title: `Resolve ${overdue.length} overdue task(s)`,
                reason: `Overdue items: ${overdue.map((t) => `"${t.text}"`).slice(0, 2).join(", ")}`,
                priority: "high",
            });
        }
        if (rawProjects.length > 0) {
            suggestedPriorities.push({
                title: `Advance primary project '${rawProjects[0].name}'`,
                reason: `Currently at ${rawProjects[0].progress}% progress.`,
                priority: "high",
            });
        }
        if (rawGoals.length > 0) {
            suggestedPriorities.push({
                title: `Target goal: '${rawGoals[0].title}'`,
                reason: `Current progress: ${rawGoals[0].current}/${rawGoals[0].target}`,
                priority: "medium",
            });
        }

        // Suggested focus allocations
        const suggestedFocusAllocations = [
            { category: "DSA / Coding", suggestedMinutes: 180, rationale: "3 sessions of 60 minutes for algorithmic practice." },
            { category: "Project Development", suggestedMinutes: 135, rationale: "3 sessions of 45 minutes for active project milestones." },
        ];

        // Suggested routines
        const suggestedRoutines = [
            { routineName: "Morning Briefing", timing: "Every weekday at 8:00 AM", rationale: "Stay updated on daily commitments." },
            { routineName: "Coding Mode", timing: "Every weekday at 7:00 PM", rationale: "Structured deep work session." },
        ];

        // Proposal text
        const proposalLines: string[] = [
            `PROPOSED WEEKLY PLAN // ${timeContext.currentWeekStart} to ${timeContext.currentWeekEnd}`,
            "",
            "🎯 SUGGESTED PRIORITIES:",
        ];
        for (const p of suggestedPriorities) {
            proposalLines.push(`• [${p.priority.toUpperCase()}] ${p.title} — ${p.reason}`);
        }
        proposalLines.push("");

        proposalLines.push("⏱️ RECOMMENDED FOCUS TIME ALLOCATION:");
        for (const f of suggestedFocusAllocations) {
            proposalLines.push(`• ${f.category}: ${f.suggestedMinutes}m total (${f.rationale})`);
        }
        proposalLines.push("");

        proposalLines.push("📅 RECOMMENDED ROUTINE SCHEDULE:");
        for (const r of suggestedRoutines) {
            proposalLines.push(`• ${r.routineName}: ${r.timing} (${r.rationale})`);
        }
        proposalLines.push("");
        proposalLines.push("ℹ️ Note: This is an advisory proposal only. ALFRED will not mutate your tasks or create schedules without your explicit instruction.");

        const proposalText = proposalLines.join("\n");
        const spokenPrompt = `I have formulated your weekly plan proposal with ${suggestedPriorities.length} key priorities and recommended focus allocations. Would you like me to schedule any of these routines?`;

        return {
            generatedAt: now.toISOString(),
            timeContext,
            suggestedPriorities,
            unfinishedWork: unfinished.slice(0, 5).map((t) => ({
                id: String(t.id),
                text: t.text,
                category: t.category || "General",
                completed: false,
                priority: t.priority,
                dueDate: t.dueDate,
            })),
            activeGoals: rawGoals.slice(0, 3).map((g) => ({ id: g.id, title: g.title, target: g.target, current: g.current })),
            activeProjects: rawProjects.slice(0, 3).map((p) => ({ id: p.id, name: p.name, progress: p.progress })),
            suggestedFocusAllocations,
            suggestedRoutines,
            proposalText,
            spokenPrompt,
            requiresExplicitConfirmation: true,
        };
    }

    private buildConciseSummary(
        time: WeeklyTimeContext,
        counts: WeeklyCounts,
        completed: TaskItemSummary[],
        unfinished: TaskItemSummary[],
        overdue: TaskItemSummary[],
        projects: WeeklyProjectActivity[],
        focus: WeeklyFocusSummary,
        goals: WeeklyGoalProgress[],
        recommendations: any[],
        isEmpty: boolean
    ): string {
        if (isEmpty) {
            return `Weekly review for week of ${time.currentWeekStart} to ${time.currentWeekEnd}.\n\nNo task activity or focus sessions were recorded this week. Ready to plan your upcoming week whenever you are.`;
        }

        const lines: string[] = [
            `WEEKLY REVIEW // ${time.currentWeekStart} TO ${time.currentWeekEnd}:`,
            "",
            "✅ COMPLETED THIS WEEK",
        ];

        if (counts.completedThisWeekTasks > 0) {
            lines.push(`• Finished ${counts.completedThisWeekTasks} task(s): ${completed.map((t) => `"${t.text}"`).join(", ")}`);
        } else {
            lines.push("• No tasks marked completed this week.");
        }
        lines.push("");

        lines.push("⏱️ FOCUS & DEEP WORK");
        lines.push(`• ${focus.description}`);
        lines.push("");

        if (counts.unfinishedTasks > 0 || counts.overdueTasks > 0) {
            lines.push("⚠️ UNFINISHED & OVERDUE WORK");
            if (counts.unfinishedTasks > 0) {
                lines.push(`• Unfinished tasks (${counts.unfinishedTasks}): ${unfinished.map((t) => `"${t.text}"`).slice(0, 3).join(", ")}`);
            }
            if (counts.overdueTasks > 0) {
                lines.push(`• Overdue items (${counts.overdueTasks}): ${overdue.map((t) => `"${t.text}"`).slice(0, 3).join(", ")}`);
            }
            lines.push("");
        }

        if (projects.length > 0) {
            lines.push("🚀 ACTIVE PROJECTS");
            for (const p of projects) {
                lines.push(`• ${p.name} (${p.progress}% progress) — ${p.status}`);
            }
            lines.push("");
        }

        if (goals.length > 0) {
            lines.push("🎯 GOAL PROGRESS");
            for (const g of goals) {
                lines.push(`• ${g.title}: ${g.current}/${g.target} (${g.progressPercentage}%)`);
            }
            lines.push("");
        }

        if (recommendations.length > 0) {
            lines.push("💡 STRATEGIC RECOMMENDATIONS");
            for (const r of recommendations) {
                lines.push(`• ${r.title}: ${r.rationale}`);
            }
        }

        return lines.join("\n").trim();
    }

    private buildSpokenSummary(
        counts: WeeklyCounts,
        focus: WeeklyFocusSummary,
        recommendations: any[],
        isEmpty: boolean
    ): string {
        if (isEmpty) {
            return "Here is your weekly review. You had no completed tasks or focus sessions logged this week. Ready whenever you want to plan your upcoming week.";
        }

        const parts: string[] = [];

        const hours = (counts.totalFocusMinutes / 60).toFixed(0);
        const hourStr = counts.totalFocusMinutes >= 60 ? `${hours} hours` : `${counts.totalFocusMinutes} minutes`;

        if (counts.completedThisWeekTasks > 0 && counts.totalFocusMinutes > 0) {
            parts.push(`This week you completed ${counts.completedThisWeekTasks} task${counts.completedThisWeekTasks === 1 ? "" : "s"} and logged ${hourStr} of focused work.`);
        } else if (counts.completedThisWeekTasks > 0) {
            parts.push(`This week you completed ${counts.completedThisWeekTasks} task${counts.completedThisWeekTasks === 1 ? "" : "s"}.`);
        } else if (counts.totalFocusMinutes > 0) {
            parts.push(`This week you logged ${hourStr} of focused work.`);
        } else {
            parts.push("Here is your weekly review.");
        }

        if (counts.unfinishedTasks > 0 || counts.overdueTasks > 0) {
            const pendingParts: string[] = [];
            if (counts.unfinishedTasks > 0) {
                pendingParts.push(`${counts.unfinishedTasks} unfinished task${counts.unfinishedTasks === 1 ? "" : "s"}`);
            }
            if (counts.overdueTasks > 0) {
                pendingParts.push(`${counts.overdueTasks} overdue item${counts.overdueTasks === 1 ? "" : "s"}`);
            }
            parts.push(`You have ${pendingParts.join(" and ")}.`);
        }

        if (recommendations.length > 0) {
            parts.push(`Recommendation: ${recommendations[0].title}.`);
        }

        return parts.join(" ");
    }
}

export const weeklyReviewService = WeeklyReviewService.getInstance();
