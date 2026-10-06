/**
 * ALFRED Phase 5.5C — Proactive Intelligence Domain Types
 *
 * Defines strongly-typed structures for lightweight, explainable,
 * user-controlled proactive suggestions derived strictly from factual AgentContextSnapshot.
 *
 * ARCHITECTURAL BOUNDARY:
 * - Read-Only: Proactive suggestions observe state and suggest optional actions.
 * - Non-Autonomous: Never executes tools or mutates productivity state autonomously.
 * - Explicit User Choice: Any action execution must route through CommandAgent -> ToolRegistry.
 */

export type ProactiveSuggestionType =
    | "overdue_work"
    | "due_today_work"
    | "active_focus"
    | "paused_focus"
    | "active_project_stale"
    | "active_goal_pending"
    | "stale_activity"
    | "completed_work_next_step";

export interface ProactiveAction {
    label: string;
    command: string;
    type: "command" | "navigate" | "dismiss";
}

export interface ProactiveSuggestion {
    id: string;
    type: ProactiveSuggestionType;
    title: string;
    message: string;
    rationale: string;
    suggestedAction?: ProactiveAction;
    relatedEntityId?: string;
    relatedEntityType?: "task" | "project" | "goal" | "workspace" | "focus";
    priority?: "low" | "medium" | "high";
    createdAt: string;
    dismissed?: boolean;
    cooldownKey: string;
}

export interface ProactiveEvaluationResult {
    suggestions: ProactiveSuggestion[];
    activeSuggestion: ProactiveSuggestion | null;
    evaluatedAt: string;
}

export interface ProactiveCooldownState {
    lastSurfacedAt: number;
    dismissedAt?: number;
}
