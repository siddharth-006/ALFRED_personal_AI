import {
    ICommandInterpreter,
    StructuredAction,
    ResolvedCommandAction,
    CommandExecutionResult,
} from "./types";
import { ruleCommandInterpreter } from "./rule-interpreter";
import { appResolverTool } from "../tools/app-resolver.tool";
import { appExecutorTool, AppExecutionOptions } from "../tools/app-executor.tool";
import { ToolExecutionOptions } from "./tools/types";
import { logger } from "../utils/logger";

import { providerConfigService } from "./providers/config/provider-config.service";
import { providerRegistry } from "./providers/provider-registry";
import { agentOrchestrator } from "./orchestrator/agent-orchestrator";
import { conversationContextService, TargetEntity } from "../services/conversation-context.service";
import { taskService } from "../services/task.service";
import { goalService } from "../services/goal.service";
import { projectService } from "../services/project.service";
import { registerDefaultProviders } from "./providers";
import { registerDefaultTools, toolRegistry } from "./tools";
import { AgentExecutionResult, AgentPlan, AgentToolCallResult } from "./orchestrator/types";
import { evaluatePlanRisk, confirmationStore, RiskEvaluationResult } from "./risk";
import { validateAgentPlan } from "./providers/impl/plan-validator";

// Ensure default AI providers, planner, and tools are wired
registerDefaultTools();
registerDefaultProviders();

/**
 * Formats a concise multi-step execution summary for user feedback (Phase 4.14).
 *
 * Success example:
 * "Completed 2 of 2 actions:
 * • Created task: Study CNNs
 * • Opened Machine Learning workspace"
 *
 * Failure example:
 * "Completed 1 of 2 actions:
 * • Created task: Study CNNs
 * • Failed to open Machine Learning workspace
 *
 * The remaining actions were not executed."
 */
export function formatMultiStepSummary(
    totalPlanned: number,
    steps: AgentToolCallResult[],
    overallSuccess: boolean
): string {
    const completedCount = steps.filter((s) => s.success).length;
    const lines: string[] = [`Completed ${completedCount} of ${totalPlanned} actions:`];

    for (const step of steps) {
        if (step.success) {
            lines.push(`• ${step.summary || `Executed ${step.tool}`}`);
        } else if (step.skipped) {
            lines.push(`• Skipped ${step.tool}: ${step.skipReason || "Prerequisite step failed."}`);
        } else {
            const tool = step.tool;
            const args = (step.arguments || {}) as Record<string, unknown>;
            let failText = `Failed to execute ${tool}`;
            if (tool === "launch_workspace") {
                const ws = String(args.workspaceName || args.workspace || args.name || "workspace");
                failText = `Failed to open ${ws} workspace`;
            } else if (tool === "launch_application") {
                const app = String(args.appName || args.application || "application");
                failText = `Failed to open ${app}`;
            } else if (tool === "create_task") {
                failText = `Failed to create task: ${String(args.text || args.title || "")}`;
            } else if (tool === "complete_task") {
                failText = `Failed to complete task: ${String(args.taskId || args.id || "")}`;
            } else if (tool === "create_goal") {
                failText = `Failed to create goal: ${String(args.title || "")}`;
            } else if (tool === "update_goal") {
                failText = `Failed to update goal: ${String(args.goalId || args.id || "")}`;
            } else if (tool === "update_project") {
                failText = `Failed to update project: ${String(args.projectId || args.id || "")}`;
            } else if (step.error) {
                failText = `Failed: ${step.error}`;
            }
            lines.push(`• ${failText}`);
        }
    }

    if (!overallSuccess && totalPlanned > 1) {
        lines.push("");
        lines.push("The remaining actions were not executed.");
    }

    return lines.join("\n");
}

/**
 * Command Agent Service (Phase 3.2 - Step 4 & Phase 3.3 - Step 4.5)
 *
 * Orchestrates natural language command understanding across all supported intent categories
 * (Application Launch, Navigation, System Status, Deep Work, Workspaces, Task Queries).
 * Routes AI-required requests through AI Provider Layer & Agent Orchestrator.
 */
export class CommandAgentService {
    private interpreter: ICommandInterpreter;

    constructor(interpreter?: ICommandInterpreter) {
        this.interpreter = interpreter || ruleCommandInterpreter;
        registerDefaultTools();
        registerDefaultProviders();
    }

    /**
     * Swaps the active command interpreter adapter.
     * @param interpreter Custom ICommandInterpreter implementation
     */
    public setInterpreter(interpreter: ICommandInterpreter): void {
        this.interpreter = interpreter;
        logger.info("CommandAgentService: Swapped command interpreter adapter.");
    }

    /**
     * Parses a raw natural language prompt into a safe structured action.
     * @param prompt User prompt text
     * @returns Promise<StructuredAction>
     */
    public async parseCommand(prompt: string): Promise<StructuredAction> {
        logger.info(`CommandAgentService: Interpreting prompt -> "${prompt}"`);
        try {
            const action = await this.interpreter.interpret(prompt);
            logger.info(
                `CommandAgentService: Produced structured action -> intent: ${action.intent}, target: ${action.target}`
            );
            return action;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Parsing error";
            logger.error(`CommandAgentService: Interpreter error -> ${message}`);
            return {
                intent: "unknown",
                target: null,
            };
        }
    }

    /**
     * Parses natural language AND connects to secure app-resolver.tool.ts for application intents.
     * @param prompt Raw user natural-language prompt
     * @returns Promise<ResolvedCommandAction>
     */
    public async resolveCommand(prompt: string): Promise<ResolvedCommandAction> {
        const action = await this.parseCommand(prompt);

        if (action.intent === "unknown") {
            return {
                success: false,
                intent: "unknown",
                target: null,
                executable: null,
                error: "Command not recognized.",
            };
        }

        if (action.intent !== "launch_application") {
            return {
                success: true,
                intent: action.intent,
                target: action.target,
                executable: null,
            };
        }

        if (!action.target) {
            return {
                success: false,
                intent: "launch_application",
                target: null,
                executable: null,
                error: "Application target missing.",
            };
        }

        logger.info(`CommandAgentService: Passing target '${action.target}' to AppResolverTool...`);
        const resolution = appResolverTool.resolveApplication(action.target);

        if (resolution.success) {
            logger.info(
                `CommandAgentService: Resolution SUCCESS -> App: '${resolution.appName}', Executable: '${resolution.executable}'`
            );
            return {
                success: true,
                intent: "launch_application",
                target: resolution.appName,
                executable: resolution.executable,
            };
        } else {
            logger.warn(
                `CommandAgentService: Resolution FAILED for '${action.target}' -> ${resolution.error}`
            );
            return {
                success: false,
                intent: "launch_application",
                target: action.target,
                executable: null,
                error: resolution.error || "Unsupported application.",
            };
        }
    }

    /**
     * Parses, resolves, and handles command execution or routes structured intent.
     * Integrates Ollama / Gemini / Multi-provider agent execution with fallback to Mock/Rule interpreter.
     *
     * @param prompt User natural language prompt
     * @param options Execution options (e.g. { isMock: true } for unit tests)
     */
    public async executeCommand(
        prompt: string,
        options: AppExecutionOptions = {}
    ): Promise<CommandExecutionResult> {
        const activeProviderId = providerConfigService.getActiveProviderId();

        // Ensure default AI providers and tools are registered
        if (!toolRegistry.has("create_task")) {
            registerDefaultTools();
        }
        if (!providerRegistry.hasProvider("mock")) {
            registerDefaultProviders();
        }

        // Attempt AI execution via ProviderRegistry -> AgentOrchestrator for active provider
        const provider = providerRegistry.getProvider(activeProviderId);
        const available = provider ? await provider.isAvailable() : false;
        const providerName =
            activeProviderId === "ollama"
                ? "Ollama"
                : activeProviderId === "gemini"
                ? "Gemini"
                : activeProviderId === "claude"
                ? "Claude"
                : "Mock AI";

        const effectiveContext: Record<string, unknown> = {
            ...((options.context as Record<string, unknown>) || {}),
        };
        if (!effectiveContext.recentConversation && !effectiveContext.conversationHistory) {
            const recentTurns = conversationContextService.getRecentTurns();
            effectiveContext.recentConversation = recentTurns;
            effectiveContext.conversationHistory = recentTurns;
        }
        if (!effectiveContext.tasks) {
            effectiveContext.tasks = taskService.getTasks();
        }
        if (!effectiveContext.goals) {
            effectiveContext.goals = goalService.getGoals();
        }
        if (!effectiveContext.projects) {
            effectiveContext.projects = projectService.getProjects();
        }

        if (available) {
            logger.info(
                `CommandAgentService: Routing request to ${providerName} via AgentOrchestrator -> "${prompt}"`
            );

            // Step 1: Generate plan from provider
            let rawPlan: AgentPlan;
            try {
                rawPlan = await agentOrchestrator.plan(prompt, {
                    isMock: options.isMock,
                    context: effectiveContext,
                });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Planning exception";
                logger.error(`CommandAgentService: Planning failed -> ${message}`);
                rawPlan = { userRequest: prompt, toolCalls: [], explanation: message };
            }

            // Handle AI Answer Mode (informational response without tool execution)
            if (rawPlan.type === "answer" || rawPlan.answerText) {
                const answerText =
                    rawPlan.answerText ||
                    rawPlan.explanation ||
                    "Informational answer provided.";
                logger.info(
                    `CommandAgentService: Informational answer returned by ${providerName}`
                );
                const answerResult: CommandExecutionResult = {
                    success: true,
                    intent: "answer",
                    appName: null,
                    executable: null,
                    executed: false,
                    providerId: activeProviderId,
                    responseType: "answer",
                    answerText,
                    explanation: rawPlan.explanation,
                    risk: evaluatePlanRisk(rawPlan),
                };
                this.recordConversationTurn(prompt, answerResult);
                return answerResult;
            }

            // If plan produced no tool calls (unrecognized command), fall back to deterministic rules
            if (!rawPlan.toolCalls || rawPlan.toolCalls.length === 0) {
                logger.warn(
                    `CommandAgentService: Provider generated empty tool calls. Falling back to deterministic rules.`
                );
            } else {
                // Step 2: Validate plan (enforce bounds, schemas, security, and dependencies)
                const validation = validateAgentPlan(rawPlan, { strict: true });
                if (!validation.valid) {
                    logger.warn(`CommandAgentService: Plan validation failed -> ${validation.error}`);
                    if (
                        validation.error &&
                        (validation.error.includes("maximum allowed steps") ||
                            validation.error.includes("Plan rejected:"))
                    ) {
                        const rejectedResult: CommandExecutionResult = {
                            success: false,
                            intent: "unknown",
                            appName: null,
                            executable: null,
                            executed: false,
                            providerId: activeProviderId,
                            explanation: validation.error,
                            error: validation.error,
                            responseType: "action",
                            steps: [],
                            totalSteps: rawPlan.toolCalls.length,
                            executedSteps: 0,
                            skippedSteps: 0,
                            plan: rawPlan,
                            risk: evaluatePlanRisk(rawPlan),
                        };
                        this.recordConversationTurn(prompt, rejectedResult);
                        return rejectedResult;
                    }
                    // For other validation errors, fall through to fallback rules
                } else {
                    const validatedPlan = validation.plan || rawPlan;

                    // Step 3: Evaluate plan risk deterministically
                    const risk = evaluatePlanRisk(validatedPlan);

                    // Step 4: Confirmation Gate
                    if (risk.requiresConfirmation) {
                        logger.info(
                            `CommandAgentService: High-risk plan detected (${risk.mutationCount} mutations). Halting before execution for user confirmation.`
                        );
                        const pending = confirmationStore.createPendingConfirmation(
                            validatedPlan,
                            risk,
                            prompt,
                            effectiveContext,
                            options as ToolExecutionOptions
                        );
                        // Security Guarantee: NEVER execute tool, NEVER record mutations in conversation context
                        return {
                            success: true,
                            intent: "pending_confirmation",
                            appName: null,
                            executable: null,
                            executed: false,
                            providerId: activeProviderId,
                            responseType: "action",
                            requiresConfirmation: true,
                            confirmationId: pending.id,
                            risk,
                            plan: validatedPlan,
                            explanation: `ALFRED requires confirmation before executing these actions.`,
                        };
                    }

                    // Step 5: Execute plan directly (confirmation not required)
                    const orchResult = await agentOrchestrator.executePlan(validatedPlan, {
                        isMock: options.isMock,
                        context: effectiveContext,
                    });

                    const mapped = this.mapOrchestrationResult(orchResult, activeProviderId, risk);
                    if (orchResult.success || orchResult.results.length > 0) {
                        this.recordConversationTurn(prompt, mapped, orchResult);
                        return mapped;
                    }
                }
            }

            logger.warn(
                `CommandAgentService: ${providerName} orchestration returned failure. Falling back to deterministic rules.`
            );
        } else {
            logger.warn(
                `CommandAgentService: ${providerName} missing or unreachable. Falling back to Mock AI / Rules.`
            );
        }

        // Fallback execution when active provider is unavailable or fails
        const fallbackRes = await this.executeFallbackCommand(prompt, options);
        const unavailError =
            activeProviderId === "gemini"
                ? "Gemini API key missing — using Mock AI fallback."
                : activeProviderId === "claude"
                ? "Claude API key missing — using Mock AI fallback."
                : `${providerName} unavailable — using Mock AI fallback.`;

        const finalFallbackResult: CommandExecutionResult = {
            ...fallbackRes,
            providerId: activeProviderId,
            fallbackUsed: true,
            error: available
                ? `${providerName} plan execution failed — using Mock AI fallback.`
                : unavailError,
        };
        this.recordConversationTurn(prompt, finalFallbackResult);
        return finalFallbackResult;
    }

    /**
     * Confirms and executes an exact stored pending validated plan (Phase 4.16).
     *
     * SECURITY GUARANTEES:
     * - Only accepts confirmationId (no arbitrary plan injection).
     * - Atomically consumes confirmationId so it can execute at most once.
     * - Re-validates the stored plan before execution.
     * - Only records completed actions in conversation context upon successful execution.
     *
     * @param confirmationId Pending confirmation ID
     * @returns Promise<CommandExecutionResult>
     */
    public async confirmAction(confirmationId: string): Promise<CommandExecutionResult> {
        logger.info(`CommandAgentService: confirmAction received for ID: ${confirmationId}`);

        if (typeof confirmationId !== "string" || !confirmationId.trim()) {
            return {
                success: false,
                intent: "unknown",
                appName: null,
                executable: null,
                executed: false,
                error: "Invalid confirmation ID.",
                explanation: "Confirmation ID must be a non-empty string.",
            };
        }

        // 1. Atomically consume the pending confirmation
        const pending = confirmationStore.consumePendingConfirmation(confirmationId);
        if (!pending) {
            logger.warn(`CommandAgentService: Confirmation ID not found or already consumed: ${confirmationId}`);
            return {
                success: false,
                intent: "unknown",
                appName: null,
                executable: null,
                executed: false,
                error: "Confirmation expired, invalid, or already consumed.",
                explanation: "The requested confirmation has already been executed, cancelled, or expired.",
            };
        }

        // 2. Re-validate the stored plan prior to execution
        const validation = validateAgentPlan(pending.plan, { strict: true });
        if (!validation.valid) {
            logger.error(`CommandAgentService: Stored plan re-validation failed: ${validation.error}`);
            return {
                success: false,
                intent: "unknown",
                appName: null,
                executable: null,
                executed: false,
                error: `Plan validation failed prior to execution: ${validation.error}`,
                explanation: `Plan validation failed prior to execution: ${validation.error}`,
            };
        }

        const planToExecute = validation.plan || pending.plan;

        // 3. Execute the exact stored plan
        const activeProviderId = providerConfigService.getActiveProviderId();
        const orchResult = await agentOrchestrator.executePlan(planToExecute, {
            isMock: pending.options?.isMock,
            context: pending.context,
        });

        // 4. Map orchestration result and mark as confirmed
        const mapped = this.mapOrchestrationResult(orchResult, activeProviderId, pending.risk);
        mapped.confirmed = true;

        // 5. Record conversation turn only for confirmed, executed actions
        this.recordConversationTurn(pending.userRequest, mapped, orchResult);

        return mapped;
    }

    /**
     * Cancels a pending confirmation, executing zero tools (Phase 4.16).
     *
     * @param confirmationId Pending confirmation ID
     * @returns Promise<CommandExecutionResult>
     */
    public async cancelAction(confirmationId: string): Promise<CommandExecutionResult> {
        logger.info(`CommandAgentService: cancelAction received for ID: ${confirmationId}`);

        if (typeof confirmationId !== "string" || !confirmationId.trim()) {
            return {
                success: false,
                intent: "unknown",
                appName: null,
                executable: null,
                executed: false,
                error: "Invalid confirmation ID.",
                explanation: "Confirmation ID must be a non-empty string.",
            };
        }

        const cancelled = confirmationStore.cancelPendingConfirmation(confirmationId);
        if (!cancelled) {
            logger.warn(`CommandAgentService: Cancel request for unknown or expired ID: ${confirmationId}`);
            return {
                success: false,
                intent: "unknown",
                appName: null,
                executable: null,
                executed: false,
                error: "Confirmation expired, invalid, or already consumed.",
                explanation: "Confirmation request was not found or has expired.",
            };
        }

        return {
            success: true,
            intent: "cancelled",
            appName: null,
            executable: null,
            executed: false,
            cancelled: true,
            explanation: "Action execution cancelled by user.",
        };
    }

    /**
     * Maps AgentExecutionResult into CommandExecutionResult.
     */
    private mapOrchestrationResult(
        orchResult: AgentExecutionResult,
        activeProviderId: string,
        risk?: RiskEvaluationResult
    ): CommandExecutionResult {
        if (orchResult.success && orchResult.results.length > 0) {
            const firstTool = orchResult.results[0];
            const args = firstTool.arguments || {};
            let mappedIntent: any = "unknown";
            let appName: string | null = null;
            let executable: string | null = null;

            if (firstTool.tool === "launch_application") {
                mappedIntent = "launch_application";
                appName = (args.appName || args.application || null) as string | null;
                if (firstTool.data && typeof firstTool.data === "object") {
                    executable =
                        ((firstTool.data as Record<string, unknown>).executable as string) || null;
                }
            } else if (firstTool.tool === "navigate") {
                mappedIntent = "navigate";
                appName = (args.target || args.view || null) as string | null;
            } else if (firstTool.tool === "system_status") {
                mappedIntent = "system_status";
            } else if (firstTool.tool === "start_deep_work") {
                mappedIntent = "start_deep_work";
                appName = (args.sessionName || args.appName || null) as string | null;
            } else if (firstTool.tool === "launch_workspace") {
                mappedIntent = "launch_workspace";
                appName = (args.workspaceName || args.name || null) as string | null;
            } else if (firstTool.tool === "show_tasks") {
                mappedIntent = "show_tasks";
            } else if (firstTool.tool === "create_task") {
                mappedIntent = "create_task";
                appName = (args.text || args.title || null) as string | null;
            } else if (firstTool.tool === "complete_task") {
                mappedIntent = "complete_task";
                appName = (args.taskId || args.id || null) as string | null;
            } else if (firstTool.tool === "create_goal") {
                mappedIntent = "create_goal";
                appName = (args.title || null) as string | null;
            } else if (firstTool.tool === "update_goal") {
                mappedIntent = "update_goal";
                appName = (args.goalId || args.id || null) as string | null;
            } else if (firstTool.tool === "update_project") {
                mappedIntent = "update_project";
                appName = (args.projectId || args.id || null) as string | null;
            }

            if (orchResult.results.length > 1) {
                const appNames = orchResult.results
                    .map((r) => {
                        const a = r.arguments || {};
                        return (a.appName || a.application || a.target || a.text || a.title || r.tool) as string;
                    })
                    .filter(Boolean);
                if (appNames.length > 0) {
                    appName = appNames.join(", ");
                }
            }

            const toolDataObj = firstTool.data as Record<string, unknown> | undefined;
            const taskData = toolDataObj?.task;
            const goalData = toolDataObj?.goal;
            const projectData = toolDataObj?.project;

            const isMultiStep = (orchResult.totalSteps && orchResult.totalSteps > 1) || orchResult.results.length > 1;
            const multiStepSummary = isMultiStep
                ? formatMultiStepSummary(orchResult.totalSteps || orchResult.results.length, orchResult.results, true)
                : undefined;

            return {
                success: true,
                intent: mappedIntent,
                appName,
                executable,
                executed: true,
                providerId: activeProviderId,
                explanation: multiStepSummary || orchResult.plan?.explanation,
                responseType: "action",
                data: firstTool.data,
                task: taskData,
                goal: goalData,
                project: projectData,
                steps: orchResult.results,
                totalSteps: orchResult.totalSteps || orchResult.results.length,
                executedSteps: orchResult.executedSteps || orchResult.results.length,
                skippedSteps: orchResult.skippedSteps || 0,
                plan: orchResult.plan,
                risk,
            };
        }

        if (!orchResult.success && orchResult.results.length > 0) {
            const isMultiStep = (orchResult.totalSteps && orchResult.totalSteps > 1) || orchResult.results.length > 1;
            const formattedSummary = isMultiStep
                ? formatMultiStepSummary(orchResult.totalSteps || orchResult.results.length, orchResult.results, false)
                : orchResult.results[0]?.error || orchResult.error || "Action execution failed.";

            return {
                success: false,
                intent: "unknown",
                appName: null,
                executable: null,
                executed: true,
                providerId: activeProviderId,
                explanation: formattedSummary,
                error: orchResult.error || "Execution halted due to step failure.",
                responseType: "action",
                steps: orchResult.results,
                totalSteps: orchResult.totalSteps || orchResult.results.length,
                executedSteps: orchResult.executedSteps || orchResult.results.length,
                skippedSteps: orchResult.skippedSteps || 0,
                plan: orchResult.plan,
                risk,
            };
        }

        return {
            success: false,
            intent: "unknown",
            appName: null,
            executable: null,
            executed: false,
            providerId: activeProviderId,
            explanation: orchResult.error || "Plan execution failed.",
            error: orchResult.error || "Plan execution failed.",
            responseType: "action",
            steps: [],
            totalSteps: orchResult.totalSteps || 0,
            executedSteps: 0,
            skippedSteps: 0,
            plan: orchResult.plan,
            risk,
        };
    }

    /**
     * Records an interaction turn in the bounded session-scoped ConversationContextService.
     */
    private recordConversationTurn(
        prompt: string,
        res: CommandExecutionResult,
        orchResult?: any
    ): void {
        try {
            let targetEntity: TargetEntity | undefined;
            const targetEntities: TargetEntity[] = [];

            if (res.task && typeof res.task === "object") {
                const t = res.task as Record<string, unknown>;
                targetEntity = { type: "task", id: String(t.id || ""), name: String(t.text || "") };
                targetEntities.push(targetEntity);
            } else if (res.goal && typeof res.goal === "object") {
                const g = res.goal as Record<string, unknown>;
                targetEntity = { type: "goal", id: String(g.id || ""), name: String(g.title || "") };
                targetEntities.push(targetEntity);
            } else if (res.project && typeof res.project === "object") {
                const p = res.project as Record<string, unknown>;
                targetEntity = { type: "project", id: String(p.id || ""), name: String(p.name || "") };
                targetEntities.push(targetEntity);
            } else if (res.intent === "launch_workspace" && res.appName) {
                targetEntity = { type: "workspace", name: res.appName };
                targetEntities.push(targetEntity);
            } else if (res.intent === "launch_application" && res.appName) {
                targetEntity = { type: "app", name: res.appName };
                targetEntities.push(targetEntity);
            }

            // In multi-step or tool execution results, inspect each successful step
            if (orchResult?.results && Array.isArray(orchResult.results)) {
                for (const r of orchResult.results) {
                    if (!r.success) continue;
                    const tool = r.tool;
                    const args = (r.arguments || {}) as Record<string, unknown>;
                    const dataObj = (r.data as Record<string, unknown>) || {};
                    let ent: TargetEntity | undefined;

                    if (tool === "create_task" || tool === "complete_task") {
                        const t = (dataObj.task as Record<string, unknown>) || {};
                        const id = String(t.id || args.taskId || args.id || "");
                        const name = String(t.text || args.text || args.title || "");
                        if (id || name) ent = { type: "task", id, name };
                    } else if (tool === "create_goal" || tool === "update_goal") {
                        const g = (dataObj.goal as Record<string, unknown>) || {};
                        const id = String(g.id || args.goalId || args.id || "");
                        const name = String(g.title || args.title || "");
                        if (id || name) ent = { type: "goal", id, name };
                    } else if (tool === "update_project") {
                        const p = (dataObj.project as Record<string, unknown>) || {};
                        const id = String(p.id || args.projectId || args.id || "");
                        const name = String(p.name || args.name || "");
                        if (id || name) ent = { type: "project", id, name };
                    } else if (tool === "launch_workspace") {
                        const name = String(args.workspaceName || args.workspace || args.name || "");
                        if (name) ent = { type: "workspace", name };
                    } else if (tool === "launch_application") {
                        const name = String(args.appName || args.application || "");
                        if (name) ent = { type: "app", name };
                    } else if (tool === "start_deep_work") {
                        const session = String(args.sessionName || args.session || "");
                        if (session) {
                            ent = { type: "workspace", name: session };
                            const matchingTask = taskService.getTasks().find(t => 
                                t.text.toLowerCase().includes(session.toLowerCase()) || 
                                session.toLowerCase().includes(t.text.toLowerCase())
                            );
                            if (matchingTask) {
                                targetEntities.push({ type: "task", id: matchingTask.id, name: matchingTask.text });
                            }
                        }
                    }

                    if (ent && (ent.name || ent.id)) {
                        const exists = targetEntities.some(
                            (existing) => existing.type === ent!.type && (existing.id === ent!.id || existing.name === ent!.name)
                        );
                        if (!exists) {
                            targetEntities.push(ent);
                        }
                    }
                }
            }

            if (targetEntities.length > 0) {
                targetEntity = targetEntities[targetEntities.length - 1];
            }

            const toolsExecuted = orchResult?.results?.map((r: any) => r.tool) ||
                (res.intent !== "unknown" && res.intent !== "answer" ? [res.intent] : []);

            conversationContextService.addTurn({
                userRequest: prompt,
                intent: res.intent,
                responseType: res.responseType || (res.intent === "answer" ? "answer" : "action"),
                answerText: res.answerText,
                toolsExecuted,
                targetEntity,
                targetEntities: targetEntities.length > 0 ? targetEntities : undefined,
                summary: res.explanation || (res.answerText ? res.answerText.slice(0, 100) : `${res.intent} executed`),
            });
        } catch {
            // Guard against recording errors impacting response flow
        }
    }

    /**
     * Executes command using deterministic RuleCommandInterpreter and secure tool resolution.
     */
    private async executeFallbackCommand(
        prompt: string,
        options: AppExecutionOptions = {}
    ): Promise<CommandExecutionResult> {
        const resolution = await this.resolveCommand(prompt);

        if (!resolution.success) {
            logger.warn(`CommandAgentService: Command resolution failed -> ${resolution.error}`);
            return {
                success: false,
                intent: resolution.intent,
                appName: resolution.target,
                executable: null,
                executed: false,
                providerId: "mock",
                error: resolution.error || "Command unrecognized or unsupported.",
            };
        }

        // Non-application launch intents return successful resolution for UI handling
        if (resolution.intent !== "launch_application") {
            return {
                success: true,
                intent: resolution.intent,
                appName: resolution.target,
                executable: null,
                executed: false,
                providerId: "mock",
            };
        }

        if (!resolution.executable) {
            return {
                success: false,
                intent: "launch_application",
                appName: resolution.target,
                executable: null,
                executed: false,
                providerId: "mock",
                error: "Executable mapping missing.",
            };
        }

        logger.info(
            `CommandAgentService: Executing whitelisted executable '${resolution.executable}' for app '${resolution.target}'`
        );

        const execResult = await appExecutorTool.execute(resolution.executable, options);

        if (execResult.success) {
            return {
                success: true,
                intent: "launch_application",
                appName: resolution.target,
                executable: resolution.executable,
                executed: execResult.executed,
                providerId: "mock",
            };
        } else {
            return {
                success: false,
                intent: "launch_application",
                appName: resolution.target,
                executable: resolution.executable,
                executed: false,
                providerId: "mock",
                error: execResult.error || `Failed to launch ${resolution.target}`,
            };
        }
    }
}

export const commandAgentService = new CommandAgentService();
