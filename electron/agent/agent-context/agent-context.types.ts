/**
 * ALFRED Phase 5.5A — Agent Context & Personal State Types
 *
 * Provides strongly-typed, read-only structures representing a complete
 * snapshot of the user's current ALFRED state.
 *
 * SECURITY & ARCHITECTURAL GUARANTEES:
 * 1. Strictly READ-ONLY.
 * 2. Secrets Prevention: ZERO API keys, passwords, tokens, credentials, or internal file paths.
 * 3. Bounded Context: All detailed lists are strictly bounded to prevent LLM prompt bloat.
 * 4. Single Source of Truth: Built on top of canonical Electron services and renderer snapshots.
 * 5. Deterministic Serialization: Safe for all AI providers (Ollama, Gemini, Claude, Mock).
 */

export interface SystemContextSummary {
    platform: string;
    currentTime: string;
    currentDate: string;
    currentDayOfWeek: string;
    timezone: string;
    activeProvider: string;
    ttsEnabled: boolean;
    wakeWordEnabled: boolean;
}

export interface TaskItemSummary {
    id: string;
    text: string;
    category: string;
    completed: boolean;
    priority?: "low" | "medium" | "high";
    dueDate?: string;
    isOverdue?: boolean;
    isDueToday?: boolean;
}

export interface TasksContextSummary {
    summary: {
        total: number;
        pending: number;
        completed: number;
        overdue: number;
        dueToday: number;
        highPriorityPending: number;
        completionRatePercentage: number;
    };
    todayPending: TaskItemSummary[];
    recentPending: TaskItemSummary[];
    recentlyCompleted: TaskItemSummary[];
}

export interface ProjectItemSummary {
    id: string;
    name: string;
    category: string;
    status: string;
    progress: number;
    description?: string;
}

export interface ProjectsContextSummary {
    summary: {
        total: number;
        active: number;
        completed: number;
        notStarted: number;
        averageProgress: number;
    };
    activeProjects: ProjectItemSummary[];
}

export interface GoalItemSummary {
    id: string;
    title: string;
    type: "Weekly" | "Monthly" | string;
    target: number;
    current: number;
    completed: boolean;
    progressPercentage: number;
}

export interface GoalsContextSummary {
    summary: {
        total: number;
        active: number;
        completed: number;
        weeklyCount: number;
        monthlyCount: number;
    };
    activeGoals: GoalItemSummary[];
}

export interface WorkspaceItemSummary {
    id: string;
    name: string;
    type: string;
    description: string;
    applications: string[];
    websites: string[];
    localFolders: string[];
    launchCount?: number;
    lastLaunched?: string | null;
}

export interface WorkspacesContextSummary {
    summary: {
        total: number;
        recentlyLaunched: string | null;
    };
    workspaces: WorkspaceItemSummary[];
}

export type FocusTimerState = "idle" | "running" | "paused" | "completed";

export interface FocusContextSummary {
    state: FocusTimerState;
    isActive: boolean;
    sessionDurationMinutes: number;
    remainingSeconds: number;
    elapsedSeconds: number;
    todayFocusMinutes: number;
    totalFocusMinutes: number;
    completedSessionsCount: number;
    activeWorkspace?: string;
    sessionType?: string;
}

export interface ActivityItemSummary {
    type: string;
    label?: string;
    detail?: string;
    timestamp: number;
}

export interface AnalyticsContextSummary {
    currentStreak: number;
    lastActiveDate: string | null;
    taskCompletionRate: number;
    todayFocusMinutes: number;
    totalFocusMinutes: number;
}

export interface ConversationTurnSummary {
    userRequest: string;
    intent: string;
    responseType: "action" | "answer";
    answerText?: string;
    toolsExecuted: string[];
    summary: string;
}

import { MemoryContextSummary } from "../memory/memory.types";
export type { MemoryContextSummary };

export interface ApprovedAppSummary {
    id: string;
    name: string;
    aliases: string[];
}

export interface AgentContextSnapshot {
    generatedAt: string;
    system: SystemContextSummary;
    tasks: TasksContextSummary;
    projects: ProjectsContextSummary;
    goals: GoalsContextSummary;
    workspaces: WorkspacesContextSummary;
    focus: FocusContextSummary;
    activity: ActivityItemSummary[];
    analytics: AnalyticsContextSummary;
    conversation: ConversationTurnSummary[];
    /** Phase 5.7: Bounded, user-controlled long-term memory */
    memory: MemoryContextSummary;
    /** User-approved application names and aliases (strictly no file paths) */
    approvedApplications?: ApprovedAppSummary[];
}

export interface AgentContextInputOptions {
    focus?: Partial<FocusContextSummary>;
    activity?: ActivityItemSummary[];
    streak?: {
        currentStreak?: number;
        lastActiveDate?: string | null;
    };
    now?: Date;
    tasks?: TaskItemSummary[] | any[];
    projects?: ProjectItemSummary[] | any[];
    goals?: GoalItemSummary[] | any[];
    workspaces?: WorkspaceItemSummary[] | any[];
    tasksLimit?: number;
    activityLimit?: number;
    projectsLimit?: number;
    goalsLimit?: number;
    workspacesLimit?: number;
    conversationLimit?: number;
    /** Current user query to resolve relevant memories */
    query?: string;
    memoryLimit?: number;
}
