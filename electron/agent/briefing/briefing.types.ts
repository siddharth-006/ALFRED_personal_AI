/**
 * ALFRED Phase 5.8B — Morning Briefing Types
 *
 * Strongly-typed, read-only data model representing the morning briefing.
 * Derived strictly from real current ALFRED state (AgentContext, tasks, projects,
 * goals, focus, memory, recommendations, routines).
 *
 * ARCHITECTURAL & SECURITY GUARANTEES:
 * 1. Strictly READ-ONLY: Never mutates state or invokes tools.
 * 2. Secrets Prevention: ZERO internal IDs, filesystem paths, tokens, or raw JSON.
 * 3. Bounded Context: All task/project/goal/memory lists are strictly bounded.
 * 4. Factual Grounding: Never invents statistics, fake metrics, or fake deadlines.
 */

import {
    TaskItemSummary,
    ProjectItemSummary,
    GoalItemSummary,
    FocusTimerState,
    ActivityItemSummary,
} from "../agent-context/agent-context.types";
import { RecommendationItem } from "../recommendation/recommendation.types";
import { Routine } from "../routines/routine.types";

export interface MorningBriefingTimeContext {
    currentTime: string;
    currentDate: string;
    currentDayOfWeek: string;
    timezone: string;
}

export interface MorningBriefingFocusSummary {
    state: FocusTimerState;
    todayFocusMinutes: number;
    totalFocusMinutes: number;
    activeSession?: string;
    description: string;
}

export interface MorningBriefingMemoryItem {
    id: string;
    category: string;
    content: string;
}

export interface MorningBriefingRoutineItem {
    id: string;
    name: string;
    description: string;
    aliases: string[];
}

export interface MorningBriefingCounts {
    overdueTasks: number;
    dueTodayTasks: number;
    highPriorityTasks: number;
    totalPendingTasks: number;
    activeProjects: number;
    activeGoals: number;
    todayFocusMinutes: number;
}

export interface MorningBriefing {
    /** ISO timestamp when the briefing was generated */
    generatedAt: string;
    /** Conversational time-of-day greeting ("Good morning", "Good afternoon", "Good evening") */
    greeting: string;
    /** Local system date & time details */
    timeContext: MorningBriefingTimeContext;
    /** Overdue incomplete tasks */
    overdueTasks: TaskItemSummary[];
    /** Tasks due today */
    dueTodayTasks: TaskItemSummary[];
    /** Incomplete tasks marked high priority */
    highPriorityTasks: TaskItemSummary[];
    /** Other pending incomplete tasks */
    pendingTasks: TaskItemSummary[];
    /** Active projects with real progress values */
    activeProjects: ProjectItemSummary[];
    /** Active goals with real progress values */
    activeGoals: GoalItemSummary[];
    /** Current focus timer state and minutes */
    focusSummary: MorningBriefingFocusSummary;
    /** Bounded recent workstation activity */
    recentActivity: ActivityItemSummary[];
    /** Contextually relevant user preferences / memories (passive data only) */
    relevantMemories: MorningBriefingMemoryItem[];
    /** Bounded, factual recommendations from RecommendationAgent */
    recommendations: RecommendationItem[];
    /** Deterministic routines available to execute */
    availableRoutines: MorningBriefingRoutineItem[];
    /** Aggregate numerical summary of items */
    counts: MorningBriefingCounts;
    /** Detailed natural language briefing for terminal and UI display */
    summary: string;
    /** Concise natural language briefing sanitized for Text-to-Speech */
    spokenSummary: string;
    /** True if the user has no tasks, active projects, goals, or focus time */
    isEmpty: boolean;
}

export interface MorningBriefingOptions {
    /** Natural language query that triggered the briefing */
    query?: string;
    /** Injected context options from caller / IPC */
    context?: Record<string, unknown>;
    /** Max tasks to include in each sub-list (default 5) */
    tasksLimit?: number;
    /** Max projects to include (default 3) */
    projectsLimit?: number;
    /** Max goals to include (default 3) */
    goalsLimit?: number;
    /** Max memories to include (default 3) */
    memoriesLimit?: number;
    /** Explicit date for testing deterministic date/time */
    now?: Date;
}
