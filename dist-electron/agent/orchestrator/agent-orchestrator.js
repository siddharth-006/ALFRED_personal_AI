"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentOrchestrator = exports.AgentOrchestrator = void 0;
exports.extractSafeStepContext = extractSafeStepContext;
exports.applySafeDependencyContext = applySafeDependencyContext;
const types_1 = require("./types");
const mock_planner_1 = require("./mock-planner");
const tool_registry_1 = require("../tools/tool-registry");
const logger_1 = require("../../utils/logger");
const plan_validator_1 = require("../providers/impl/plan-validator");
/**
 * Safely extracts non-sensitive structured fields from tool execution data (Phase 4.15).
 * Strictly forbids secrets, credentials, shell commands, and raw internal objects.
 */
function extractSafeStepContext(tool, args, data) {
    const safe = {};
    const dataObj = (data && typeof data === "object" ? data : {});
    switch (tool) {
        case "create_task":
        case "complete_task": {
            const task = (dataObj.task && typeof dataObj.task === "object" ? dataObj.task : {});
            const taskId = String(task.id || args.taskId || args.id || "").trim();
            const taskText = String(task.text || args.text || args.title || "").trim();
            if (taskId) {
                safe.id = taskId;
                safe.taskId = taskId;
            }
            if (taskText) {
                safe.name = taskText;
            }
            safe.type = "task";
            safe.status = task.completed ? "completed" : "pending";
            break;
        }
        case "create_goal":
        case "update_goal": {
            const goal = (dataObj.goal && typeof dataObj.goal === "object" ? dataObj.goal : {});
            const goalId = String(goal.id || args.goalId || args.id || "").trim();
            const title = String(goal.title || args.title || "").trim();
            if (goalId) {
                safe.id = goalId;
                safe.goalId = goalId;
            }
            if (title) {
                safe.name = title;
            }
            safe.type = "goal";
            if (typeof goal.target === "number" && goal.target > 0 && typeof goal.current === "number") {
                safe.progress = Math.min(100, Math.round((goal.current / goal.target) * 100));
            }
            safe.status = goal.completed ? "completed" : "in-progress";
            break;
        }
        case "update_project": {
            const proj = (dataObj.project && typeof dataObj.project === "object" ? dataObj.project : {});
            const projId = String(proj.id || args.projectId || args.id || "").trim();
            const name = String(proj.name || args.name || "").trim();
            if (projId) {
                safe.id = projId;
                safe.projectId = projId;
            }
            if (name) {
                safe.name = name;
            }
            safe.type = "project";
            if (typeof proj.progress === "number") {
                safe.progress = proj.progress;
            }
            if (typeof proj.status === "string") {
                safe.status = proj.status;
            }
            break;
        }
        case "launch_workspace": {
            const wsId = String(dataObj.workspaceId || "").trim();
            const wsName = String(args.workspaceName || args.workspace || args.name || wsId || "").trim();
            if (wsId) {
                safe.workspaceId = wsId;
                safe.id = wsId;
            }
            if (wsName) {
                safe.name = wsName;
                if (!safe.workspaceId)
                    safe.workspaceId = wsName;
            }
            safe.type = "workspace";
            break;
        }
        case "launch_application": {
            const app = String(args.appName || args.application || args.target || "").trim();
            if (app) {
                safe.name = app;
                safe.id = app;
            }
            safe.type = "application";
            break;
        }
        case "start_deep_work": {
            const session = String(dataObj.session || args.sessionName || args.session || "").trim();
            if (session) {
                safe.name = session;
            }
            safe.type = "deep_work";
            break;
        }
        default: {
            safe.type = tool;
            break;
        }
    }
    return safe;
}
/**
 * Merges safe dependency contexts and populates supported tool parameters (Phase 4.15).
 * Only supported, validated tool arguments are ever populated.
 */
function applySafeDependencyContext(tool, rawArgs, contexts) {
    const args = { ...rawArgs };
    if (contexts.length === 0)
        return args;
    const merged = {};
    for (const ctx of contexts) {
        Object.assign(merged, ctx);
    }
    // Resolve safe placeholder variables if present
    for (const key of Object.keys(args)) {
        const val = args[key];
        if (typeof val === "string") {
            if (val === "$prev.id" || val === "$0.id" || val === "$context.id") {
                if (merged.id)
                    args[key] = merged.id;
            }
            else if (val === "$prev.taskId" || val === "$0.taskId" || val === "$context.taskId") {
                if (merged.taskId || merged.id)
                    args[key] = (merged.taskId || merged.id);
            }
            else if (val === "$prev.name" || val === "$0.name" || val === "$context.name") {
                if (merged.name)
                    args[key] = merged.name;
            }
            else if (val === "$prev.workspaceId" || val === "$0.workspaceId" || val === "$context.workspaceId") {
                if (merged.workspaceId || merged.name)
                    args[key] = (merged.workspaceId || merged.name);
            }
            else if (val === "$prev.goalId" || val === "$0.goalId" || val === "$context.goalId") {
                if (merged.goalId || merged.id)
                    args[key] = (merged.goalId || merged.id);
            }
            else if (val === "$prev.projectId" || val === "$0.projectId" || val === "$context.projectId") {
                if (merged.projectId || merged.id)
                    args[key] = (merged.projectId || merged.id);
            }
        }
    }
    // Tool-specific safe argument derivation
    switch (tool) {
        case "start_deep_work": {
            if (!args.sessionName || args.sessionName === "" || args.sessionName === "focus" || args.sessionName === "dsa") {
                if (merged.name) {
                    args.sessionName = merged.name;
                }
                else if (merged.workspaceId) {
                    args.sessionName = merged.workspaceId;
                }
                else if (merged.taskId) {
                    args.sessionName = merged.taskId;
                }
            }
            break;
        }
        case "complete_task": {
            if (!args.taskId || args.taskId === "latest" || args.taskId === "$prev.taskId") {
                if (merged.taskId || (merged.type === "task" && merged.id)) {
                    args.taskId = merged.taskId || merged.id;
                }
            }
            break;
        }
        case "launch_workspace": {
            if (!args.workspaceName && !args.workspace) {
                if (merged.workspaceId || (merged.type === "workspace" && merged.name)) {
                    args.workspaceName = merged.workspaceId || merged.name;
                }
            }
            break;
        }
        case "update_goal": {
            if (!args.goalId || args.goalId === "latest") {
                if (merged.goalId || (merged.type === "goal" && merged.id)) {
                    args.goalId = merged.goalId || merged.id;
                }
            }
            break;
        }
        case "update_project": {
            if (!args.projectId || args.projectId === "latest") {
                if (merged.projectId || (merged.type === "project" && merged.id)) {
                    args.projectId = merged.projectId || merged.id;
                }
            }
            break;
        }
    }
    return args;
}
/**
 * Agent Orchestrator (Phase 3.3 - Step 2 & Phase 4.14)
 *
 * Coordinates the full agent execution lifecycle:
 * 1. Obtains structured AgentPlan from IAgentPlanner (mock or LLM adapter)
 * 2. Enforces strict MAX_AGENT_PLAN_STEPS bounds (max 5 tool calls)
 * 3. Validates requested tools against ToolRegistry
 * 4. Executes approved tools sequentially in exact plan order
 * 5. Halts execution immediately if any step fails without executing subsequent steps
 * 6. Aggregates results and returns structured AgentExecutionResult with step-level tracking
 *
 * GUARANTEES:
 * - NEVER calls child_process, spawn, exec, or shell APIs directly.
 * - All actions strictly pass through ToolRegistry execution boundaries.
 */
class AgentOrchestrator {
    planner;
    registry;
    constructor(planner, registry) {
        this.planner = planner || mock_planner_1.mockAgentPlanner;
        this.registry = registry || tool_registry_1.toolRegistry;
    }
    /**
     * Swaps the active agent planner implementation.
     * @param planner IAgentPlanner implementation
     */
    setPlanner(planner) {
        this.planner = planner;
        logger_1.logger.info("AgentOrchestrator: Swapped active agent planner adapter.");
    }
    /**
     * Swaps the active tool registry implementation.
     * @param registry ToolRegistry instance
     */
    setRegistry(registry) {
        this.registry = registry;
        logger_1.logger.info("AgentOrchestrator: Swapped active tool registry instance.");
    }
    /**
     * Formats a safe, structured summary of a single tool execution step.
     */
    formatStepSuccessSummary(tool, args, data) {
        switch (tool) {
            case "create_task": {
                const text = String(args.text || args.title || "New Task");
                return `Created task: ${text}`;
            }
            case "complete_task": {
                const taskId = String(args.taskId || args.id || "");
                const taskObj = data?.task;
                const taskText = taskObj?.text ? String(taskObj.text) : taskId;
                return `Completed task: ${taskText}`;
            }
            case "create_goal": {
                const title = String(args.title || "New Goal");
                return `Created goal: ${title}`;
            }
            case "update_goal": {
                const goalId = String(args.goalId || args.id || "");
                return `Updated goal: ${goalId}`;
            }
            case "update_project": {
                const projectId = String(args.projectId || args.id || "");
                return `Updated project: ${projectId}`;
            }
            case "launch_application": {
                const app = String(args.appName || args.application || "Application");
                return `Opened application: ${app}`;
            }
            case "launch_workspace": {
                const ws = String(args.workspaceName || args.workspace || args.name || "Workspace");
                return `Opened ${ws} workspace`;
            }
            case "start_deep_work": {
                const session = String(args.sessionName || args.session || "focus session");
                return `Started deep work: ${session}`;
            }
            case "navigate": {
                const target = String(args.target || args.view || "view");
                return `Navigated to ${target}`;
            }
            case "show_tasks":
                return "Displayed tasks";
            case "system_status":
                return "Queried system status";
            case "open_url":
                return `Opened URL: ${String(args.url || "")}`;
            case "open_path":
                return `Opened path: ${String(args.path || "")}`;
            default:
                return `Executed ${tool}`;
        }
    }
    /**
     * Translates a natural language request into a structured AgentPlan using the active planner.
     */
    async plan(userRequest, options) {
        return await this.planner.plan(userRequest, options?.context);
    }
    /**
     * Processes a natural language request through planning, validation, and sequential execution.
     *
     * @param userRequest Natural language prompt string
     * @param options Execution options (e.g. { isMock: true })
     * @returns Promise<AgentExecutionResult>
     */
    async execute(userRequest, options) {
        logger_1.logger.info(`AgentOrchestrator: Initiating orchestration for -> "${userRequest}"`);
        if (typeof userRequest !== "string" || !userRequest.trim()) {
            const emptyPlan = {
                userRequest: String(userRequest || ""),
                toolCalls: [],
                explanation: "User request is empty.",
            };
            return {
                success: false,
                userRequest: String(userRequest || ""),
                plan: emptyPlan,
                results: [],
                steps: [],
                totalSteps: 0,
                executedSteps: 0,
                error: "User request cannot be empty.",
            };
        }
        // Step 1: Obtain plan from planner adapter
        let plan;
        try {
            plan = await this.plan(userRequest, options);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Planning exception";
            logger_1.logger.error(`AgentOrchestrator: Planner error -> ${message}`);
            const fallbackPlan = {
                userRequest,
                toolCalls: [],
                explanation: `Planning failed: ${message}`,
            };
            return {
                success: false,
                userRequest,
                plan: fallbackPlan,
                results: [],
                steps: [],
                totalSteps: 0,
                executedSteps: 0,
                error: `Planning failed: ${message}`,
            };
        }
        return await this.executePlan(plan, options);
    }
    /**
     * Executes an already-validated AgentPlan directly through the ToolRegistry boundary (Phase 4.16).
     * Used after Confirmation Gate verification to guarantee exact, immutable execution.
     *
     * @param plan Validated AgentPlan
     * @param options Execution options
     * @returns Promise<AgentExecutionResult>
     */
    async executePlan(plan, options) {
        const userRequest = plan.userRequest || "Execute Plan";
        // Step 2: Handle plans with no tool calls
        if (!plan.toolCalls || plan.toolCalls.length === 0) {
            logger_1.logger.warn(`AgentOrchestrator: Plan produced no tool calls for -> "${userRequest}"`);
            return {
                success: false,
                userRequest,
                plan,
                results: [],
                steps: [],
                totalSteps: 0,
                executedSteps: 0,
                error: plan.explanation || "No actionable tool calls were generated for this request.",
            };
        }
        // Step 3: Enforce strict MAX_AGENT_PLAN_STEPS limit (Phase 4.14)
        if (plan.toolCalls.length > types_1.MAX_AGENT_PLAN_STEPS) {
            const error = `Plan exceeds maximum allowed steps (${types_1.MAX_AGENT_PLAN_STEPS}). Found ${plan.toolCalls.length} steps.`;
            logger_1.logger.warn(`AgentOrchestrator: ${error}`);
            return {
                success: false,
                userRequest,
                plan,
                results: [],
                steps: [],
                totalSteps: plan.toolCalls.length,
                executedSteps: 0,
                skippedSteps: 0,
                error,
                summary: error,
            };
        }
        // Step 3b: Enforce dependency validation before execution (Phase 4.15)
        const depCheck = (0, plan_validator_1.validatePlanDependencies)(plan.toolCalls);
        if (!depCheck.valid) {
            const error = `Plan rejected: ${depCheck.error}`;
            logger_1.logger.warn(`AgentOrchestrator: ${error}`);
            return {
                success: false,
                userRequest,
                plan,
                results: [],
                steps: [],
                totalSteps: plan.toolCalls.length,
                executedSteps: 0,
                skippedSteps: 0,
                error,
                summary: error,
            };
        }
        // Step 4: Sequential tool execution loop with dependency-aware precondition checking
        const results = [];
        const stepContexts = new Map();
        let failedAtStepIndex = null;
        let failureError;
        let skippedCount = 0;
        logger_1.logger.info(`AgentOrchestrator: Executing ${plan.toolCalls.length} tool call(s) sequentially for plan -> "${userRequest}"`);
        for (let i = 0; i < plan.toolCalls.length; i++) {
            const call = plan.toolCalls[i];
            const declaredDeps = call.dependsOn || [];
            // Case A: A prior step failed. Check if this step depends on a failed or skipped step.
            if (failedAtStepIndex !== null) {
                const failedOrSkippedDep = declaredDeps.find((depIdx) => {
                    const prior = results.find((r) => r.index === depIdx);
                    return !prior || !prior.success || prior.skipped;
                });
                if (failedOrSkippedDep !== undefined) {
                    const depResult = results.find((r) => r.index === failedOrSkippedDep);
                    const depTool = plan.toolCalls[failedOrSkippedDep]?.tool || "prerequisite";
                    const skipReason = depResult?.skipped
                        ? `Prerequisite step ${failedOrSkippedDep + 1} (${depTool}) was skipped.`
                        : `Prerequisite step ${failedOrSkippedDep + 1} (${depTool}) failed.`;
                    logger_1.logger.warn(`AgentOrchestrator: Step ${i + 1}/${plan.toolCalls.length} ('${call.tool}') skipped because ${skipReason}`);
                    results.push({
                        index: i,
                        tool: call.tool || "unknown",
                        arguments: call.arguments || {},
                        success: false,
                        skipped: true,
                        skipReason,
                        dependsOn: declaredDeps,
                        summary: `Step ${i + 1} (${call.tool}) skipped: ${skipReason}`,
                    });
                    skippedCount++;
                }
                else {
                    // Unrelated step following an execution failure: Halt execution according to existing policy
                    logger_1.logger.info(`AgentOrchestrator: Step ${i + 1}/${plan.toolCalls.length} ('${call.tool}') not executed following prior step failure.`);
                }
                continue;
            }
            // Case B: No prior failure yet. Check prerequisites for this step.
            if (declaredDeps.length > 0) {
                const unfulfilledDep = declaredDeps.find((depIdx) => {
                    const prior = results.find((r) => r.index === depIdx);
                    return !prior || !prior.success || prior.skipped;
                });
                if (unfulfilledDep !== undefined) {
                    const depResult = results.find((r) => r.index === unfulfilledDep);
                    const depTool = plan.toolCalls[unfulfilledDep]?.tool || "prerequisite";
                    const skipReason = depResult?.skipped
                        ? `Prerequisite step ${unfulfilledDep + 1} (${depTool}) was skipped.`
                        : `Prerequisite step ${unfulfilledDep + 1} (${depTool}) failed.`;
                    logger_1.logger.warn(`AgentOrchestrator: Step ${i + 1}/${plan.toolCalls.length} ('${call.tool}') skipped because ${skipReason}`);
                    results.push({
                        index: i,
                        tool: call.tool || "unknown",
                        arguments: call.arguments || {},
                        success: false,
                        skipped: true,
                        skipReason,
                        dependsOn: declaredDeps,
                        summary: `Step ${i + 1} (${call.tool}) skipped: ${skipReason}`,
                    });
                    skippedCount++;
                    failedAtStepIndex = i;
                    failureError = skipReason;
                    continue;
                }
            }
            // Prerequisites satisfied (or no dependencies). Proceed with execution.
            if (!call.tool || typeof call.tool !== "string") {
                const error = "Invalid tool call format: Tool name missing.";
                results.push({
                    index: i,
                    tool: String(call?.tool || "unknown"),
                    arguments: call?.arguments || {},
                    success: false,
                    error,
                    summary: `Step ${i + 1} failed: ${error}`,
                });
                failedAtStepIndex = i;
                failureError = error;
                continue;
            }
            const toolName = call.tool.trim();
            let args = call.arguments || {};
            // If this step depends on earlier steps, apply safe context
            if (declaredDeps.length > 0) {
                const relevantContexts = declaredDeps
                    .map((d) => stepContexts.get(d))
                    .filter((c) => c !== undefined);
                args = applySafeDependencyContext(toolName, args, relevantContexts);
            }
            logger_1.logger.info(`AgentOrchestrator: [Step ${i + 1}/${plan.toolCalls.length}] Invoking Tool Registry for '${toolName}'...`);
            const execResult = await this.registry.execute(toolName, args, options);
            const summary = execResult.success
                ? this.formatStepSuccessSummary(toolName, args, execResult.data)
                : (execResult.error || `Step ${i + 1} (${toolName}) failed.`);
            results.push({
                index: i,
                tool: toolName,
                arguments: args,
                success: execResult.success,
                data: execResult.data,
                error: execResult.error,
                summary,
                dependsOn: declaredDeps.length > 0 ? declaredDeps : undefined,
            });
            if (execResult.success) {
                // Record safe context for potential future dependent steps
                const safeCtx = extractSafeStepContext(toolName, args, execResult.data);
                stepContexts.set(i, safeCtx);
            }
            else {
                failedAtStepIndex = i;
                failureError = execResult.error || `Step ${i + 1} (${toolName}) execution failed.`;
                logger_1.logger.warn(`AgentOrchestrator: Step ${i + 1}/${plan.toolCalls.length} ('${toolName}') failed. Halting sequential execution and evaluating dependent steps.`);
            }
        }
        // Step 5: Formulate overall status and safe summary
        const executedCount = results.filter((r) => !r.skipped).length;
        const overallSuccess = results.length > 0 && results.every((r) => r.success) && failedAtStepIndex === null;
        const totalPlanned = plan.toolCalls.length;
        const completedCount = results.filter((r) => r.success).length;
        let summary;
        let errorMessage;
        if (overallSuccess) {
            summary = totalPlanned > 1
                ? `Completed ${completedCount} of ${totalPlanned} actions.`
                : (results[0]?.summary || "Action executed successfully.");
            logger_1.logger.info(`AgentOrchestrator: All ${results.length} tool call(s) executed successfully.`);
        }
        else {
            const failedStepNumber = (failedAtStepIndex ?? 0) + 1;
            const failedStep = results.find((r) => r.index === failedAtStepIndex);
            const failedToolName = failedStep?.tool || "unknown";
            errorMessage = failureError || `Execution halted at step ${failedStepNumber} of ${totalPlanned} ('${failedToolName}').`;
            if (totalPlanned > 1) {
                summary = `Completed ${completedCount} of ${totalPlanned} actions. Execution stopped at step ${failedStepNumber} (${failedToolName}).`;
                if (skippedCount > 0) {
                    summary += ` ${skippedCount} dependent action(s) were skipped.`;
                }
            }
            else {
                summary = results[0]?.error || "Action execution failed.";
            }
            logger_1.logger.warn(`AgentOrchestrator: Orchestration failed at step ${failedStepNumber}/${totalPlanned}.`);
        }
        return {
            success: overallSuccess,
            userRequest,
            plan,
            results,
            steps: results,
            summary,
            totalSteps: totalPlanned,
            executedSteps: executedCount,
            skippedSteps: skippedCount,
            error: overallSuccess ? undefined : errorMessage,
        };
    }
}
exports.AgentOrchestrator = AgentOrchestrator;
exports.agentOrchestrator = new AgentOrchestrator();
