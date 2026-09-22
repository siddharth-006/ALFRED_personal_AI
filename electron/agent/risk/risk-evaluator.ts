import { AgentPlan } from "../orchestrator/types";
import { RiskEvaluationResult, AffectedEntity } from "./types";

/** Whitelisted productivity mutation tool names supported in ALFRED */
export const MUTATION_TOOLS = new Set([
    "create_task",
    "complete_task",
    "create_goal",
    "update_goal",
    "update_project",
]);

/**
 * Checks whether a given tool name is a state-mutating operation.
 */
export function isMutationTool(toolName: string): boolean {
    return MUTATION_TOOLS.has(toolName);
}

/**
 * Safely extracts affected entities from tool arguments for UI display.
 */
function extractAffectedEntities(plan: AgentPlan): AffectedEntity[] {
    const entities: AffectedEntity[] = [];

    for (const call of plan.toolCalls) {
        const tool = call.tool;
        const args = (call.arguments || {}) as Record<string, unknown>;

        if (tool === "create_task") {
            const text = String(args.text || args.title || "").trim();
            entities.push({ type: "task", name: text || "New Task" });
        } else if (tool === "complete_task") {
            const taskId = String(args.taskId || args.id || "").trim();
            entities.push({ type: "task", id: taskId });
        } else if (tool === "create_goal") {
            const title = String(args.title || "").trim();
            entities.push({ type: "goal", name: title || "New Goal" });
        } else if (tool === "update_goal") {
            const goalId = String(args.goalId || args.id || "").trim();
            const title = String(args.title || "").trim();
            entities.push({ type: "goal", id: goalId, name: title || undefined });
        } else if (tool === "update_project") {
            const projectId = String(args.projectId || args.id || "").trim();
            const name = String(args.name || "").trim();
            entities.push({ type: "project", id: projectId, name: name || undefined });
        }
    }

    return entities;
}

/**
 * Evaluates the deterministic risk level of an already-validated AgentPlan (Phase 4.16).
 *
 * DETERMINISTIC POLICY:
 * - Answer Mode / 0 tools -> LOW (no confirmation)
 * - Read-only / non-mutating actions -> LOW (no confirmation)
 * - Single productivity mutation -> MEDIUM (no confirmation)
 * - 2+ productivity mutations -> HIGH (CONFIRMATION REQUIRED)
 *
 * GUARANTEES:
 * - AI Providers CANNOT override or influence this risk evaluation.
 * - Entirely deterministic based on tool catalog taxonomy and step counts.
 */
export function evaluatePlanRisk(plan: AgentPlan): RiskEvaluationResult {
    // 1. Answer Mode plans or empty plans are strictly LOW risk
    if (plan.type === "answer" || !plan.toolCalls || plan.toolCalls.length === 0) {
        const reason = "Informational answer plan contains no tool execution.";
        return {
            riskLevel: "low",
            level: "low",
            requiresConfirmation: false,
            mutationCount: 0,
            mutationTools: [],
            reason,
            summary: reason,
        };
    }

    // 2. Tally productivity mutation tool calls
    const mutationCalls = plan.toolCalls.filter((call) => isMutationTool(call.tool));
    const mutationTools = mutationCalls.map((c) => c.tool);
    const mutationCount = mutationCalls.length;
    const affectedEntities = extractAffectedEntities(plan);

    // 3. Low Risk: Zero mutations (read-only, navigation, app launch, workspace launch, deep work)
    if (mutationCount === 0) {
        const reason = "Plan contains only read-only, navigation, focus, or launching actions.";
        return {
            riskLevel: "low",
            level: "low",
            requiresConfirmation: false,
            mutationCount: 0,
            mutationTools: [],
            affectedEntities: affectedEntities.length > 0 ? affectedEntities : undefined,
            reason,
            summary: reason,
        };
    }

    // 4. Medium Risk: Exactly one controlled productivity mutation
    if (mutationCount === 1) {
        const singleTool = mutationTools[0];
        const reason = `Plan contains a single controlled productivity mutation (${singleTool}). Safe to execute directly.`;
        return {
            riskLevel: "medium",
            level: "medium",
            requiresConfirmation: false,
            mutationCount: 1,
            mutationTools,
            affectedEntities: affectedEntities.length > 0 ? affectedEntities : undefined,
            reason,
            summary: reason,
        };
    }

    // 5. High Risk: Multiple productivity mutations (2 or more)
    const reason = `Plan contains ${mutationCount} productivity mutations (${mutationTools.join(", ")}). User confirmation required before execution.`;
    return {
        riskLevel: "high",
        level: "high",
        requiresConfirmation: true,
        mutationCount,
        mutationTools,
        affectedEntities: affectedEntities.length > 0 ? affectedEntities : undefined,
        reason,
        summary: reason,
    };
}
