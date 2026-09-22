"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const risk_1 = require("./risk");
const command_agent_service_1 = require("./command-agent.service");
const conversation_context_service_1 = require("../services/conversation-context.service");
const task_service_1 = require("../services/task.service");
const goal_service_1 = require("../services/goal.service");
const project_service_1 = require("../services/project.service");
const provider_config_service_1 = require("./providers/config/provider-config.service");
const tools_1 = require("./tools");
require("./providers/index");
// Register default tools
(0, tools_1.registerDefaultTools)();
/**
 * Phase 4.16 — Agent Confirmation & Risk Control Comprehensive Test Suite
 */
async function runAgentConfirmationRiskControlTests() {
    console.log("==========================================================================");
    console.log("ALFRED Phase 4.16 — Agent Confirmation & Risk Control Test Suite");
    console.log("==========================================================================\n");
    let passed = 0;
    let failed = 0;
    function assert(condition, testName, detail) {
        if (condition) {
            passed++;
            console.log(`✅ [PASS] ${testName}`);
            if (detail)
                console.log(`   Detail: ${detail}`);
        }
        else {
            failed++;
            console.log(`❌ [FAIL] ${testName}`);
            if (detail)
                console.log(`   Failure Detail: ${detail}`);
        }
    }
    // Helper: Reset services and context
    function resetEnvironment() {
        risk_1.confirmationStore.clear();
        conversation_context_service_1.conversationContextService.clear();
        task_service_1.taskService.syncTasks([]);
        goal_service_1.goalService.syncGoals([]);
        project_service_1.projectService.syncProjects([]);
        provider_config_service_1.providerConfigService.setActiveProviderId("mock");
    }
    resetEnvironment();
    // =========================================================================
    // SECTION 1: DETERMINISTIC RISK EVALUATION
    // =========================================================================
    console.log("--- 1. Deterministic Risk Evaluation ---");
    // 1. Answer plan -> low / no confirmation
    const answerPlan = {
        userRequest: "What is machine learning?",
        type: "answer",
        answerText: "Machine learning is a field of AI.",
        explanation: "Answer mode response",
        toolCalls: [],
    };
    const answerRisk = (0, risk_1.evaluatePlanRisk)(answerPlan);
    assert(answerRisk.level === "low" &&
        answerRisk.requiresConfirmation === false &&
        answerRisk.mutationCount === 0, "1. Answer plan evaluates to low risk with no confirmation required", `level: ${answerRisk.level}, requiresConfirmation: ${answerRisk.requiresConfirmation}, mutations: ${answerRisk.mutationCount}`);
    // 2. Low-risk action -> low / no confirmation
    const readOnlyPlan = {
        userRequest: "Open VS Code and check status",
        type: "action",
        explanation: "Launching application and system status",
        toolCalls: [
            { tool: "launch_application", arguments: { appName: "VS Code" } },
            { tool: "system_status", arguments: {} },
            { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" } },
            { tool: "navigate", arguments: { target: "dashboard" } },
        ],
    };
    const readOnlyRisk = (0, risk_1.evaluatePlanRisk)(readOnlyPlan);
    assert(readOnlyRisk.level === "low" &&
        readOnlyRisk.requiresConfirmation === false &&
        readOnlyRisk.mutationCount === 0, "2. Multi-step read-only/launch actions evaluate to low risk without confirmation", `level: ${readOnlyRisk.level}, requiresConfirmation: ${readOnlyRisk.requiresConfirmation}, mutations: ${readOnlyRisk.mutationCount}`);
    // 3. Single mutation -> medium / no confirmation
    const singleMutationPlan = {
        userRequest: "Create a task called Review PR",
        type: "action",
        explanation: "Creating a single task",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Review PR" } },
        ],
    };
    const singleRisk = (0, risk_1.evaluatePlanRisk)(singleMutationPlan);
    assert(singleRisk.level === "medium" &&
        singleRisk.requiresConfirmation === false &&
        singleRisk.mutationCount === 1, "3. Single productivity mutation evaluates to medium risk without confirmation required", `level: ${singleRisk.level}, requiresConfirmation: ${singleRisk.requiresConfirmation}, mutations: ${singleRisk.mutationCount}`);
    // 4. Multiple mutations -> high / confirmation required
    const multiMutationPlan = {
        userRequest: "Create task and create goal",
        type: "action",
        explanation: "Creating task and creating goal",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Audit Security Policy" } },
            { tool: "create_goal", arguments: { title: "Zero Vulnerabilities", target: 10 } },
        ],
    };
    const multiRisk = (0, risk_1.evaluatePlanRisk)(multiMutationPlan);
    assert(multiRisk.level === "high" &&
        multiRisk.requiresConfirmation === true &&
        multiRisk.mutationCount === 2, "4. Plans with 2+ productivity mutations evaluate to high risk requiring confirmation", `level: ${multiRisk.level}, requiresConfirmation: ${multiRisk.requiresConfirmation}, mutations: ${multiRisk.mutationCount}`);
    const threeMutationPlan = {
        userRequest: "Create task, create goal, and update project",
        type: "action",
        explanation: "Three mutations in one plan",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Task A" } },
            { tool: "create_goal", arguments: { title: "Goal B", target: 5 } },
            { tool: "update_project", arguments: { projectId: "proj-1", progress: 80 } },
        ],
    };
    const threeRisk = (0, risk_1.evaluatePlanRisk)(threeMutationPlan);
    assert(threeRisk.level === "high" &&
        threeRisk.requiresConfirmation === true &&
        threeRisk.mutationCount === 3, "4b. Plans with 3 productivity mutations evaluate to high risk with mutationCount: 3", `level: ${threeRisk.level}, requiresConfirmation: ${threeRisk.requiresConfirmation}, mutations: ${threeRisk.mutationCount}`);
    // 5. Risk evaluation is deterministic and provider-independent
    // Even if an AI provider tries to output custom fields or overrides, risk evaluator ignores them
    const maliciousPlanAttempt = {
        userRequest: "Multi mutation sneaky plan",
        type: "action",
        explanation: "AI claims this is low risk",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Task 1" } },
            { tool: "complete_task", arguments: { taskId: "task-1" } },
        ],
    };
    maliciousPlanAttempt.riskLevel = "low";
    maliciousPlanAttempt.requiresConfirmation = false;
    const providerIndepRisk = (0, risk_1.evaluatePlanRisk)(maliciousPlanAttempt);
    assert(providerIndepRisk.level === "high" &&
        providerIndepRisk.requiresConfirmation === true &&
        providerIndepRisk.mutationCount === 2, "5. Risk evaluation is strictly deterministic; AI cannot override risk policy", `level: ${providerIndepRisk.level}, requiresConfirmation: ${providerIndepRisk.requiresConfirmation}`);
    // =========================================================================
    // SECTION 2: CONFIRMATION GATE & LIFECYCLE
    // =========================================================================
    console.log("\n--- 2. Confirmation Gate & Lifecycle ---");
    resetEnvironment();
    // 6. High-risk plan pauses before execution
    const highRiskResult = await command_agent_service_1.commandAgentService.executeCommand("__test_high_risk_multi_mutation__", { isMock: true });
    assert(highRiskResult.requiresConfirmation === true &&
        typeof highRiskResult.confirmationId === "string" &&
        highRiskResult.executed === false, "6. High-risk plan pauses before execution and returns pending confirmation result", `requiresConfirmation: ${highRiskResult.requiresConfirmation}, id: ${highRiskResult.confirmationId}, executed: ${highRiskResult.executed}`);
    assert(task_service_1.taskService.getTasks().length === 0 && goal_service_1.goalService.getGoals().length === 0, "6b. Zero tools were executed when confirmation gate paused", `tasks: ${task_service_1.taskService.getTasks().length}, goals: ${goal_service_1.goalService.getGoals().length}`);
    // 7. Pending confirmation contains the exact validated plan
    const pendingId = highRiskResult.confirmationId;
    const pendingEntry = risk_1.confirmationStore.getPendingConfirmation(pendingId);
    assert(pendingEntry !== undefined &&
        pendingEntry.plan.toolCalls.length === 2 &&
        pendingEntry.plan.toolCalls[0].tool === "create_task" &&
        pendingEntry.plan.toolCalls[1].tool === "create_goal", "7. Pending confirmation in-memory store contains exact validated plan", `toolCount: ${pendingEntry?.plan.toolCalls.length}`);
    // 8. Confirm executes the stored plan
    const confirmResult = await command_agent_service_1.commandAgentService.confirmAction(pendingId);
    assert(confirmResult.success === true &&
        confirmResult.executed === true &&
        confirmResult.confirmed === true, "8. Confirming executes the stored validated plan", `success: ${confirmResult.success}, executed: ${confirmResult.executed}, confirmed: ${confirmResult.confirmed}`);
    assert(task_service_1.taskService.getTasks().length === 1 && goal_service_1.goalService.getGoals().length === 1, "8b. Mutations successfully applied after confirmation", `tasks: ${task_service_1.taskService.getTasks().length}, goals: ${goal_service_1.goalService.getGoals().length}`);
    // 9. Confirm executes it only once (pending confirmation cleared after consumption)
    const secondConfirmResult = await command_agent_service_1.commandAgentService.confirmAction(pendingId);
    assert(secondConfirmResult.success === false &&
        secondConfirmResult.executed === false &&
        Boolean(secondConfirmResult.error?.includes("already consumed")), "9. Consumed confirmation cannot be executed a second time (atomic consumption)", `error: ${secondConfirmResult.error}`);
    assert(task_service_1.taskService.getTasks().length === 1 && goal_service_1.goalService.getGoals().length === 1, "9b. Zero additional mutations executed on replay attempt", `tasks: ${task_service_1.taskService.getTasks().length}, goals: ${goal_service_1.goalService.getGoals().length}`);
    // 10. Cancel executes zero tools and clears pending confirmation
    resetEnvironment();
    const pauseForCancel = await command_agent_service_1.commandAgentService.executeCommand("__test_high_risk_multi_mutation__", { isMock: true });
    const cancelId = pauseForCancel.confirmationId;
    const cancelResult = await command_agent_service_1.commandAgentService.cancelAction(cancelId);
    assert(cancelResult.success === true &&
        cancelResult.cancelled === true &&
        cancelResult.executed === false, "10. Cancel action succeeds and indicates cancelled: true", `cancelled: ${cancelResult.cancelled}, executed: ${cancelResult.executed}`);
    assert(task_service_1.taskService.getTasks().length === 0 && goal_service_1.goalService.getGoals().length === 0, "10b. Zero tools executed upon cancellation", `tasks: ${task_service_1.taskService.getTasks().length}, goals: ${goal_service_1.goalService.getGoals().length}`);
    const postCancelConfirm = await command_agent_service_1.commandAgentService.confirmAction(cancelId);
    assert(postCancelConfirm.success === false && postCancelConfirm.executed === false, "10c. Cancelled confirmation cannot be confirmed later", `error: ${postCancelConfirm.error}`);
    // 11. Invalid confirmation ID executes zero tools
    const invalidIdResult = await command_agent_service_1.commandAgentService.confirmAction("non_existent_uuid_12345");
    assert(invalidIdResult.success === false &&
        invalidIdResult.executed === false &&
        invalidIdResult.error !== undefined, "11. Invalid confirmation ID executes zero tools and returns safe error", `error: ${invalidIdResult.error}`);
    // 12. Reused confirmation ID executes zero tools
    // Tested in test 9, let's verify with empty string and whitespace IDs
    const emptyIdResult = await command_agent_service_1.commandAgentService.confirmAction("");
    const whitespaceIdResult = await command_agent_service_1.commandAgentService.confirmAction("   ");
    assert(emptyIdResult.success === false && whitespaceIdResult.success === false, "12. Empty or malformed confirmation IDs rejected without tool execution", `empty: ${emptyIdResult.success}, whitespace: ${whitespaceIdResult.success}`);
    // 13. Renderer cannot inject a different plan through confirmation
    // confirmAction only takes a confirmationId string. It does not accept any plan argument.
    assert(command_agent_service_1.commandAgentService.confirmAction.length === 1, "13. Renderer IPC interface strictly accepts only confirmationId; arbitrary plan injection is architecturally impossible");
    // 14. Failed confirmation validation executes zero tools
    // If a stored plan is somehow corrupted, re-validation prior to execution catches it
    const invalidStoredPlan = {
        userRequest: "Corrupted plan",
        type: "action",
        explanation: "Tampered with unknown tool",
        toolCalls: [
            { tool: "non_existent_dangerous_tool", arguments: {} },
            { tool: "create_task", arguments: { text: "Tampered" } },
        ],
    };
    const corruptedEntry = risk_1.confirmationStore.createPendingConfirmation(invalidStoredPlan, {
        level: "high",
        riskLevel: "high",
        requiresConfirmation: true,
        mutationCount: 2,
        mutationTools: ["create_task"],
        summary: "corrupted",
        reason: "corrupted",
    }, "Corrupted plan", {}, { isMock: true });
    const corruptedExecution = await command_agent_service_1.commandAgentService.confirmAction(corruptedEntry.id);
    assert(corruptedExecution.success === false &&
        corruptedExecution.executed === false &&
        Boolean(corruptedExecution.error?.includes("validation failed")), "14. Failed stored plan validation prevents tool execution upon confirmation", `error: ${corruptedExecution.error}`);
    // =========================================================================
    // SECTION 3: INTEGRATION & REGRESSION
    // =========================================================================
    console.log("\n--- 3. Integration & Regression Verification ---");
    resetEnvironment();
    // 15. Low-risk existing commands still execute normally
    const lowRiskApp = await command_agent_service_1.commandAgentService.executeCommand("Open VS Code", { isMock: true });
    assert(lowRiskApp.success === true &&
        lowRiskApp.executed === true &&
        lowRiskApp.requiresConfirmation !== true, "15. Low-risk existing command executes directly without requiring confirmation", `intent: ${lowRiskApp.intent}, app: ${lowRiskApp.appName}`);
    // 16. Answer mode still works
    const answerResult = await command_agent_service_1.commandAgentService.executeCommand("What should I work on?", { isMock: true });
    assert(answerResult.success === true &&
        answerResult.responseType === "answer" &&
        answerResult.requiresConfirmation !== true &&
        typeof answerResult.answerText === "string", "16. AI Answer Mode continues to work normally without requiring confirmation", `answerText: ${answerResult.answerText?.slice(0, 40)}...`);
    // 17. Multi-step dependency plans still work
    const depResult = await command_agent_service_1.commandAgentService.executeCommand("Open Machine Learning workspace and start deep work on CNN task", { isMock: true });
    assert(depResult.success === true &&
        depResult.executed === true &&
        depResult.requiresConfirmation !== true &&
        depResult.steps?.length === 2, "17. Multi-step dependency plans with 0-1 mutations execute directly without confirmation", `steps: ${depResult.steps?.length}, executed: ${depResult.executed}`);
    // 18. Task / goal / project mutation flows still work
    const singleTaskResult = await command_agent_service_1.commandAgentService.executeCommand("Create a task called Study CNNs", { isMock: true });
    assert(singleTaskResult.success === true &&
        singleTaskResult.executed === true &&
        singleTaskResult.requiresConfirmation !== true &&
        task_service_1.taskService.getTasks().length === 1, "18. Single task mutation executes directly (Medium risk, no confirmation needed)", `tasks: ${task_service_1.taskService.getTasks().length}`);
    // 19. Conversation context only records confirmed/executed actions
    resetEnvironment();
    // 19a: Trigger high-risk plan
    const gatedHighRisk = await command_agent_service_1.commandAgentService.executeCommand("__test_high_risk_multi_mutation__", { isMock: true });
    assert(gatedHighRisk.requiresConfirmation === true, "19a. High-risk plan gated on confirmation");
    const turnsBeforeConfirm = conversation_context_service_1.conversationContextService.getRecentTurns();
    assert(turnsBeforeConfirm.length === 0, "19b. Unconfirmed high-risk plan does NOT record mutations in conversation context", `turnCount: ${turnsBeforeConfirm.length}`);
    // 19c: Confirm and check context
    await command_agent_service_1.commandAgentService.confirmAction(gatedHighRisk.confirmationId);
    const turnsAfterConfirm = conversation_context_service_1.conversationContextService.getRecentTurns();
    assert(turnsAfterConfirm.length === 1 &&
        turnsAfterConfirm[0].toolsExecuted?.includes("create_task") &&
        turnsAfterConfirm[0].toolsExecuted?.includes("create_goal"), "19c. Confirmed plan successfully records executed mutations into conversation context", `turnCount: ${turnsAfterConfirm.length}, tools: ${turnsAfterConfirm[0].toolsExecuted?.join(", ")}`);
    // 20. Existing provider fallback behavior remains intact
    provider_config_service_1.providerConfigService.setActiveProviderId("gemini");
    const fallbackCommand = await command_agent_service_1.commandAgentService.executeCommand("Open VS Code", { isMock: true });
    assert(fallbackCommand.success === true &&
        fallbackCommand.fallbackUsed === true, "20. Provider fallback behavior remains fully intact when active provider is unconfigured", `providerId: ${fallbackCommand.providerId}, fallbackUsed: ${fallbackCommand.fallbackUsed}`);
    // =========================================================================
    // SECTION 4: RUNTIME PATH INTEGRATION VERIFICATION (Phase 4.16 Bug Fix)
    // =========================================================================
    console.log("\n--- 4. Runtime Path Integration (IPC/Default Options) ---");
    resetEnvironment();
    // 21. Runtime path reaches confirmation for __test_high_risk_multi_mutation__ without options
    const runtimeMultiMut = await command_agent_service_1.commandAgentService.executeCommand("__test_high_risk_multi_mutation__");
    assert(runtimeMultiMut.requiresConfirmation === true &&
        runtimeMultiMut.intent === "pending_confirmation" &&
        runtimeMultiMut.executed === false &&
        runtimeMultiMut.risk?.level === "high" &&
        runtimeMultiMut.risk?.requiresConfirmation === true &&
        runtimeMultiMut.risk?.mutationCount === 2 &&
        typeof runtimeMultiMut.confirmationId === "string", "21. Runtime path reaches confirmation gate (requiresConfirmation: true, risk: high) for __test_high_risk_multi_mutation__", `risk: ${runtimeMultiMut.risk?.level}, confirmationId: ${runtimeMultiMut.confirmationId}`);
    assert(task_service_1.taskService.getTasks().length === 0 && goal_service_1.goalService.getGoals().length === 0, "21b. Zero mutations executed before confirmation in runtime path", `tasks: ${task_service_1.taskService.getTasks().length}, goals: ${goal_service_1.goalService.getGoals().length}`);
    // 22. Runtime path reaches confirmation for natural-language multi-mutation command
    const naturalMultiMut = await command_agent_service_1.commandAgentService.executeCommand("Create a task called Study CNN and create a goal called Complete ML Course");
    assert(naturalMultiMut.requiresConfirmation === true &&
        naturalMultiMut.intent === "pending_confirmation" &&
        naturalMultiMut.executed === false &&
        naturalMultiMut.risk?.level === "high" &&
        naturalMultiMut.risk?.mutationCount === 2 &&
        naturalMultiMut.risk?.affectedEntities?.some((e) => e.type === "task" && e.name === "Study CNN") === true &&
        naturalMultiMut.risk?.affectedEntities?.some((e) => e.type === "goal" && e.name === "Complete ML Course") === true, "22. Natural language multi-mutation command reaches confirmation gate with extracted entity names", `affectedEntities: ${JSON.stringify(naturalMultiMut.risk?.affectedEntities)}`);
    assert(task_service_1.taskService.getTasks().length === 0 && goal_service_1.goalService.getGoals().length === 0, "22b. Zero mutations executed before confirmation for natural language command", `tasks: ${task_service_1.taskService.getTasks().length}, goals: ${goal_service_1.goalService.getGoals().length}`);
    // 23. Confirming the natural language plan executes the exact stored plan once
    const naturalConfirm = await command_agent_service_1.commandAgentService.confirmAction(naturalMultiMut.confirmationId);
    assert(naturalConfirm.success === true &&
        naturalConfirm.executed === true &&
        naturalConfirm.confirmed === true, "23. Confirming natural language multi-mutation plan executes successfully", `confirmed: ${naturalConfirm.confirmed}, executed: ${naturalConfirm.executed}`);
    const createdTasks = task_service_1.taskService.getTasks();
    const createdGoals = goal_service_1.goalService.getGoals();
    assert(createdTasks.length === 1 &&
        createdTasks[0].text === "Study CNN" &&
        createdGoals.length === 1 &&
        createdGoals[0].title === "Complete ML Course", "23b. Exact task 'Study CNN' and goal 'Complete ML Course' created on confirmation", `task: ${createdTasks[0]?.text}, goal: ${createdGoals[0]?.title}`);
    // 24. Single create_task in runtime path -> no confirmation
    resetEnvironment();
    const singleTaskRuntime = await command_agent_service_1.commandAgentService.executeCommand("Create a task called Study CNN");
    assert(singleTaskRuntime.success === true &&
        singleTaskRuntime.executed === true &&
        singleTaskRuntime.requiresConfirmation !== true &&
        task_service_1.taskService.getTasks().length === 1, "24. Single create_task in runtime path executes without requiring confirmation", `requiresConfirmation: ${singleTaskRuntime.requiresConfirmation}, tasks: ${task_service_1.taskService.getTasks().length}`);
    // 25. Single create_goal in runtime path -> no confirmation
    resetEnvironment();
    const singleGoalRuntime = await command_agent_service_1.commandAgentService.executeCommand("Create a goal called Complete ML Course");
    assert(singleGoalRuntime.success === true &&
        singleGoalRuntime.executed === true &&
        singleGoalRuntime.requiresConfirmation !== true &&
        goal_service_1.goalService.getGoals().length === 1, "25. Single create_goal in runtime path executes without requiring confirmation", `requiresConfirmation: ${singleGoalRuntime.requiresConfirmation}, goals: ${goal_service_1.goalService.getGoals().length}`);
    // 26. Answer mode in runtime path -> no confirmation
    const answerRuntime = await command_agent_service_1.commandAgentService.executeCommand("What should I work on?");
    assert(answerRuntime.success === true &&
        answerRuntime.responseType === "answer" &&
        answerRuntime.requiresConfirmation !== true, "26. Answer mode in runtime path executes without requiring confirmation", `responseType: ${answerRuntime.responseType}, requiresConfirmation: ${answerRuntime.requiresConfirmation}`);
    // 27. Low-risk launch command in runtime path -> no confirmation
    const launchRuntime = await command_agent_service_1.commandAgentService.executeCommand("Open VS Code");
    assert(launchRuntime.success === true &&
        launchRuntime.executed === true &&
        launchRuntime.requiresConfirmation !== true, "27. Low-risk launch command in runtime path executes without requiring confirmation", `intent: ${launchRuntime.intent}, requiresConfirmation: ${launchRuntime.requiresConfirmation}`);
    // Reset back to mock provider
    resetEnvironment();
    console.log("\n==========================================================================");
    console.log(`Phase 4.16 Test Results: ${passed} Passed, ${failed} Failed`);
    console.log("==========================================================================");
    if (failed > 0) {
        process.exit(1);
    }
}
runAgentConfirmationRiskControlTests().catch((err) => {
    console.error("Test execution failed with unhandled exception:", err);
    process.exit(1);
});
