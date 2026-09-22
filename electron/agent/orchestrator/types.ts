/**
 * Agent Orchestration Architecture Types (Phase 3.3 - Step 2)
 *
 * Defines the core types, structured plan definitions, tool call results,
 * execution results, and planner adapter interface for agent tool orchestration.
 */

export interface AgentToolCall {
    /** Target tool registered in Tool Registry (e.g. "launch_application") */
    tool: string;
    /** Parameter arguments for the tool execution */
    arguments: Record<string, unknown>;
    /** Optional list of earlier step indexes this step depends on (Phase 4.15) */
    dependsOn?: number[];
}

export interface AgentPlan {
    /** Raw natural-language user prompt */
    userRequest: string;
    /** Sequence of structured tool calls produced by the agent planner */
    toolCalls: AgentToolCall[];
    /** Rationale or narrative explanation of the plan */
    explanation?: string;
    /** Response type: "action" for tool plans or "answer" for informational text answers */
    type?: "action" | "answer";
    /** Direct textual answer response if response type is "answer" */
    answerText?: string;
}

/** Strict maximum number of tool calls allowed per multi-step plan (Phase 4.14) */
export const MAX_AGENT_PLAN_STEPS = 5;

/** Safe structured context passed from prerequisite steps to dependent steps (Phase 4.15) */
export interface SafeDependencyContext {
    id?: string;
    name?: string;
    type?: string;
    status?: string;
    progress?: number;
    taskId?: string;
    goalId?: string;
    projectId?: string;
    workspaceId?: string;
}

export interface AgentToolCallResult {
    /** 0-indexed step sequence number in the plan */
    index?: number;
    /** Name of the executed tool */
    tool: string;
    /** Arguments passed to the tool */
    arguments: Record<string, unknown>;
    /** Execution success status */
    success: boolean;
    /** Output data returned by the tool execution */
    data?: unknown;
    /** Error message if tool execution or validation failed */
    error?: string;
    /** Safe, human-readable summary of the step result */
    summary?: string;
    /** Whether this step was skipped due to prerequisite failure (Phase 4.15) */
    skipped?: boolean;
    /** Reason why the step was skipped (Phase 4.15) */
    skipReason?: string;
    /** Declared dependencies for this step (Phase 4.15) */
    dependsOn?: number[];
}

export interface AgentExecutionResult {
    /** Overall execution success across all tool calls */
    success: boolean;
    /** Original user request string */
    userRequest: string;
    /** Agent plan produced by the planner */
    plan: AgentPlan;
    /** Detailed array of execution results for each tool call */
    results: AgentToolCallResult[];
    /** Structured step-by-step results for multi-step execution */
    steps?: AgentToolCallResult[];
    /** Summary error message if orchestration or tool calls failed */
    error?: string;
    /** Safe high-level summary of the execution outcome */
    summary?: string;
    /** Total steps originally planned */
    totalSteps?: number;
    /** Total steps actually executed before completion or failure */
    executedSteps?: number;
    /** Number of steps skipped due to prerequisite failures (Phase 4.15) */
    skippedSteps?: number;
}

export interface IAgentPlanner {
    /**
     * Translates a natural language user request into a structured AgentPlan.
     * Must NOT directly execute OS commands or system primitives.
     *
     * @param userRequest Raw prompt text
     * @returns Promise<AgentPlan> or AgentPlan
     */
    plan(
        userRequest: string,
        context?: Record<string, unknown>
    ): Promise<AgentPlan> | AgentPlan;
}
