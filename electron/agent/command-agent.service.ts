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
import { workspaceService } from "../services/workspace.service";
import { registerDefaultProviders } from "./providers";
import { registerDefaultTools, toolRegistry } from "./tools";
import { AgentExecutionResult, AgentPlan, AgentToolCallResult } from "./orchestrator/types";
import { evaluatePlanRisk, confirmationStore, RiskEvaluationResult } from "./risk";
import { validateAgentPlan } from "./providers/impl/plan-validator";
import { agentContextService } from "./agent-context/agent-context.service";
import { AgentContextSnapshot } from "./agent-context/agent-context.types";
import { recommendationAgentService } from "./recommendation/recommendation-agent.service";
import { RecommendationResult } from "./recommendation/recommendation.types";
import { detectObjective } from "./planning/objective-detector";
import { agenticPlannerService } from "./planning/agentic-planner.service";
import { AgenticPlan } from "./planning/agentic-plan.types";
import { detectMemoryIntent } from "./memory/memory-intent-detector";
import { memoryService } from "./memory/memory.service";
import { MemoryItem, MemoryProposal } from "./memory/memory.types";
import { routineService } from "./routines";
import { morningBriefingService } from "./briefing";
import { endOfDayReviewService } from "./review";
import { weeklyReviewService } from "./review/weekly-review.service";
import { routineScheduler } from "./scheduler/routine-scheduler.service";
import { CreateScheduleInput, ScheduleTargetType } from "./scheduler/scheduler.types";
import { conditionalAutomationService } from "./automation/conditional-automation.service";
import { CreateAutomationInput, AutomationActionType } from "./automation/automation.types";
import { notificationManager } from "../services/notification-manager.service";
import { eventBus } from "../events/event-bus";
import { AppEventType } from "../events/event.types";
import { focusService } from "../services/focus.service";
import { knowledgeService } from "../knowledge/knowledge.service";
import { desktopContextService } from "../services/desktop-context.service";
import { settingsService } from "../services/settings.service";

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
     * Alias for executeCommand to match IPC and test interfaces.
     */
    public async execute(
        prompt: string,
        options: AppExecutionOptions = {}
    ): Promise<CommandExecutionResult> {
        return this.executeCommand(prompt, options);
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
        const cleanPrompt = (prompt || "").trim().toLowerCase().replace(/[.!?]+$/, "");

        // Phase 5.6: Conversational Cancellation Gate ("cancel", "don't do it", "never mind", "abort")
        const isCancel =
            cleanPrompt === "cancel" ||
            cleanPrompt === "don't do it" ||
            cleanPrompt === "dont do it" ||
            cleanPrompt === "never mind" ||
            cleanPrompt === "nevermind" ||
            cleanPrompt === "abort" ||
            cleanPrompt === "no";

        if (isCancel) {
            const pending = confirmationStore.getLatestPendingConfirmation();
            if (pending) {
                return await this.cancelAction(pending.id);
            }
            return {
                success: true,
                intent: "cancelled",
                appName: null,
                executable: null,
                executed: false,
                cancelled: true,
                responseType: "answer",
                answerText: "Execution plan cancelled. No actions were executed.",
                explanation: "Execution plan cancelled by user request.",
            };
        }

        // Phase 5.6: Conversational Confirmation Gate ("yes", "confirm", "proceed", "do it")
        const isConfirm =
            cleanPrompt === "yes" ||
            cleanPrompt === "confirm" ||
            cleanPrompt === "proceed" ||
            cleanPrompt === "do it" ||
            cleanPrompt === "approved" ||
            cleanPrompt === "ok proceed";

        if (isConfirm) {
            const pending = confirmationStore.getLatestPendingConfirmation();
            if (pending) {
                return await this.confirmAction(pending.id);
            }
            return {
                success: false,
                intent: "unknown",
                appName: null,
                executable: null,
                executed: false,
                error: "No pending plan awaiting confirmation.",
                explanation: "There is no pending plan awaiting confirmation.",
            };
        }

        // Phase 5.8C: Session Control Commands ("pause my coding session", "resume my coding session", "stop my coding session", "add 5 minutes", "how much time is left?")
        const isPauseQuery = /^(?:pause\s+(?:my\s+)?(?:coding\s+|focus\s+)?session|pause\s+coding|pause\s+focus)$/i.test(cleanPrompt);
        if (isPauseQuery) {
            const pauseRes = focusService.pauseSession();
            if (!pauseRes.success) {
                const answer = pauseRes.error || "Unable to pause session.";
                const errResult: CommandExecutionResult = {
                    success: false,
                    intent: "answer",
                    appName: null,
                    executable: null,
                    executed: false,
                    responseType: "answer",
                    answerText: answer,
                    explanation: answer,
                    spokenPrompt: answer,
                };
                this.recordConversationTurn(prompt, errResult);
                return errResult;
            }
            const remainingMin = Math.ceil((pauseRes.session?.pausedRemainingSeconds || 0) / 60);
            const answer = `Your coding session is paused with ${remainingMin} minute(s) remaining.`;
            const spoken = `Your coding session is paused.`;
            const pauseResult: CommandExecutionResult = {
                success: true,
                intent: "answer",
                appName: null,
                executable: null,
                executed: true,
                responseType: "answer",
                answerText: answer,
                explanation: answer,
                spokenPrompt: spoken,
            };
            this.recordConversationTurn(prompt, pauseResult);
            return pauseResult;
        }

        const isResumeQuery = /^(?:resume\s+(?:my\s+)?(?:coding\s+|focus\s+)?session|resume\s+coding|resume\s+focus|continue\s+coding)$/i.test(cleanPrompt);
        if (isResumeQuery) {
            const resumeRes = focusService.resumeSession();
            if (!resumeRes.success) {
                const answer = resumeRes.error || "Unable to resume session.";
                const errResult: CommandExecutionResult = {
                    success: false,
                    intent: "answer",
                    appName: null,
                    executable: null,
                    executed: false,
                    responseType: "answer",
                    answerText: answer,
                    explanation: answer,
                    spokenPrompt: answer,
                };
                this.recordConversationTurn(prompt, errResult);
                return errResult;
            }
            const remainingMin = Math.ceil((resumeRes.session?.pausedRemainingSeconds || 0) / 60);
            const answer = `Your coding session has resumed. ${remainingMin} minute(s) remaining.`;
            const spoken = `Your coding session has resumed.`;
            const resumeResult: CommandExecutionResult = {
                success: true,
                intent: "answer",
                appName: null,
                executable: null,
                executed: true,
                responseType: "answer",
                answerText: answer,
                explanation: answer,
                spokenPrompt: spoken,
            };
            this.recordConversationTurn(prompt, resumeResult);
            return resumeResult;
        }

        const isStopQuery = /^(?:stop\s+(?:my\s+)?(?:coding\s+|focus\s+)?session|stop\s+coding|end\s+(?:my\s+)?(?:coding\s+|focus\s+)?session|end\s+coding|cancel\s+(?:my\s+)?(?:coding\s+|focus\s+)?session)$/i.test(cleanPrompt);
        if (isStopQuery) {
            const stopRes = focusService.stopSession();
            if (!stopRes.success) {
                const answer = stopRes.error || "No active coding session to stop.";
                const errResult: CommandExecutionResult = {
                    success: false,
                    intent: "answer",
                    appName: null,
                    executable: null,
                    executed: false,
                    responseType: "answer",
                    answerText: answer,
                    explanation: answer,
                    spokenPrompt: answer,
                };
                this.recordConversationTurn(prompt, errResult);
                return errResult;
            }
            const answer = "Your coding session has been stopped.";
            const stopResult: CommandExecutionResult = {
                success: true,
                intent: "answer",
                appName: null,
                executable: null,
                executed: true,
                responseType: "answer",
                answerText: answer,
                explanation: answer,
                spokenPrompt: answer,
            };
            this.recordConversationTurn(prompt, stopResult);
            return stopResult;
        }

        const isAddMinutesQuery = /^(?:add\s+5\s+minutes?(?:\s+(?:to\s+(?:my\s+)?(?:coding\s+|focus\s+)?session|to\s+coding))?|\+5\s*(?:min|mins|minutes)?)$/i.test(cleanPrompt);
        if (isAddMinutesQuery) {
            const addRes = focusService.addFiveMinutes();
            if (!addRes.success) {
                const answer = addRes.error || "No active coding session to add time to.";
                const errResult: CommandExecutionResult = {
                    success: false,
                    intent: "answer",
                    appName: null,
                    executable: null,
                    executed: false,
                    responseType: "answer",
                    answerText: answer,
                    explanation: answer,
                    spokenPrompt: answer,
                };
                this.recordConversationTurn(prompt, errResult);
                return errResult;
            }
            const remainingMin = Math.ceil((addRes.remainingSeconds || 0) / 60);
            const answer = `Added 5 minutes to your coding session. You now have ${remainingMin} minute(s) remaining.`;
            const spoken = `Added 5 minutes. You have ${remainingMin} minutes remaining.`;
            const addResult: CommandExecutionResult = {
                success: true,
                intent: "answer",
                appName: null,
                executable: null,
                executed: true,
                responseType: "answer",
                answerText: answer,
                explanation: answer,
                spokenPrompt: spoken,
            };
            this.recordConversationTurn(prompt, addResult);
            return addResult;
        }

        const isTimeLeftQuery = /^(?:how\s+much\s+time\s+is\s+left(?:\s+(?:in|on)\s+(?:my\s+)?(?:coding\s+|focus\s+)?session)?|time\s+left|time\s+remaining(?:\s+(?:in|on)\s+(?:my\s+)?(?:coding\s+|focus\s+)?session)?|how\s+much\s+time\s+(?:do\s+i\s+have|remaining))$/i.test(cleanPrompt);
        if (isTimeLeftQuery) {
            const summary = focusService.getFocusSummary();
            if (!summary.isActive) {
                const answer = "There is no active coding session running.";
                const noActiveResult: CommandExecutionResult = {
                    success: true,
                    intent: "answer",
                    appName: null,
                    executable: null,
                    executed: false,
                    responseType: "answer",
                    answerText: answer,
                    explanation: answer,
                    spokenPrompt: answer,
                };
                this.recordConversationTurn(prompt, noActiveResult);
                return noActiveResult;
            }
            const remainingMin = Math.ceil(summary.remainingSeconds / 60);
            const isPaused = summary.state === "paused";
            const answer = isPaused
                ? `Your coding session is paused with ${remainingMin} minute(s) remaining.`
                : `You have ${remainingMin} minute(s) remaining in your coding session.`;
            const spoken = `You have ${remainingMin} minutes remaining.`;
            const timeLeftResult: CommandExecutionResult = {
                success: true,
                intent: "answer",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: answer,
                explanation: answer,
                spokenPrompt: spoken,
            };
            this.recordConversationTurn(prompt, timeLeftResult);
            return timeLeftResult;
        }

        // Phase 5.7: Explicit Memory Intent Detection (Section 4, 5, 6, 17)
        const memoryDetection = detectMemoryIntent(prompt);
        if (memoryDetection.isMemoryIntent) {
            if (memoryDetection.isRejectedSensitive) {
                return {
                    success: false,
                    intent: "memory_proposal",
                    appName: null,
                    executable: null,
                    executed: false,
                    responseType: "answer",
                    answerText: memoryDetection.explanation,
                    explanation: memoryDetection.explanation,
                };
            }

            const proposal = memoryDetection.proposal;
            // Clear any stale unapproved confirmations before creating a new memory proposal
            if (confirmationStore.size() > 0) {
                confirmationStore.clear();
            }

            const pending = confirmationStore.createPendingMemoryConfirmation(proposal, prompt);

            return {
                success: true,
                intent: "memory_proposal",
                appName: null,
                executable: null,
                executed: false,
                requiresConfirmation: true,
                confirmationId: pending.id,
                memoryProposal: proposal,
                memoryAction: proposal.type === "create" ? "remember" : proposal.type === "update" ? "update" : "forget",
                responseType: "answer",
                answerText: proposal.promptPreview,
                explanation: proposal.promptPreview,
                spokenPrompt: proposal.spokenPrompt,
            };
        }

        // Phase 5.8B: Morning Briefing ("Give me my morning briefing", "What do I have today?", "Good morning")
        if (morningBriefingService.isBriefingQuery(prompt)) {
            const briefing = morningBriefingService.generateBriefing({
                query: prompt,
                context: options.context as Record<string, unknown>,
            });
            const briefingResult: CommandExecutionResult = {
                success: true,
                intent: "briefing",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: briefing.summary,
                explanation: briefing.summary,
                spokenPrompt: briefing.spokenSummary,
                briefing,
            };
            this.recordConversationTurn(prompt, briefingResult);
            return briefingResult;
        }

        // Phase 5.8D: End-of-Day Review ("How did I do today?", "Give me my end-of-day review", "What did I accomplish today?")
        if (endOfDayReviewService.isReviewQuery(prompt)) {
            const review = endOfDayReviewService.generateReview({
                query: prompt,
                context: options.context as Record<string, unknown>,
            });
            const reviewResult: CommandExecutionResult = {
                success: true,
                intent: "review",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: review.conciseSummary,
                explanation: review.conciseSummary,
                spokenPrompt: review.spokenSummary,
                review,
            };
            this.recordConversationTurn(prompt, reviewResult);
            return reviewResult;
        }

        // Phase 5.10: Weekly Review ("How did I do this week?", "Give me my weekly review", "Summarize my week")
        if (weeklyReviewService.isWeeklyReviewQuery(prompt)) {
            const nowOpt = (options as any)?.now;
            const weeklyReview = weeklyReviewService.generateWeeklyReview({
                now: nowOpt ? new Date(nowOpt as string | number) : undefined,
                context: options.context as Record<string, unknown>,
            });
            const weeklyReviewResult: CommandExecutionResult = {
                success: true,
                intent: "weekly_review",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: weeklyReview.spokenSummary,
                explanation: weeklyReview.conciseSummary,
                spokenPrompt: weeklyReview.spokenSummary,
                weeklyReview,
            };
            this.recordConversationTurn(prompt, weeklyReviewResult);
            return weeklyReviewResult;
        }

        // Phase 5.10: Weekly Planning Proposal ("Plan my week", "Help me plan my week")
        if (weeklyReviewService.isWeeklyPlanQuery(prompt)) {
            const nowOpt = (options as any)?.now;
            const weeklyPlan = weeklyReviewService.generateWeeklyPlanProposal({
                now: nowOpt ? new Date(nowOpt as string | number) : undefined,
                context: options.context as Record<string, unknown>,
            });
            const weeklyPlanResult: CommandExecutionResult = {
                success: true,
                intent: "weekly_planning",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: weeklyPlan.proposalText,
                explanation: weeklyPlan.proposalText,
                spokenPrompt: weeklyPlan.spokenPrompt,
                weeklyPlan,
            };
            this.recordConversationTurn(prompt, weeklyPlanResult);
            return weeklyPlanResult;
        }

        // Phase 5.10: Scheduled Routines Management & Creation
        const schedIntent = this.parseScheduleIntent(prompt);
        if (schedIntent.isSchedule) {
            const schedResult = this.handleScheduleExecution(prompt, schedIntent);
            this.recordConversationTurn(prompt, schedResult);
            return schedResult;
        }

        // Phase 5.10: Conditional Automation Management & Creation
        const autoIntent = this.parseAutomationIntent(prompt);
        if (autoIntent.isAutomation) {
            const autoResult = this.handleAutomationExecution(prompt, autoIntent);
            this.recordConversationTurn(prompt, autoResult);
            return autoResult;
        }

        // Phase 6.1: Desktop Context Query ("What is my desktop context?", "Show desktop context")
        if (this.isDesktopContextQuery(prompt)) {
            const contextResult = this.handleDesktopContextExecution(prompt);
            this.recordConversationTurn(prompt, contextResult);
            return contextResult;
        }

        // Phase 6.1: Personal Knowledge / Local RAG Query
        if (this.isKnowledgeQuery(prompt)) {
            const knowledgeResult = this.handleKnowledgeExecution(prompt, options);
            this.recordConversationTurn(prompt, knowledgeResult);
            return knowledgeResult;
        }

        // Phase 5.8A: Daily Routine List Query ("What routines do you have?", "List routines")
        if (routineService.isRoutineListQuery(prompt)) {
            const routines = routineService.getRoutines();
            const listText = routineService.formatRoutinesList(routines);
            const spoken = routineService.formatRoutinesSpoken(routines);
            const listResult: CommandExecutionResult = {
                success: true,
                intent: "answer",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: listText,
                explanation: listText,
                spokenPrompt: spoken,
            };
            this.recordConversationTurn(prompt, listResult);
            return listResult;
        }

        // Phase 5.8A: Daily Routine Resolution & Orchestration
        const routineRes = routineService.resolveRoutine(prompt);
        if (routineRes.ambiguous) {
            const clarificationText =
                routineRes.clarificationPrompt ||
                routineRes.explanation ||
                "Multiple routines matched. Please clarify.";
            const ambiguousResult: CommandExecutionResult = {
                success: false,
                intent: "unknown",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: clarificationText,
                explanation: clarificationText,
                error: clarificationText,
                spokenPrompt: clarificationText,
            };
            this.recordConversationTurn(prompt, ambiguousResult);
            return ambiguousResult;
        }

        if (routineRes.matched && routineRes.routine) {
            const routine = routineRes.routine;

            // Phase 5.8C: Active Session Protection
            // If starting a coding routine and a focus/coding session is already active, prevent duplicate session
            if (routine.id === "routine_coding_mode" && focusService.isSessionActive()) {
                const summary = focusService.getFocusSummary();
                const remainingMin = Math.ceil(summary.remainingSeconds / 60);
                const sessionName = summary.sessionName || "Coding Session";
                const isPaused = summary.state === "paused";
                const explanation = isPaused
                    ? `You already have an active coding session ('${sessionName}'), which is currently paused with ${remainingMin} minute(s) remaining.`
                    : `You already have an active coding session ('${sessionName}') with ${remainingMin} minute(s) remaining.`;
                const spoken = `You already have an active coding session.`;
                const alreadyActiveResult: CommandExecutionResult = {
                    success: false,
                    intent: "answer",
                    appName: null,
                    executable: null,
                    executed: false,
                    responseType: "answer",
                    answerText: explanation,
                    explanation,
                    spokenPrompt: spoken,
                };
                this.recordConversationTurn(prompt, alreadyActiveResult);
                return alreadyActiveResult;
            }

            // 1. Validate routine definition against ToolRegistry and security policies
            const routineValidation = routineService.validateRoutine(routine);
            if (!routineValidation.valid) {
                logger.warn(`CommandAgentService: Routine validation failed -> ${routineValidation.error}`);
                const rejectedResult: CommandExecutionResult = {
                    success: false,
                    intent: "unknown",
                    appName: null,
                    executable: null,
                    executed: false,
                    error: routineValidation.error || "Routine validation failed.",
                    explanation: routineValidation.error || "Routine validation failed.",
                };
                this.recordConversationTurn(prompt, rejectedResult);
                return rejectedResult;
            }

            // Phase 5.8C: Resolve Coding Session Duration
            // Hierarchy: 1) Explicit duration in prompt, 2) Memory preference, 3) Preset/Routine Default (45/60 min)
            let resolvedDuration: number | undefined;
            const explicitDurationMatch = prompt.match(/\b(\d+)\s*(?:minutes?|mins?)\b/i);
            if (explicitDurationMatch) {
                const parsed = parseInt(explicitDurationMatch[1], 10);
                const check = focusService.validateDuration(parsed);
                if (!check.valid) {
                    const rejectedResult: CommandExecutionResult = {
                        success: false,
                        intent: "unknown",
                        appName: null,
                        executable: null,
                        executed: false,
                        error: check.error || "Invalid duration requested.",
                        explanation: check.error || "Invalid duration requested.",
                    };
                    this.recordConversationTurn(prompt, rejectedResult);
                    return rejectedResult;
                }
                resolvedDuration = check.durationMinutes;
            } else {
                // Check stored user memory for preferred session duration
                try {
                    // Check workflow/workspace preferences or all enabled memories
                    const allMemories = memoryService.getAll({ enabledOnly: true });
                    for (const m of allMemories) {
                        const contentLower = m.content.toLowerCase();
                        if (
                            contentLower.includes("coding") ||
                            contentLower.includes("session") ||
                            contentLower.includes("focus") ||
                            m.category === "WORKFLOW_PREFERENCE"
                        ) {
                            const mMatch = m.content.match(/\b(\d+)[- ]*(?:minutes?|mins?)\b/i);
                            if (mMatch) {
                                const parsedMem = parseInt(mMatch[1], 10);
                                const check = focusService.validateDuration(parsedMem);
                                if (check.valid && check.durationMinutes) {
                                    resolvedDuration = check.durationMinutes;
                                    break;
                                }
                            }
                        }
                    }
                } catch {
                    // Memory failure is non-fatal
                }
            }

            // 2. Convert to strongly typed AgentPlan
            const rawPlan = routineService.routineToAgentPlan(routine, prompt);

            // Inject duration and session metadata into start_deep_work step
            for (const call of rawPlan.toolCalls) {
                if (call.tool === "start_deep_work") {
                    const dur = resolvedDuration !== undefined ? resolvedDuration : 45;
                    const ws = routine.id === "routine_coding_mode"
                        ? "DSA"
                        : routine.id === "routine_datascience_mode"
                        ? "Data Science"
                        : routine.id === "routine_ml_mode"
                        ? "Machine Learning"
                        : routine.id === "routine_hackathon_mode"
                        ? "Hackathon"
                        : undefined;
                    call.arguments = {
                        ...(call.arguments || {}),
                        durationMinutes: dur,
                        workspace: ws,
                        application: "VS Code",
                    };
                }
            }

            // 3. Validate plan with strict bounds, tool whitelist, and parameter checks
            const planValidation = validateAgentPlan(rawPlan, { strict: true });
            if (!planValidation.valid) {
                logger.warn(`CommandAgentService: Routine agent plan validation failed -> ${planValidation.error}`);
                const rejectedResult: CommandExecutionResult = {
                    success: false,
                    intent: "unknown",
                    appName: null,
                    executable: null,
                    executed: false,
                    error: planValidation.error || "Routine plan validation failed.",
                    explanation: planValidation.error || "Routine plan validation failed.",
                };
                this.recordConversationTurn(prompt, rejectedResult);
                return rejectedResult;
            }

            const validatedPlan = planValidation.plan || rawPlan;

            // 4. Evaluate plan risk deterministically
            const risk = evaluatePlanRisk(validatedPlan);

            // 5. Gather fresh Agent Context Snapshot
            const effectiveContext: Record<string, unknown> = {
                ...((options.context as Record<string, unknown>) || {}),
            };
            if (!effectiveContext.recentConversation && !effectiveContext.conversationHistory) {
                const recentTurns = conversationContextService.getRecentTurns();
                effectiveContext.recentConversation = recentTurns;
                effectiveContext.conversationHistory = recentTurns;
            }
            const agentSnapshot: AgentContextSnapshot = agentContextService.getContextSnapshot({
                query: prompt,
                tasks: (effectiveContext.tasks || taskService.getTasks()) as any,
                goals: (effectiveContext.goals || goalService.getGoals()) as any,
                projects: (effectiveContext.projects || projectService.getProjects()) as any,
                workspaces: (effectiveContext.workspaces || workspaceService.getWorkspaces()) as any,
                focus: effectiveContext.focus as any,
                activity: effectiveContext.activity as any,
                streak: effectiveContext.streak as any,
            });
            effectiveContext.agentContext = agentSnapshot;

            // Clear any stale unapproved confirmation
            if (confirmationStore.size() > 0) {
                confirmationStore.clear();
            }

            // Permission check: productivity_mutation
            if (!settingsService.isPermitted("productivity_mutation")) {
                const blocked = "Productivity mutations are disabled in ALFRED Settings.";
                return {
                    success: false,
                    intent: "cancelled",
                    appName: null,
                    executable: null,
                    executed: false,
                    responseType: "answer",
                    answerText: blocked,
                    explanation: blocked,
                    spokenPrompt: blocked,
                    error: blocked,
                };
            }

            // 6. Confirmation Gate: Routines contain multiple steps and require approval
            logger.info(
                `CommandAgentService: Routine '${routine.name}' resolved with ${validatedPlan.toolCalls.length} steps. Halting for user confirmation.`
            );
            const pending = confirmationStore.createPendingConfirmation(
                validatedPlan,
                risk,
                prompt,
                effectiveContext,
                options as ToolExecutionOptions
            );

            const agenticPlan = agenticPlannerService.createAgenticPlan(
                pending.id,
                validatedPlan,
                risk,
                prompt,
                agentSnapshot
            );

            const result: CommandExecutionResult = {
                success: true,
                intent: "agentic_plan",
                appName: routine.name,
                executable: null,
                executed: false,
                responseType: "action",
                requiresConfirmation: true,
                confirmationId: pending.id,
                risk,
                plan: validatedPlan,
                agenticPlan,
                routine,
                explanation: agenticPlan.previewSummary,
                answerText: agenticPlan.spokenPrompt,
            };
            this.recordConversationTurn(prompt, result);
            return result;
        }

        // If a new instruction arrives, clear any stale unapproved confirmation
        if (confirmationStore.size() > 0) {
            confirmationStore.clear();
        }

        const activeProviderId = (options as any)?.isMock ? "mock" : providerConfigService.getActiveProviderId();

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
            isMock: Boolean((options as any)?.isMock),
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
        if (!effectiveContext.workspaces) {
            effectiveContext.workspaces = workspaceService.getWorkspaces();
        }

        // Phase 5.5A & 5.7: Canonical fresh Agent Context Snapshot (with bounded query-relevant memory)
        const agentSnapshot: AgentContextSnapshot = agentContextService.getContextSnapshot({
            query: prompt,
            tasks: effectiveContext.tasks as any,
            goals: effectiveContext.goals as any,
            projects: effectiveContext.projects as any,
            workspaces: effectiveContext.workspaces as any,
            focus: effectiveContext.focus as any,
            activity: effectiveContext.activity as any,
            streak: effectiveContext.streak as any,
        });
        effectiveContext.agentContext = agentSnapshot;

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
                const isRec = recommendationAgentService.isRecommendationQuery(prompt);
                let recResult: RecommendationResult | undefined;
                if (isRec) {
                    recResult = recommendationAgentService.generateRecommendations(agentSnapshot);
                }

                const answerResult: CommandExecutionResult = {
                    success: true,
                    intent: isRec ? "recommendation" : "answer",
                    appName: null,
                    executable: null,
                    executed: false,
                    providerId: activeProviderId,
                    responseType: "answer",
                    answerText,
                    explanation: rawPlan.explanation,
                    recommendations: recResult?.recommendations,
                    recommendationResult: recResult,
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

                    if (risk.mutationCount > 0 && !settingsService.isPermitted("productivity_mutation")) {
                        const blocked = "Productivity mutations are disabled in ALFRED Settings.";
                        return {
                            success: false,
                            intent: "cancelled",
                            appName: null,
                            executable: null,
                            executed: false,
                            responseType: "answer",
                            answerText: blocked,
                            explanation: blocked,
                            spokenPrompt: blocked,
                            error: blocked,
                        };
                    }

                    // Step 4: Confirmation Gate (Phase 4.16 Risk & Phase 5.6 Agentic Planning)
                    const objectiveInfo = detectObjective(prompt, effectiveContext);
                    const isMultiStep = (validatedPlan.toolCalls && validatedPlan.toolCalls.length > 1);

                    if (risk.requiresConfirmation || objectiveInfo.isObjective || isMultiStep) {
                        logger.info(
                            `CommandAgentService: Agentic plan detected (steps: ${validatedPlan.toolCalls?.length || 0}, risk: ${risk.level}, objective: ${objectiveInfo.isObjective}). Halting for user confirmation.`
                        );
                        const pending = confirmationStore.createPendingConfirmation(
                            validatedPlan,
                            risk,
                            prompt,
                            effectiveContext,
                            options as ToolExecutionOptions
                        );
                        const agenticPlan = agenticPlannerService.createAgenticPlan(
                            pending.id,
                            validatedPlan,
                            risk,
                            prompt,
                            agentSnapshot
                        );

                        // Security Guarantee: NEVER execute tool, NEVER record mutations in conversation context
                        const result: CommandExecutionResult = {
                            success: true,
                            intent: "agentic_plan",
                            appName: null,
                            executable: null,
                            executed: false,
                            providerId: activeProviderId,
                            responseType: "action",
                            requiresConfirmation: true,
                            confirmationId: pending.id,
                            risk,
                            plan: validatedPlan,
                            agenticPlan,
                            explanation: agenticPlan.previewSummary,
                            answerText: agenticPlan.spokenPrompt,
                        };
                        this.recordConversationTurn(prompt, result);
                        return result;
                    }

                    // Step 5: Execute plan directly (confirmation not required for simple single actions)
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

        // Phase 5.7: Controlled Memory Mutation Execution (Section 6, 12, 13, 14)
        if (pending.memoryProposal) {
            const proposal = pending.memoryProposal;
            let explanation = "";
            let spokenText = "";
            let memoryItem: MemoryItem | undefined;

            if (proposal.type === "create") {
                const saveRes = memoryService.save({
                    category: proposal.memory.category,
                    content: proposal.memory.content,
                    source: "user_confirmed",
                    metadata: proposal.memory.metadata,
                });
                if (!saveRes.success) {
                    return {
                        success: false,
                        intent: "memory_proposal",
                        appName: null,
                        executable: null,
                        executed: false,
                        error: saveRes.error,
                        explanation: saveRes.error,
                    };
                }
                memoryItem = saveRes.memory;
                explanation = `Saved preference: "${memoryItem?.content}"`;
                spokenText = "Saved.";
            } else if (proposal.type === "update") {
                const targetId = proposal.existingMemory?.id;
                if (!targetId) {
                    return {
                        success: false,
                        intent: "memory_proposal",
                        appName: null,
                        executable: null,
                        executed: false,
                        error: "Could not find existing memory to update.",
                        explanation: "Could not find existing memory to update.",
                    };
                }
                const updateRes = memoryService.update(targetId, {
                    content: proposal.memory.content,
                    category: proposal.memory.category,
                });
                if (!updateRes.success) {
                    return {
                        success: false,
                        intent: "memory_proposal",
                        appName: null,
                        executable: null,
                        executed: false,
                        error: updateRes.error,
                        explanation: updateRes.error,
                    };
                }
                memoryItem = updateRes.memory;
                explanation = `Updated preference: "${memoryItem?.content}"`;
                spokenText = "Preference updated.";
            } else if (proposal.type === "delete_all") {
                const ids = (proposal.targetMemories || []).map((m) => m.id);
                memoryService.deleteMany(ids);
                explanation = `Removed ${ids.length} saved memory item(s).`;
                spokenText = "Memories removed.";
            } else if (proposal.type === "delete") {
                const targetId = proposal.existingMemory?.id || (proposal.targetMemories && proposal.targetMemories[0]?.id);
                if (targetId) {
                    memoryService.delete(targetId);
                    explanation = `Removed memory: "${proposal.existingMemory?.content || proposal.memory.content}"`;
                    spokenText = "Memory removed.";
                } else {
                    explanation = "No matching memory found to remove.";
                    spokenText = "No memory removed.";
                }
            }

            const freshSnapshot = agentContextService.getContextSnapshot();
            return {
                success: true,
                intent: "memory_confirmed",
                appName: null,
                executable: null,
                executed: true,
                confirmed: true,
                memoryItem,
                responseType: "answer",
                answerText: spokenText,
                explanation,
                spokenPrompt: spokenText,
                agentSnapshot: freshSnapshot,
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
        const activeProviderId = pending.options?.isMock ? "mock" : providerConfigService.getActiveProviderId();
        const orchResult = await agentOrchestrator.executePlan(planToExecute, {
            isMock: pending.options?.isMock,
            context: pending.context,
        });

        // 4. Map orchestration result and mark as confirmed
        const mapped = this.mapOrchestrationResult(orchResult, activeProviderId, pending.risk);
        mapped.confirmed = true;

        // Phase 5.6: Obtain fresh AgentContextSnapshot post-execution (Section 15)
        const freshSnapshot = agentContextService.getContextSnapshot();
        mapped.agentSnapshot = freshSnapshot;

        // Phase 5.6: Format execution outcome summary (Section 14)
        const outcome = agenticPlannerService.formatExecutionOutcome(
            pending.userRequest,
            orchResult.results,
            freshSnapshot
        );
        mapped.explanation = outcome.summary;
        mapped.answerText = outcome.spokenText;

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

        const pending = confirmationStore.getPendingConfirmation(confirmationId);
        const isMemory = pending?.memoryProposal !== undefined;
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
            responseType: "answer",
            answerText: isMemory ? "Memory action cancelled. No changes were made." : "Action execution cancelled. Zero tools were executed.",
            explanation: isMemory ? "Memory proposal cancelled by user." : "Action execution cancelled by user.",
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
                appName = (args.workspaceName || args.workspace || args.name || null) as string | null;
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
                explanation: multiStepSummary || (toolDataObj?.summary as string) || orchResult.plan?.explanation,
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
            if (resolution.intent === "recommendation") {
                const snapshot = agentContextService.getContextSnapshot();
                const recResult = recommendationAgentService.generateRecommendations(snapshot);
                const explanation = recommendationAgentService.formatConversationalExplanation(recResult);
                return {
                    success: true,
                    intent: "recommendation",
                    appName: null,
                    executable: null,
                    executed: false,
                    providerId: "mock",
                    responseType: "answer",
                    answerText: explanation,
                    explanation,
                    recommendations: recResult.recommendations,
                    recommendationResult: recResult,
                };
            }

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

    private parseScheduleIntent(prompt: string): {
        isSchedule: boolean;
        isList?: boolean;
        isDelete?: boolean;
        isToggle?: boolean;
        enable?: boolean;
        targetId?: string;
        scheduleInput?: CreateScheduleInput;
        clarification?: string;
    } {
        const clean = prompt.trim();
        const lower = clean.toLowerCase();

        // 1. Listing
        if (/^(?:what\s+routines\s+are\s+scheduled|list\s+schedules?|show\s+(?:my\s+)?schedules?|view\s+schedules?|what\s+is\s+scheduled)$/i.test(lower)) {
            return { isSchedule: true, isList: true };
        }

        // 2. Delete
        const deleteMatch = lower.match(/^(?:delete|remove)\s+schedule\s+(.+)$/i);
        if (deleteMatch) {
            return { isSchedule: true, isDelete: true, targetId: deleteMatch[1].trim() };
        }

        // 3. Enable / Disable
        const toggleMatch = lower.match(/^(enable|disable)\s+schedule\s+(.+)$/i);
        if (toggleMatch) {
            return { isSchedule: true, isToggle: true, enable: toggleMatch[1] === "enable", targetId: toggleMatch[2].trim() };
        }

        // 4. Creation patterns:
        // Examples:
        // "Every weekday at 7 PM, start Coding Mode."
        // "Every morning at 8 AM, give me my morning briefing."
        // "Every Sunday at 7 PM, give me my weekly review."
        // "Schedule coding mode every weekday at 7 PM"
        const isScheduleCreate = /^(?:every|schedule)\b/i.test(lower);
        if (isScheduleCreate) {
            // Days of week extraction
            let daysOfWeek = [0, 1, 2, 3, 4, 5, 6];
            if (/\b(?:weekdays?)\b/i.test(lower)) {
                daysOfWeek = [1, 2, 3, 4, 5];
            } else if (/\b(?:weekends?)\b/i.test(lower)) {
                daysOfWeek = [0, 6];
            } else if (/\bsunday\b/i.test(lower)) {
                daysOfWeek = [0];
            } else if (/\bmonday\b/i.test(lower)) {
                daysOfWeek = [1];
            } else if (/\btuesday\b/i.test(lower)) {
                daysOfWeek = [2];
            } else if (/\bwednesday\b/i.test(lower)) {
                daysOfWeek = [3];
            } else if (/\bthursday\b/i.test(lower)) {
                daysOfWeek = [4];
            } else if (/\bfriday\b/i.test(lower)) {
                daysOfWeek = [5];
            } else if (/\bsaturday\b/i.test(lower)) {
                daysOfWeek = [6];
            }

            // Time extraction
            const timeMatch = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
            if (!timeMatch) {
                return { isSchedule: true, clarification: "At what time would you like to schedule this? (e.g. 7 PM or 8 AM)" };
            }

            let hour = parseInt(timeMatch[1], 10);
            const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            const ampm = timeMatch[3]?.toLowerCase();

            if (ampm === "pm" && hour < 12) hour += 12;
            if (ampm === "am" && hour === 12) hour = 0;

            // Target extraction
            let targetType: ScheduleTargetType | undefined;
            let targetId: string | undefined;
            let name = "Scheduled Routine";

            if (/\b(?:coding\s+mode|coding|dsa)\b/i.test(lower)) {
                targetType = "routine";
                targetId = "coding-mode";
                name = "Coding Mode";
            } else if (/\b(?:morning\s+briefing|briefing)\b/i.test(lower)) {
                targetType = "briefing";
                name = "Morning Briefing";
            } else if (/\b(?:weekly\s+review)\b/i.test(lower)) {
                targetType = "weekly_review";
                name = "Weekly Review";
            } else if (/\b(?:end\s+of\s+day\s+review|daily\s+review)\b/i.test(lower)) {
                targetType = "review";
                name = "End of Day Review";
            } else if (/\b(?:data\s+science\s+mode)\b/i.test(lower)) {
                targetType = "routine";
                targetId = "data-science-mode";
                name = "Data Science Mode";
            }

            // Ambiguity check: e.g. "Every evening at 7" without target
            if (!targetType) {
                const formattedTime = `${hour > 12 ? hour - 12 : hour || 12}:${minute.toString().padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
                return {
                    isSchedule: true,
                    clarification: `What routine or action would you like scheduled at ${formattedTime}? (e.g. Coding Mode, Morning Briefing, Weekly Review)`,
                };
            }

            return {
                isSchedule: true,
                scheduleInput: {
                    name,
                    targetType,
                    targetId,
                    hour,
                    minute,
                    daysOfWeek,
                },
            };
        }

        return { isSchedule: false };
    }

    private handleScheduleExecution(
        _prompt: string,
        parseResult: ReturnType<typeof this.parseScheduleIntent>
    ): CommandExecutionResult {
        if (parseResult.clarification) {
            return {
                success: false,
                intent: "unknown",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: parseResult.clarification,
                explanation: parseResult.clarification,
                spokenPrompt: parseResult.clarification,
            };
        }

        if (parseResult.isList) {
            const list = routineScheduler.getSchedules();
            let text = "Here are your scheduled routines:\n";
            if (list.length === 0) {
                text = "No routines are currently scheduled.";
            } else {
                text += list
                    .map(
                        (s) =>
                            `• ${s.name}: ${s.hour.toString().padStart(2, "0")}:${s.minute.toString().padStart(2, "0")} (${s.enabled ? "Active" : "Disabled"})`
                    )
                    .join("\n");
            }
            const spoken =
                list.length === 0
                    ? "You have no scheduled routines."
                    : `You have ${list.length} scheduled routine${list.length === 1 ? "" : "s"}.`;
            return {
                success: true,
                intent: "schedule",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: text,
                explanation: text,
                spokenPrompt: spoken,
                schedules: list,
            };
        }

        if (parseResult.isDelete) {
            const target = parseResult.targetId || "";
            const found = routineScheduler
                .getSchedules()
                .find((s) => s.id === target || s.name.toLowerCase().includes(target.toLowerCase()));
            if (!found) {
                return {
                    success: false,
                    intent: "schedule",
                    appName: null,
                    executable: null,
                    executed: false,
                    error: `Schedule '${target}' not found.`,
                    answerText: `Schedule '${target}' not found.`,
                };
            }
            routineScheduler.deleteSchedule(found.id);
            return {
                success: true,
                intent: "schedule",
                appName: null,
                executable: null,
                executed: true,
                answerText: `Deleted schedule for '${found.name}'.`,
                spokenPrompt: `Deleted schedule for ${found.name}.`,
            };
        }

        if (parseResult.isToggle) {
            const target = parseResult.targetId || "";
            const found = routineScheduler
                .getSchedules()
                .find((s) => s.id === target || s.name.toLowerCase().includes(target.toLowerCase()));
            if (!found) {
                return {
                    success: false,
                    intent: "schedule",
                    appName: null,
                    executable: null,
                    executed: false,
                    error: `Schedule '${target}' not found.`,
                    answerText: `Schedule '${target}' not found.`,
                };
            }
            const updated = routineScheduler.setEnabled(found.id, parseResult.enable ?? true);
            return {
                success: true,
                intent: "schedule",
                appName: null,
                executable: null,
                executed: true,
                schedule: updated.schedule,
                answerText: `Schedule '${found.name}' is now ${parseResult.enable ? "enabled" : "disabled"}.`,
                spokenPrompt: `Schedule for ${found.name} is now ${parseResult.enable ? "enabled" : "disabled"}.`,
            };
        }

        if (parseResult.scheduleInput) {
            const created = routineScheduler.createSchedule(parseResult.scheduleInput);
            if (!created.success || !created.schedule) {
                return {
                    success: false,
                    intent: "schedule",
                    appName: null,
                    executable: null,
                    executed: false,
                    error: created.error,
                    answerText: created.error || "Failed to create schedule.",
                };
            }
            const sched = created.schedule;
            const timeFormatted = `${sched.hour.toString().padStart(2, "0")}:${sched.minute.toString().padStart(2, "0")}`;
            const daysText =
                sched.daysOfWeek.length === 5 && !sched.daysOfWeek.includes(0) && !sched.daysOfWeek.includes(6)
                    ? "on weekdays"
                    : sched.daysOfWeek.length === 1 && sched.daysOfWeek[0] === 0
                    ? "on Sundays"
                    : "daily";
            const answerText = `Scheduled '${sched.name}' at ${timeFormatted} ${daysText}.`;
            const spoken = `Scheduled ${sched.name} for ${timeFormatted}.`;
            return {
                success: true,
                intent: "schedule",
                appName: null,
                executable: null,
                executed: true,
                schedule: sched,
                responseType: "action",
                answerText,
                explanation: answerText,
                spokenPrompt: spoken,
            };
        }

        return {
            success: false,
            intent: "unknown",
            appName: null,
            executable: null,
            executed: false,
            error: "Unable to process schedule request.",
        };
    }

    private parseAutomationIntent(prompt: string): {
        isAutomation: boolean;
        isList?: boolean;
        isDelete?: boolean;
        isToggle?: boolean;
        enable?: boolean;
        targetId?: string;
        automationInput?: CreateAutomationInput;
        clarification?: string;
    } {
        const clean = prompt.trim();
        const lower = clean.toLowerCase();

        // 1. Listing
        if (/^(?:list\s+automations?|show\s+(?:my\s+)?automations?|what\s+automations?\s+are\s+active|view\s+automations?)$/i.test(lower)) {
            return { isAutomation: true, isList: true };
        }

        // 2. Delete
        const deleteMatch = lower.match(/^(?:delete|remove)\s+automation\s+(.+)$/i);
        if (deleteMatch) {
            return { isAutomation: true, isDelete: true, targetId: deleteMatch[1].trim() };
        }

        // 3. Enable / Disable
        const toggleMatch = lower.match(/^(enable|disable)\s+automation\s+(.+)$/i);
        if (toggleMatch) {
            return { isAutomation: true, isToggle: true, enable: toggleMatch[1] === "enable", targetId: toggleMatch[2].trim() };
        }

        // 4. Creation patterns:
        // Examples:
        // "If my coding session finishes, notify me."
        // "When I complete a task, update me with what I should work on next."
        const isAutoPattern = /^(?:if|when)\b/i.test(lower);
        if (isAutoPattern) {
            let eventType: AppEventType | undefined;
            let actionType: AutomationActionType | undefined;
            let name = "Conditional Automation";
            let routineId: string | undefined;

            if (/\b(?:coding\s+session\s+(?:finishes|completes?|ends?)|focus\s+(?:session\s+)?(?:completes?|finishes|ends?))\b/i.test(lower)) {
                eventType = "focus_completed";
            } else if (/\b(?:complete\s+(?:a\s+)?task|task\s+(?:completed|done|finished))\b/i.test(lower)) {
                eventType = "task_completed";
            } else if (/\b(?:focus\s+started|start\s+coding)\b/i.test(lower)) {
                eventType = "focus_started";
            }

            if (/\b(?:notify\s+me|send\s+notification|alert\s+me)\b/i.test(lower)) {
                actionType = "notification";
            } else if (/\b(?:recommend|update\s+me\s+with\s+what\s+i\s+should\s+work\s+on|what\s+to\s+work\s+on\s+next|next\s+task)\b/i.test(lower)) {
                actionType = "recommendation";
            } else if (/\b(?:briefing)\b/i.test(lower)) {
                actionType = "briefing";
            } else if (/\b(?:review)\b/i.test(lower)) {
                actionType = "review";
            } else if (/\b(?:start\s+coding|coding\s+mode)\b/i.test(lower)) {
                actionType = "propose_routine";
                routineId = "coding-mode";
            }

            if (!eventType || !actionType) {
                return {
                    isAutomation: true,
                    clarification: "Please specify both the event trigger and action (e.g. 'If my coding session finishes, notify me' or 'When I complete a task, recommend what to work on next').",
                };
            }

            if (eventType === "focus_completed" && actionType === "notification") {
                name = "Notify when coding finishes";
            } else if (eventType === "task_completed" && actionType === "recommendation") {
                name = "Recommend next task on completion";
            } else {
                name = `${actionType} on ${eventType}`;
            }

            return {
                isAutomation: true,
                automationInput: {
                    name,
                    eventType,
                    action: {
                        type: actionType,
                        params: {
                            title: name,
                            message: `Automation triggered for ${eventType}.`,
                            routineId,
                        },
                    },
                    cooldownSeconds: 30,
                },
            };
        }

        return { isAutomation: false };
    }

    private handleAutomationExecution(
        _prompt: string,
        parseResult: ReturnType<typeof this.parseAutomationIntent>
    ): CommandExecutionResult {
        if (parseResult.clarification) {
            return {
                success: false,
                intent: "unknown",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: parseResult.clarification,
                explanation: parseResult.clarification,
                spokenPrompt: parseResult.clarification,
            };
        }

        if (parseResult.isList) {
            const rules = conditionalAutomationService.getRules();
            let text = "Active conditional automations:\n";
            if (rules.length === 0) {
                text = "No conditional automations are currently configured.";
            } else {
                text += rules
                    .map(
                        (r) =>
                            `• ${r.name} (Trigger: ${r.eventType}, Action: ${r.action.type}, ${r.enabled ? "Enabled" : "Disabled"})`
                    )
                    .join("\n");
            }
            const spoken =
                rules.length === 0
                    ? "You have no conditional automations."
                    : `You have ${rules.length} conditional automation${rules.length === 1 ? "" : "s"}.`;
            return {
                success: true,
                intent: "automation",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: text,
                explanation: text,
                spokenPrompt: spoken,
                automations: rules,
            };
        }

        if (parseResult.isDelete) {
            const target = parseResult.targetId || "";
            const found = conditionalAutomationService
                .getRules()
                .find((r) => r.id === target || r.name.toLowerCase().includes(target.toLowerCase()));
            if (!found) {
                return {
                    success: false,
                    intent: "automation",
                    appName: null,
                    executable: null,
                    executed: false,
                    error: `Automation '${target}' not found.`,
                    answerText: `Automation '${target}' not found.`,
                };
            }
            conditionalAutomationService.deleteRule(found.id);
            return {
                success: true,
                intent: "automation",
                appName: null,
                executable: null,
                executed: true,
                answerText: `Deleted automation '${found.name}'.`,
                spokenPrompt: `Deleted automation ${found.name}.`,
            };
        }

        if (parseResult.isToggle) {
            const target = parseResult.targetId || "";
            const found = conditionalAutomationService
                .getRules()
                .find((r) => r.id === target || r.name.toLowerCase().includes(target.toLowerCase()));
            if (!found) {
                return {
                    success: false,
                    intent: "automation",
                    appName: null,
                    executable: null,
                    executed: false,
                    error: `Automation '${target}' not found.`,
                    answerText: `Automation '${target}' not found.`,
                };
            }
            const updated = conditionalAutomationService.setEnabled(found.id, parseResult.enable ?? true);
            return {
                success: true,
                intent: "automation",
                appName: null,
                executable: null,
                executed: true,
                automation: updated.rule,
                answerText: `Automation '${found.name}' is now ${parseResult.enable ? "enabled" : "disabled"}.`,
                spokenPrompt: `Automation for ${found.name} is now ${parseResult.enable ? "enabled" : "disabled"}.`,
            };
        }

        if (parseResult.automationInput) {
            const created = conditionalAutomationService.createRule(parseResult.automationInput);
            if (!created.success || !created.rule) {
                return {
                    success: false,
                    intent: "automation",
                    appName: null,
                    executable: null,
                    executed: false,
                    error: created.error,
                    answerText: created.error || "Failed to create automation rule.",
                };
            }
            const rule = created.rule;
            const answerText = `Created automation '${rule.name}': When '${rule.eventType}' occurs, ALFRED will trigger '${rule.action.type}'.`;
            const spoken = `Configured automation: ${rule.name}.`;
            return {
                success: true,
                intent: "automation",
                appName: null,
                executable: null,
                executed: true,
                automation: rule,
                responseType: "action",
                answerText,
                explanation: answerText,
                spokenPrompt: spoken,
            };
        }

        return {
            success: false,
            intent: "unknown",
            appName: null,
            executable: null,
            executed: false,
            error: "Unable to process automation request.",
        };
    }

    public isDesktopContextQuery(prompt: string): boolean {
        const lower = prompt.toLowerCase().trim();
        return (
            lower === "what is my desktop context" ||
            lower === "what's my desktop context" ||
            lower === "desktop context" ||
            lower === "show desktop context" ||
            lower === "my desktop context"
        );
    }

    public handleDesktopContextExecution(prompt: string): CommandExecutionResult {
        const snapshot = desktopContextService.getContextSnapshot();
        const summary = desktopContextService.formatContextSummary();
        return {
            success: true,
            intent: "desktop_context",
            appName: null,
            executable: null,
            executed: false,
            responseType: "answer",
            answerText: summary,
            explanation: summary,
            spokenPrompt: summary,
            desktopContext: snapshot,
        };
    }

    public isKnowledgeQuery(prompt: string): boolean {
        const lower = prompt.toLowerCase().trim();
        return (
            lower.startsWith("what did i decide about") ||
            lower.startsWith("what did i decide regarding") ||
            lower.startsWith("find information about") ||
            lower.startsWith("search my knowledge") ||
            lower.startsWith("search knowledge") ||
            lower.startsWith("what was the approach we used") ||
            lower.startsWith("what was the approach for") ||
            lower.startsWith("summarize this document") ||
            lower.startsWith("summarize the document") ||
            lower.startsWith("summarize the knowledge for") ||
            lower.startsWith("summarize my knowledge for") ||
            lower.startsWith("what documents are related to") ||
            /search\s+(?:my\s+)?(?:[\w-]+\s+)?(?:knowledge|notes|documents?)/i.test(lower) ||
            /find\s+information\s+about/i.test(lower) ||
            /what\s+did\s+i\s+decide/i.test(lower) ||
            /what\s+was\s+the\s+approach/i.test(lower)
        );
    }

    public handleKnowledgeExecution(prompt: string, options?: any): CommandExecutionResult {
        if (!settingsService.isPermitted("knowledge_access")) {
            const blockedText = "Knowledge base access is currently disabled in ALFRED Settings.";
            return {
                success: false,
                intent: "knowledge_search",
                appName: null,
                executable: null,
                executed: false,
                responseType: "answer",
                answerText: blockedText,
                explanation: blockedText,
                spokenPrompt: blockedText,
                error: blockedText,
            };
        }

        const lower = prompt.toLowerCase().trim();
        let projectScope: string | undefined;
        const projects = projectService.getProjects();
        for (const p of projects) {
            if (lower.includes(p.name.toLowerCase())) {
                projectScope = String(p.id);
                break;
            }
        }

        let cleanQuery = prompt
            .replace(/^(?:what did i decide about|what did i decide regarding|find information about|search my knowledge for|search knowledge for|what was the approach we used for|what was the approach for|summarize the knowledge for|summarize my knowledge for|what documents are related to)\s*/i, "")
            .replace(/^(?:search|find|query)\s+(?:my\s+)?(?:[\w-]+\s+)?(?:knowledge|notes|documents?)\s*(?:for|about|on)?\s*/i, "")
            .trim();

        if (!cleanQuery) {
            cleanQuery = prompt;
        }

        const searchResults = knowledgeService.search({
            query: cleanQuery,
            projectId: projectScope,
            limit: 5,
        });

        const formatted = knowledgeService.formatAnswer(cleanQuery, searchResults);

        return {
            success: true,
            intent: "knowledge_search",
            appName: null,
            executable: null,
            executed: false,
            responseType: "answer",
            answerText: formatted.text,
            explanation: formatted.text,
            spokenPrompt: formatted.spokenText,
            knowledgeResults: searchResults,
        };
    }
}

export const commandAgentService = new CommandAgentService();
