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
    | "recommendation"
    | "pending_confirmation"
    | "agentic_plan"
    | "routine"
    | "briefing"
    | "review"
    | "weekly_review"
    | "weekly_planning"
    | "schedule"
    | "automation"
    | "knowledge_search"
    | "knowledge_import"
    | "desktop_context"
    | "settings"
    | "memory_proposal"
    | "memory_confirmed"
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
import { RecommendationResult, RecommendationItem } from "./recommendation/recommendation.types";
import { AgenticPlan } from "./planning/agentic-plan.types";
import { AgentContextSnapshot } from "./agent-context/agent-context.types";
import { MemoryProposal, MemoryItem } from "./memory/memory.types";
import { Routine } from "./routines/routine.types";
import { MorningBriefing } from "./briefing/briefing.types";
import { EndOfDayReview } from "./review/review.types";
import { WeeklyReview, WeeklyPlanProposal } from "./review/weekly-review.types";
import { ScheduledRoutine } from "./scheduler/scheduler.types";
import { AutomationRule } from "./automation/automation.types";

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
    /** Phase 5.5B: Grounded recommendations if query was advisory */
    recommendations?: RecommendationItem[];
    recommendationResult?: RecommendationResult;
    /** Sequence of step-by-step execution results for multi-step plans */
    steps?: AgentToolCallResult[];
    totalSteps?: number;
    executedSteps?: number;
    /** Number of steps skipped due to failed prerequisites (Phase 4.15) */
    skippedSteps?: number;
    plan?: AgentPlan;
    /** Phase 5.6: Strongly-typed agentic multi-step execution plan */
    agenticPlan?: AgenticPlan;
    /** Phase 5.6 & 5.7: Fresh context snapshot captured post-execution */
    agentSnapshot?: AgentContextSnapshot;
    /** Phase 5.8A: Routine definition if triggered via daily routine */
    routine?: Routine;
    /** Phase 5.8B: Read-only morning briefing overview */
    briefing?: MorningBriefing;
    /** Phase 5.8D: Read-only end-of-day review */
    review?: EndOfDayReview;
    /** Phase 5.10: Read-only weekly review */
    weeklyReview?: WeeklyReview;
    /** Phase 5.10: Weekly planning proposal */
    weeklyPlan?: WeeklyPlanProposal;
    /** Phase 5.10: Single schedule item */
    schedule?: ScheduledRoutine;
    /** Phase 5.10: List of schedules */
    schedules?: ScheduledRoutine[];
    /** Phase 5.10: Single automation rule */
    automation?: AutomationRule;
    /** Phase 5.10: List of automation rules */
    automations?: AutomationRule[];
    /** Phase 5.7: Memory proposal awaiting explicit confirmation */
    memoryProposal?: MemoryProposal;
    memoryAction?: "remember" | "forget" | "update";
    memoryItem?: MemoryItem;
    spokenPrompt?: string;
    /** Whether execution is paused awaiting user confirmation (Phase 4.16 & Phase 5.6) */
    requiresConfirmation?: boolean;
    /** Stable identifier of the pending confirmation session */
    confirmationId?: string;
    /** Deterministic risk assessment of the proposed plan */
    risk?: RiskEvaluationResult;
    /** Phase 6.1: Knowledge RAG search results & citations */
    knowledgeResults?: import("../knowledge/knowledge.types").KnowledgeSearchResult[];
    knowledgeDocument?: import("../knowledge/knowledge.types").KnowledgeDocument;
    /** Phase 6.1: Safe desktop context telemetry */
    desktopContext?: import("../services/desktop-context.types").SafeDesktopContext;
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
