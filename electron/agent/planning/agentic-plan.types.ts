/**
 * ALFRED Phase 5.6: Agentic Planning Domain Types
 *
 * Defines the strongly-typed architecture for agentic multi-step planning,
 * step dependencies, status tracking, preview generation, and controlled execution.
 */

import { AgentPlan, AgentToolCall, AgentToolCallResult } from "../orchestrator/types";
import { RiskLevel, RiskEvaluationResult } from "../risk/types";

export type AgenticPlanStatus =
    | "proposed"
    | "awaiting_confirmation"
    | "approved"
    | "executing"
    | "completed"
    | "partially_completed"
    | "failed"
    | "cancelled"
    | "expired";

export interface AgenticPlanStep {
    /** Unique step ID (e.g. "step-0", "step-1") */
    id: string;
    /** 0-indexed sequence position */
    index: number;
    /** Human-readable description of this step */
    description: string;
    /** Category of action */
    actionType: "tool_call" | "navigation" | "focus" | "mutation";
    /** Target tool in ToolRegistry */
    tool: string;
    /** Validated tool arguments */
    arguments: Record<string, unknown>;
    /** Optional indexes of prerequisite steps */
    dependsOn?: number[];
    /** Risk classification of this specific step */
    riskLevel: RiskLevel;
    /** Whether this step mutates user productivity data */
    requiresConfirmation: boolean;
    /** Execution status of this step */
    status: "pending" | "executing" | "completed" | "skipped" | "failed";
    /** Execution output or error result */
    result?: AgentToolCallResult;
}

export interface AgenticPlan {
    /** Unique confirmation/plan ID */
    id: string;
    /** User's high-level objective */
    objective: string;
    /** Explanation or conversational rationale */
    explanation: string;
    /** Formatted preview of proposed steps for display and voice */
    previewSummary: string;
    /** Natural speech prompt for voice approval */
    spokenPrompt: string;
    /** Ordered steps to execute upon approval */
    steps: AgenticPlanStep[];
    /** Current lifecycle status */
    status: AgenticPlanStatus;
    /** Timestamp created (ms) */
    createdAt: number;
    /** Timestamp when plan expires (ms) */
    expiresAt: number;
    /** Associated snapshot ID for state auditing */
    contextSnapshotId?: string;
    /** Evaluated risk result */
    risk: RiskEvaluationResult;
    /** Exact underlying validated AgentPlan for ToolRegistry execution */
    rawPlan: AgentPlan;
    /** Post-execution high-level summary */
    executionSummary?: string;
}

/**
 * Formats a clean human-readable description for a plan step.
 */
export function formatStepDescription(tool: string, args: Record<string, unknown>): string {
    switch (tool) {
        case "launch_application": {
            const app = String(args.appName || args.application || args.target || "application");
            return `Launch ${app}`;
        }
        case "launch_workspace": {
            const ws = String(args.workspaceName || args.workspace || args.name || "workspace");
            return `Launch ${ws} workspace`;
        }
        case "start_deep_work": {
            const session = args.sessionName ? ` on "${args.sessionName}"` : "";
            const duration = args.durationMinutes ? ` (${args.durationMinutes} min)` : "";
            return `Start focus session${session}${duration}`;
        }
        case "show_tasks": {
            const filter = args.filter ? ` matching "${args.filter}"` : "";
            return `Show pending tasks${filter}`;
        }
        case "create_task": {
            const text = String(args.text || args.title || "new task");
            const cat = args.category ? ` [${args.category}]` : "";
            return `Create task: "${text}"${cat}`;
        }
        case "complete_task": {
            const id = String(args.taskId || args.id || "");
            return `Complete task ${id}`;
        }
        case "create_goal": {
            const title = String(args.title || "new goal");
            return `Create goal: "${title}"`;
        }
        case "update_goal": {
            const id = String(args.goalId || args.id || "");
            return `Update goal ${id}`;
        }
        case "update_project": {
            const name = String(args.name || args.projectId || "project");
            return `Update project "${name}"`;
        }
        case "navigate": {
            const target = String(args.target || args.route || "dashboard");
            return `Navigate to ${target}`;
        }
        case "system_status": {
            return "Check system vitals";
        }
        case "open_url": {
            return `Open URL: ${String(args.url || "")}`;
        }
        case "open_path": {
            return `Open path: ${String(args.path || "")}`;
        }
        default:
            return `Execute ${tool}`;
    }
}
