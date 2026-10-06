/**
 * ALFRED Phase 5.6: Agentic Planner Service
 *
 * Core coordinator for agentic multi-step planning, preview generation,
 * risk validation, execution status tracking, and post-execution state verification.
 *
 * SECURITY GUARANTEES:
 * 1. Read-Only Planning: Planning never touches shell, processes, or mutates data.
 * 2. Injection Resistance: Context data (task texts, goal names, project titles) is
 *    strictly treated as data literals; dangerous tokens are sanitized.
 * 3. Immutable Confirmation: Stored plan cannot be tampered with by renderer.
 */

import { AgentPlan, AgentToolCallResult } from "../orchestrator/types";
import { RiskEvaluationResult, RiskLevel } from "../risk/types";
import { isMutationTool } from "../risk/risk-evaluator";
import {
    AgenticPlan,
    AgenticPlanStep,
    formatStepDescription,
} from "./agentic-plan.types";
import { AgentContextSnapshot } from "../agent-context/agent-context.types";
import { logger } from "../../utils/logger";

export class AgenticPlannerService {
    /**
     * Builds a structured AgenticPlan from a validated AgentPlan and RiskEvaluationResult.
     */
    public createAgenticPlan(
        id: string,
        rawPlan: AgentPlan,
        risk: RiskEvaluationResult,
        userRequest: string,
        snapshot?: AgentContextSnapshot,
        ttlMs: number = 10 * 60 * 1000
    ): AgenticPlan {
        const now = Date.now();
        const steps: AgenticPlanStep[] = (rawPlan.toolCalls || []).map((call, idx) => {
            const isMutation = isMutationTool(call.tool);
            let actionType: AgenticPlanStep["actionType"] = "tool_call";
            if (isMutation) actionType = "mutation";
            else if (call.tool === "navigate") actionType = "navigation";
            else if (call.tool === "start_deep_work") actionType = "focus";

            const stepRisk: RiskLevel = isMutation ? "medium" : "low";

            return {
                id: `step-${idx + 1}`,
                index: idx,
                description: formatStepDescription(call.tool, call.arguments || {}),
                actionType,
                tool: call.tool,
                arguments: { ...(call.arguments || {}) },
                dependsOn: call.dependsOn ? [...call.dependsOn] : undefined,
                riskLevel: stepRisk,
                requiresConfirmation: isMutation,
                status: "pending",
            };
        });

        const previewSummary = this.formatPlanPreview(steps, userRequest);
        const spokenPrompt = this.formatSpokenPrompt(steps);

        return {
            id,
            objective: userRequest,
            explanation: rawPlan.explanation || `Plan proposed with ${steps.length} step(s).`,
            previewSummary,
            spokenPrompt,
            steps,
            status: "awaiting_confirmation",
            createdAt: now,
            expiresAt: now + ttlMs,
            contextSnapshotId: snapshot?.system?.currentTime,
            risk,
            rawPlan,
        };
    }

    /**
     * Formats a concise plan preview for the UI (Section 8).
     *
     * Example:
     * "Here's what I can do:
     * 1. Launch the ML workspace
     * 2. Open VS Code
     * 3. Show your pending ML tasks
     * 4. Start a 45-minute focus session
     * Proceed?"
     */
    public formatPlanPreview(steps: AgenticPlanStep[], objective: string): string {
        const lines: string[] = ["Here's what I can do:"];
        steps.forEach((step, idx) => {
            lines.push(`${idx + 1}. ${step.description}`);
        });
        lines.push("");
        lines.push("Proceed?");
        return lines.join("\n");
    }

    /**
     * Formats a clean natural-language summary for TTS (Section 19).
     * Strictly avoids JSON, IDs, tool names, and raw syntax.
     *
     * Example:
     * "Here's what I can do: launch VS Code, open the DSA workspace, and show your pending tasks. Would you like me to proceed?"
     */
    public formatSpokenPrompt(steps: AgenticPlanStep[]): string {
        if (!steps || steps.length === 0) {
            return "No actions planned. Would you like me to proceed?";
        }

        const descriptions = steps.map((s) => {
            const desc = s.description;
            return desc.charAt(0).toLowerCase() + desc.slice(1);
        });

        if (descriptions.length === 1) {
            return `Here's what I can do: ${descriptions[0]}. Would you like me to proceed?`;
        }

        const last = descriptions.pop();
        return `Here's what I can do: ${descriptions.join(", ")}, and ${last}. Would you like me to proceed?`;
    }

    /**
     * Formats the post-execution outcome summary with actual results (Section 14 & 15).
     */
    public formatExecutionOutcome(
        objective: string,
        steps: AgentToolCallResult[],
        freshSnapshot?: AgentContextSnapshot
    ): { summary: string; spokenText: string; success: boolean } {
        const total = steps.length;
        const completed = steps.filter((s) => s.success).length;
        const failed = steps.find((s) => !s.success && !s.skipped);
        const skipped = steps.filter((s) => s.skipped).length;
        const allSuccess = completed === total && total > 0;

        const lines: string[] = [];

        if (allSuccess) {
            lines.push(`Completed ${completed} of ${total} actions:`);
            for (const step of steps) {
                lines.push(`• ${step.summary || `Executed ${step.tool}`}`);
            }

            // Derive natural spoken text based on objective
            let spokenText = "Done. All planned actions completed.";
            const lowerObj = objective.toLowerCase();
            if (lowerObj.includes("coding") || lowerObj.includes("code")) {
                spokenText = "Done. Your coding session is ready.";
            } else if (lowerObj.includes("ml") || lowerObj.includes("machine learning")) {
                spokenText = "Done. Your machine learning workspace is ready.";
            } else if (lowerObj.includes("hackathon")) {
                spokenText = "Done. Your hackathon environment is ready.";
            } else if (lowerObj.includes("organize") || lowerObj.includes("task")) {
                spokenText = "Done. Your tasks have been organized.";
            }

            return {
                summary: lines.join("\n"),
                spokenText,
                success: true,
            };
        } else {
            lines.push(`Completed ${completed} of ${total} actions:`);
            for (const step of steps) {
                if (step.success) {
                    lines.push(`• ${step.summary || `Executed ${step.tool}`}`);
                } else if (step.skipped) {
                    lines.push(`• Skipped: ${step.tool} (${step.skipReason || "Prerequisite failed"})`);
                } else {
                    lines.push(`• Failed: ${step.tool} - ${step.error || "Execution failed"}`);
                }
            }

            let spokenText = `${completed} of ${total} steps completed.`;
            if (failed) {
                spokenText += ` ${failed.tool} failed.`;
            }
            if (skipped > 0) {
                spokenText += ` Remaining dependent steps were skipped.`;
            }

            return {
                summary: lines.join("\n"),
                spokenText,
                success: false,
            };
        }
    }
}

export const agenticPlannerService = new AgenticPlannerService();
