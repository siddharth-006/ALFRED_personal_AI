/**
 * Command Agent Types & Interfaces (Phase 3.2 - Step 4)
 *
 * Defines structured action types, expanded intent types, resolved action types,
 * execution result types, and the interpreter adapter interface.
 */

export type CommandIntent =
    | "launch_application"
    | "navigate"
    | "system_status"
    | "start_deep_work"
    | "launch_workspace"
    | "show_tasks"
    | "create_task"
    | "complete_task"
    | "create_goal"
    | "update_goal"
    | "update_project"
    | "answer"
    | "pending_confirmation"
    | "cancelled"
    | "unknown";

export interface StructuredAction {
    intent: CommandIntent;
    target: string | null;
}

export interface ResolvedCommandAction {
    success: boolean;
    intent: CommandIntent;
    target: string | null;
    executable: string | null;
    error?: string;
}

import { AgentPlan, AgentToolCallResult } from "./orchestrator/types";
import { RiskEvaluationResult } from "./risk/types";

export interface CommandExecutionResult {
    success: boolean;
    intent: CommandIntent;
    appName: string | null;
    executable: string | null;
    executed: boolean;
    error?: string;
    providerId?: string;
    fallbackUsed?: boolean;
    explanation?: string;
    responseType?: "action" | "answer";
    answerText?: string;
    data?: unknown;
    task?: unknown;
    goal?: unknown;
    project?: unknown;
    /** Sequence of step-by-step execution results for multi-step plans */
    steps?: AgentToolCallResult[];
    totalSteps?: number;
    executedSteps?: number;
    /** Number of steps skipped due to failed prerequisites (Phase 4.15) */
    skippedSteps?: number;
    plan?: AgentPlan;
    /** Whether execution is paused awaiting user confirmation (Phase 4.16) */
    requiresConfirmation?: boolean;
    /** Stable identifier of the pending confirmation session */
    confirmationId?: string;
    /** Deterministic risk assessment of the proposed plan */
    risk?: RiskEvaluationResult;
    /** Whether the action was explicitly cancelled by the user */
    cancelled?: boolean;
    /** Whether the action was explicitly confirmed and authorized by the user (Phase 4.16) */
    confirmed?: boolean;
}

export interface ICommandInterpreter {
    /**
     * Interprets a natural language prompt into a safe, structured action.
     * @param input Raw user prompt string
     * @returns Promise<StructuredAction> or StructuredAction
     */
    interpret(input: string): Promise<StructuredAction> | StructuredAction;
}
