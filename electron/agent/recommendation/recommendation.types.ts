/**
 * ALFRED Phase 5.5B — Recommendation Agent Types
 *
 * Defines the strongly-typed domain model for explainable, factual, read-only
 * personal recommendations based on the existing AgentContextSnapshot.
 *
 * ARCHITECTURAL GUARANTEES:
 * 1. Read-Only: Recommendations are advisory only.
 * 2. Grounded: Uses observable state only. No artificial scores or fake priorities.
 * 3. Human-friendly: Concise title and observable factual rationale.
 */

export type RecommendationCategory =
    | "focus"
    | "task"
    | "project"
    | "goal"
    | "workspace"
    | "general"
    | "overdue_task"
    | "due_today_task"
    | "high_priority_task"
    | "active_project"
    | "active_goal"
    | "focus_session"
    | "empty_state";

export interface RecommendationSignal {
    field: string;
    value: string | number | boolean;
    explanation: string;
}

export interface RecommendationItem {
    id: string;
    title: string;
    description: string;
    rationale: string;
    category: RecommendationCategory;
    relatedEntityId?: string;
    relatedEntityType?: "task" | "project" | "goal" | "workspace" | "focus";
    suggestedAction?: string;
    signals: RecommendationSignal[];
}

export interface RecommendationResult {
    generatedAt: string;
    recommendations: RecommendationItem[];
    summary: string;
    hasRecommendations: boolean;
    hasPendingPriorities?: boolean;
}
