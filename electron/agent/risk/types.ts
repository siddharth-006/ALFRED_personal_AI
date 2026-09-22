import { AgentPlan } from "../orchestrator/types";
import { ToolExecutionOptions } from "../tools/types";

/**
 * Risk Assessment Levels (Phase 4.16)
 *
 * - "low": Read-only actions, navigation, application launches, answer mode.
 * - "medium": Single controlled productivity mutation (create_task, update_goal, etc.).
 * - "high": Multiple productivity mutations (2+ mutation steps). User confirmation strictly required.
 */
export type RiskLevel = "low" | "medium" | "high";

export interface AffectedEntity {
    type: "task" | "goal" | "project" | "workspace" | "app";
    id?: string;
    name?: string;
}

export interface RiskEvaluationResult {
    /** Deterministic risk classification */
    riskLevel: RiskLevel;
    /** Alias for riskLevel */
    level: RiskLevel;
    /** Whether execution MUST pause until explicit user confirmation */
    requiresConfirmation: boolean;
    /** Total number of mutation tool calls in the plan */
    mutationCount: number;
    /** Whitelisted mutation tool names present in the plan */
    mutationTools: string[];
    /** Safe summary of affected entities (tasks, goals, projects) */
    affectedEntities?: AffectedEntity[];
    /** Human-readable deterministic rationale for the risk assessment */
    reason: string;
    /** Alias for reason */
    summary: string;
}

export interface PendingConfirmation {
    /** Cryptographically stable or unique confirmation identifier */
    id: string;
    /** Original user request string */
    userRequest: string;
    /** Exact validated AgentPlan to be executed once confirmed */
    plan: AgentPlan;
    /** Risk evaluation details */
    risk: RiskEvaluationResult;
    /** Execution context passed from command invocation */
    context?: Record<string, unknown>;
    /** Execution options passed from command invocation */
    options?: ToolExecutionOptions;
    /** Timestamp when the pending confirmation was created */
    createdAt: number;
    /** Expiration timestamp (TTL) */
    expiresAt: number;
}
