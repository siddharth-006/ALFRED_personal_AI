/**
 * ALFRED Weekly Review & Weekly Planning — Types & Contracts
 */

import { TaskItemSummary } from "../agent-context/agent-context.types";

export interface WeeklyTimeContext {
    currentWeekStart: string; // ISO date string (YYYY-MM-DD)
    currentWeekEnd: string;   // ISO date string (YYYY-MM-DD)
    currentDate: string;      // ISO date string (YYYY-MM-DD)
    currentDayOfWeek: string;
    timezone: string;
}

export interface WeeklyCounts {
    completedThisWeekTasks: number;
    unfinishedTasks: number;
    overdueTasks: number;
    totalPendingTasks: number;
    totalFocusMinutes: number;
    focusSessionCount: number;
    activeProjectsCount: number;
    activeGoalsCount: number;
}

export interface WeeklyFocusSummary {
    totalMinutes: number;
    sessionCount: number;
    averageDailyMinutes: number;
    topWorkspace?: string;
    description: string;
}

export interface WeeklyProjectActivity {
    id: string;
    name: string;
    category: string;
    progress: number;
    status: string;
    description: string;
}

export interface WeeklyGoalProgress {
    id: string;
    title: string;
    type: string;
    target: number;
    current: number;
    progressPercentage: number;
    completed: boolean;
}

export interface WeeklyMemoryItem {
    id: string;
    category: string;
    content: string;
}

export interface WeeklyReview {
    generatedAt: string;
    timeContext: WeeklyTimeContext;
    completedTasks: TaskItemSummary[];
    unfinishedTasks: TaskItemSummary[];
    overdueTasks: TaskItemSummary[];
    focusSummary: WeeklyFocusSummary;
    projectActivity: WeeklyProjectActivity[];
    goalProgress: WeeklyGoalProgress[];
    recentActivity: Array<{ id: string; time: string; label: string; detail: string; type: string }>;
    relevantMemories: WeeklyMemoryItem[];
    recommendations: Array<{ id: string; title: string; rationale: string; category: string }>;
    counts: WeeklyCounts;
    conciseSummary: string;
    spokenSummary: string;
    isEmpty: boolean;
}

export interface WeeklyPlanProposal {
    generatedAt: string;
    timeContext: WeeklyTimeContext;
    suggestedPriorities: Array<{ title: string; reason: string; priority: "high" | "medium" | "low" }>;
    unfinishedWork: TaskItemSummary[];
    activeGoals: Array<{ id: string; title: string; target: number; current: number }>;
    activeProjects: Array<{ id: string; name: string; progress: number }>;
    suggestedFocusAllocations: Array<{ category: string; suggestedMinutes: number; rationale: string }>;
    suggestedRoutines: Array<{ routineName: string; timing: string; rationale: string }>;
    proposalText: string;
    spokenPrompt: string;
    requiresExplicitConfirmation: true;
}

export interface WeeklyReviewOptions {
    now?: Date;
    tasksLimit?: number;
    projectsLimit?: number;
    goalsLimit?: number;
    context?: Record<string, unknown>;
}
