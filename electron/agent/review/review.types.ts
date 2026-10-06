/**
 * ALFRED Phase 5.8D — End-of-Day Review Types
 *
 * Strongly-typed, read-only data model representing the end-of-day review.
 * Summarizes the user's actual day using fresh canonical ALFRED state:
 * - Completed tasks today (canonical task completion data)
 * - Unfinished/pending tasks (due today but not completed vs general pending)
 * - Overdue tasks (genuinely overdue)
 * - Focus & coding time (today's focus duration & session stats from FocusService)
 * - Project activity (active projects with real progress)
 * - Goal progress (today's relevant goal progress)
 * - Recent activity (bounded workstation activity)
 * - Relevant memories (contextually relevant passive memory)
 * - Tactical recommendations (1-3 grounded recommendations from RecommendationAgent)
 * - Concise text summary & sanitized spoken TTS summary
 *
 * ARCHITECTURAL & SECURITY GUARANTEES:
 * 1. Strictly READ-ONLY: Never mutates state or invokes tools.
 * 2. Secrets Prevention: ZERO internal IDs, filesystem paths, tokens, or raw JSON.
 * 3. Bounded Context: All task/project/goal/memory lists are strictly bounded.
 * 4. Factual Grounding: Never invents statistics, fake metrics, efficiency scores, or fake deadlines.
 */

import {
    TaskItemSummary,
    ProjectItemSummary,
    GoalItemSummary,
    FocusTimerState,
    ActivityItemSummary,
} from "../agent-context/agent-context.types";
import { RecommendationItem } from "../recommendation/recommendation.types";

export interface EndOfDayTimeContext {
    currentTime: string;
    currentDate: string;
    currentDayOfWeek: string;
    timezone: string;
}

export interface EndOfDayFocusSummary {
    state: FocusTimerState;
    todayFocusMinutes: number;
    totalFocusMinutes: number;
    completedSessionsCount: number;
    activeSession?: string;
    activeWorkspace?: string;
    description: string;
}

export interface EndOfDayProjectActivity {
    id: string;
    name: string;
    category: string;
    status: string;
    progress: number;
    description?: string;
}

export interface EndOfDayGoalProgress {
    id: string;
    title: string;
    type: "Weekly" | "Monthly";
    target: number;
    current: number;
    progressPercentage: number;
    completed: boolean;
}

export interface EndOfDayMemoryItem {
    id: string;
    category: string;
    content: string;
}

export interface EndOfDayCounts {
    completedTodayTasks: number;
    unfinishedTasks: number;
    overdueTasks: number;
    totalPendingTasks: number;
    activeProjects: number;
    activeGoals: number;
    todayFocusMinutes: number;
    completedFocusSessions: number;
}

export interface EndOfDayReview {
    /** ISO timestamp when the review was generated */
    generatedAt: string;
    /** Local system date & time details */
    timeContext: EndOfDayTimeContext;
    /** Tasks completed today according to canonical completedAt timestamp or state */
    completedTasks: TaskItemSummary[];
    /** Incomplete tasks due today */
    unfinishedTasks: TaskItemSummary[];
    /** Tasks genuinely overdue prior to today */
    overdueTasks: TaskItemSummary[];
    /** Other pending tasks */
    pendingTasks: TaskItemSummary[];
    /** Focus & coding session duration and metadata */
    focusSummary: EndOfDayFocusSummary;
    /** Active project activity */
    projectActivity: EndOfDayProjectActivity[];
    /** Goal progress */
    goalProgress: EndOfDayGoalProgress[];
    /** Bounded workstation activity history */
    recentActivity: ActivityItemSummary[];
    /** Relevant user preferences/facts (passive data only) */
    relevantMemories: EndOfDayMemoryItem[];
    /** Grounded tactical recommendations (bounded 1-3) */
    recommendations: RecommendationItem[];
    /** Aggregate counts */
    counts: EndOfDayCounts;
    /** Detailed natural language summary for terminal and UI display */
    conciseSummary: string;
    /** Concise natural language summary sanitized for Text-to-Speech */
    spokenSummary: string;
    /** True if no tasks were completed, no focus sessions logged, no active tasks/projects */
    isEmpty: boolean;
}

export interface EndOfDayReviewOptions {
    /** Optional explicit query */
    query?: string;
    /** Optional simulated timestamp */
    now?: Date;
    /** Bound on task items (default: 5) */
    tasksLimit?: number;
    /** Bound on project items (default: 3) */
    projectsLimit?: number;
    /** Bound on goal items (default: 3) */
    goalsLimit?: number;
    /** Bound on memory items (default: 3) */
    memoriesLimit?: number;
    /** Override context objects for unit test isolation */
    context?: Record<string, unknown>;
}
