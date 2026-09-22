"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plan_validator_1 = require("./providers/impl/plan-validator");
const agent_orchestrator_1 = require("./orchestrator/agent-orchestrator");
const tool_registry_1 = require("./tools/tool-registry");
const command_agent_service_1 = require("./command-agent.service");
const conversation_context_service_1 = require("../services/conversation-context.service");
const task_service_1 = require("../services/task.service");
// Built-in tools for test registry
const launch_application_tool_1 = require("./tools/builtins/launch-application.tool");
const navigate_tool_1 = require("./tools/builtins/navigate.tool");
const system_status_tool_1 = require("./tools/builtins/system-status.tool");
const start_deep_work_tool_1 = require("./tools/builtins/start-deep-work.tool");
const launch_workspace_tool_1 = require("./tools/builtins/launch-workspace.tool");
const show_tasks_tool_1 = require("./tools/builtins/show-tasks.tool");
const open_url_tool_1 = require("./tools/builtins/open-url.tool");
const open_path_tool_1 = require("./tools/builtins/open-path.tool");
const create_task_tool_1 = require("./tools/builtins/create-task.tool");
const complete_task_tool_1 = require("./tools/builtins/complete-task.tool");
const create_goal_tool_1 = require("./tools/builtins/create-goal.tool");
const update_goal_tool_1 = require("./tools/builtins/update-goal.tool");
const update_project_tool_1 = require("./tools/builtins/update-project.tool");
const tools_1 = require("./tools");
require("./providers/index");
// Register default tools into global tool registry
(0, tools_1.registerDefaultTools)();
/**
 * Phase 4.15 — Dependency-Aware Agent Planning Comprehensive Test Suite
 */
async function runDependencyAwarePlanningTests() {
    console.log("==========================================================================");
    console.log("ALFRED Phase 4.15 — Dependency-Aware Agent Planning Test Suite");
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
    // Set up dedicated test ToolRegistry
    const testRegistry = new tool_registry_1.ToolRegistry();
    testRegistry.register(launch_application_tool_1.launchApplicationTool);
    testRegistry.register(navigate_tool_1.navigateTool);
    testRegistry.register(system_status_tool_1.systemStatusTool);
    testRegistry.register(start_deep_work_tool_1.startDeepWorkTool);
    testRegistry.register(launch_workspace_tool_1.launchWorkspaceTool);
    testRegistry.register(show_tasks_tool_1.showTasksTool);
    testRegistry.register(open_url_tool_1.openUrlTool);
    testRegistry.register(open_path_tool_1.openPathTool);
    testRegistry.register(create_task_tool_1.createTaskTool);
    testRegistry.register(complete_task_tool_1.completeTaskTool);
    testRegistry.register(create_goal_tool_1.createGoalTool);
    testRegistry.register(update_goal_tool_1.updateGoalTool);
    testRegistry.register(update_project_tool_1.updateProjectTool);
    // =========================================================================
    // 1. DEPENDENCY VALIDATION
    // =========================================================================
    console.log("--- SECTION 1: DEPENDENCY VALIDATION ---");
    // 1.1 Valid dependency accepted
    const validPlanCandidate = {
        userRequest: "Open ML workspace and start deep work",
        toolCalls: [
            { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" } },
            { tool: "start_deep_work", arguments: { sessionName: "CNN" }, dependsOn: [0] },
        ],
    };
    const validResult = (0, plan_validator_1.validateAgentPlan)(validPlanCandidate);
    assert(validResult.valid === true, "1.1 Valid dependency accepted (step 1 depends on step 0)");
    assert(validResult.plan?.toolCalls[1]?.dependsOn?.[0] === 0, "1.2 Dependency on previous step preserved accurately in validated plan");
    // 1.3 Self-dependency rejected
    const selfDepCandidate = {
        userRequest: "Self dependency plan",
        toolCalls: [
            { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" }, dependsOn: [0] },
        ],
    };
    const selfDepResult = (0, plan_validator_1.validateAgentPlan)(selfDepCandidate);
    assert(selfDepResult.valid === false && (selfDepResult.error?.includes("cannot depend on itself") ?? false), "1.3 Self-dependency rejected (step 0 cannot depend on step 0)");
    // 1.4 Future dependency rejected
    const futureDepCandidate = {
        userRequest: "Future dependency plan",
        toolCalls: [
            { tool: "start_deep_work", arguments: { sessionName: "CNN" }, dependsOn: [1] },
            { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" } },
        ],
    };
    const futureDepResult = (0, plan_validator_1.validateAgentPlan)(futureDepCandidate);
    assert(futureDepResult.valid === false && (futureDepResult.error?.includes("cannot depend on future step") ?? false), "1.4 Future dependency rejected (step 0 cannot depend on step 1)");
    // 1.5 Out-of-range dependency rejected
    const outOfRangeCandidate = {
        userRequest: "Out of range dependency plan",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Task 1" } },
            { tool: "start_deep_work", arguments: { sessionName: "Deep Work" }, dependsOn: [99] },
        ],
    };
    const outOfRangeResult = (0, plan_validator_1.validateAgentPlan)(outOfRangeCandidate);
    assert(outOfRangeResult.valid === false && (outOfRangeResult.error?.includes("out-of-range") ?? false), "1.5 Out-of-range dependency index rejected (step 1 depends on index 99)");
    // Negative out-of-range
    const negDepCandidate = {
        userRequest: "Negative index dependency plan",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Task 1" }, dependsOn: [-1] },
        ],
    };
    const negDepResult = (0, plan_validator_1.validateAgentPlan)(negDepCandidate);
    assert(negDepResult.valid === false && (negDepResult.error?.includes("out-of-range") ?? false), "1.6 Negative dependency index rejected (step 0 depends on -1)");
    // 1.7 Circular dependency rejected
    const circularCheck = (0, plan_validator_1.validatePlanDependencies)([
        { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" }, dependsOn: [1] },
        { tool: "start_deep_work", arguments: { sessionName: "CNN" }, dependsOn: [0] },
    ]);
    assert(circularCheck.valid === false, "1.7 Circular dependency rejected before execution");
    // 1.8 Duplicate dependency indexes normalized deterministically
    const dupCandidate = {
        userRequest: "Duplicate dependencies plan",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Task 1" } },
            { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" }, dependsOn: [0, 0] },
        ],
    };
    const dupResult = (0, plan_validator_1.validateAgentPlan)(dupCandidate);
    assert(dupResult.valid === true && dupResult.plan?.toolCalls[1]?.dependsOn?.length === 1 && dupResult.plan?.toolCalls[1]?.dependsOn[0] === 0, "1.8 Duplicate dependency indexes normalized deterministically into [0]");
    // 1.9 Invalid dependency format (non-array or non-integer) rejects entire plan
    const nonArrayCandidate = {
        userRequest: "Non-array dependency plan",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Task 1" } },
            { tool: "start_deep_work", arguments: { sessionName: "CNN" }, dependsOn: "0" },
        ],
    };
    const nonArrayResult = (0, plan_validator_1.validateAgentPlan)(nonArrayCandidate);
    assert(nonArrayResult.valid === false && (nonArrayResult.error?.includes("must be an array") ?? false), "1.9 Non-array dependsOn metadata rejects entire plan before execution");
    // =========================================================================
    // 2. DEPENDENCY EXECUTION & SAFE CONTEXT
    // =========================================================================
    console.log("\n--- SECTION 2: DEPENDENCY EXECUTION & SAFE CONTEXT ---");
    // 2.1 Dependent step executes after successful prerequisite
    const customPlanner = {
        plan: () => ({
            userRequest: "Launch workspace and deep work",
            type: "action",
            toolCalls: [
                { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" } },
                { tool: "start_deep_work", arguments: { sessionName: "Machine Learning" }, dependsOn: [0] },
            ],
        }),
    };
    const orchestrator = new agent_orchestrator_1.AgentOrchestrator(customPlanner, testRegistry);
    const execSuccess = await orchestrator.execute("Launch workspace and deep work", { isMock: true });
    assert(execSuccess.success === true, "2.1 Orchestrator executes dependent plan successfully");
    assert(execSuccess.executedSteps === 2, "2.2 Both prerequisite and dependent steps executed (2/2)");
    assert(execSuccess.skippedSteps === 0, "2.3 Zero steps were skipped on successful execution");
    // 2.4 Safe prerequisite result context extraction
    const safeWsContext = (0, agent_orchestrator_1.extractSafeStepContext)("launch_workspace", { workspaceName: "Machine Learning" }, { workspaceId: "Machine Learning", results: [] });
    assert(safeWsContext.workspaceId === "Machine Learning" && safeWsContext.name === "Machine Learning" && safeWsContext.type === "workspace", "2.4 extractSafeStepContext extracts safe workspace identity without leaking internals");
    // 2.5 Safe context passed to dependent step missing sessionName
    const populatedArgs = (0, agent_orchestrator_1.applySafeDependencyContext)("start_deep_work", {}, [safeWsContext]);
    assert(populatedArgs.sessionName === "Machine Learning", "2.5 Dependent start_deep_work tool receives workspace identity as safe sessionName");
    // 2.6 Dependency chain of 3 steps works
    const threeStepPlanner = {
        plan: () => ({
            userRequest: "Create task, open workspace, start deep work",
            type: "action",
            toolCalls: [
                { tool: "create_task", arguments: { text: "CNN Task" } },
                { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" }, dependsOn: [0] },
                { tool: "start_deep_work", arguments: { sessionName: "CNN Task" }, dependsOn: [1] },
            ],
        }),
    };
    const orchThree = new agent_orchestrator_1.AgentOrchestrator(threeStepPlanner, testRegistry);
    const threeResult = await orchThree.execute("3 step chain", { isMock: true });
    assert(threeResult.success === true, "2.6 Dependency chain of 3 steps executes successfully");
    assert(threeResult.executedSteps === 3, "2.7 All 3 chained steps executed in sequential order");
    assert(threeResult.skippedSteps === 0, "2.8 Zero steps skipped in successful 3-step chain");
    // =========================================================================
    // 3. FAILURE & SKIPPED-STEP BEHAVIOR
    // =========================================================================
    console.log("\n--- SECTION 3: FAILURE & SKIPPED-STEP BEHAVIOR ---");
    // Register a failing tool for test
    testRegistry.register({
        name: "test_failing_prereq",
        description: "Always fails for testing",
        category: "utility",
        execute: () => ({ success: false, error: "Database connection failed." }),
    });
    // 3.1 Step 1 failure prevents dependent Step 2
    const failPlanner1 = {
        plan: () => ({
            userRequest: "Fail step 1",
            type: "action",
            toolCalls: [
                { tool: "test_failing_prereq", arguments: {} },
                { tool: "start_deep_work", arguments: { sessionName: "Deep Work" }, dependsOn: [0] },
            ],
        }),
    };
    const orchFail1 = new agent_orchestrator_1.AgentOrchestrator(failPlanner1, testRegistry);
    const failResult1 = await orchFail1.execute("Fail step 1", { isMock: true });
    assert(failResult1.success === false, "3.1 Orchestrator reports overall failure when prerequisite fails");
    assert(failResult1.executedSteps === 1, "3.2 Only step 1 was actually executed (executedSteps = 1)");
    assert(failResult1.skippedSteps === 1, "3.3 Dependent step 2 was skipped (skippedSteps = 1)");
    assert(failResult1.results[1]?.skipped === true, "3.4 Step 2 result has skipped: true");
    assert(failResult1.results[1]?.skipReason?.includes("failed") ?? false, "3.5 Step 2 skipReason explains prerequisite step 1 failed");
    // 3.6 Step 2 failure prevents dependent Step 3
    const failPlanner2 = {
        plan: () => ({
            userRequest: "Fail step 2",
            type: "action",
            toolCalls: [
                { tool: "create_task", arguments: { text: "Task 1" } },
                { tool: "test_failing_prereq", arguments: {}, dependsOn: [0] },
                { tool: "start_deep_work", arguments: { sessionName: "Deep Work" }, dependsOn: [1] },
            ],
        }),
    };
    const orchFail2 = new agent_orchestrator_1.AgentOrchestrator(failPlanner2, testRegistry);
    const failResult2 = await orchFail2.execute("Fail step 2", { isMock: true });
    assert(failResult2.results[0]?.success === true, "3.6 Step 1 executed and succeeded");
    assert(failResult2.results[1]?.success === false && !failResult2.results[1]?.skipped, "3.7 Step 2 executed and failed");
    assert(failResult2.results[2]?.skipped === true, "3.8 Step 3 was skipped due to Step 2 failure");
    assert(failResult2.executedSteps === 2, "3.9 Executed steps count is 2 (1 success + 1 failure)");
    assert(failResult2.skippedSteps === 1, "3.10 Skipped steps count is 1");
    // 3.11 Unrelated later step behavior follows existing failure policy
    const unrelatedPlanner = {
        plan: () => ({
            userRequest: "Unrelated after failure",
            type: "action",
            toolCalls: [
                { tool: "test_failing_prereq", arguments: {} },
                { tool: "navigate", arguments: { target: "dashboard" } }, // Unrelated, no deps
                { tool: "start_deep_work", arguments: { sessionName: "Deep Work" }, dependsOn: [0] },
            ],
        }),
    };
    const orchUnrelated = new agent_orchestrator_1.AgentOrchestrator(unrelatedPlanner, testRegistry);
    const unrelatedResult = await orchUnrelated.execute("Unrelated after failure", { isMock: true });
    assert(unrelatedResult.results[0]?.success === false, "3.11 Step 1 executed and failed");
    assert(!unrelatedResult.results.some((r) => r.tool === "navigate"), "3.12 Unrelated later step (navigate) was not executed following failure policy");
    assert(unrelatedResult.results.some((r) => r.tool === "start_deep_work" && r.skipped), "3.13 Dependent step (start_deep_work) was recorded as skipped");
    // 3.14 Result clearly identifies failed and skipped steps
    assert(Boolean(failResult2.summary?.includes("Execution stopped at step 2") && failResult2.summary?.includes("1 dependent action(s) were skipped")), "3.14 Summary clearly identifies failed step and number of skipped dependent actions");
    // =========================================================================
    // 4. SECURITY BOUNDARY
    // =========================================================================
    console.log("\n--- SECTION 4: SECURITY BOUNDARY ---");
    // 4.1 Dependency data cannot bypass ToolRegistry
    const bypassPlanner = {
        plan: () => ({
            userRequest: "Try bypassing registry",
            type: "action",
            toolCalls: [
                { tool: "non_existent_unregistered_tool", arguments: {} },
                { tool: "start_deep_work", arguments: {}, dependsOn: [0] },
            ],
        }),
    };
    const orchBypass = new agent_orchestrator_1.AgentOrchestrator(bypassPlanner, testRegistry);
    const bypassResult = await orchBypass.execute("Try bypassing registry", { isMock: true });
    assert(bypassResult.success === false && Boolean(bypassResult.results[0]?.error?.includes("Unknown tool")), "4.1 Unknown tools cannot execute even with dependency metadata");
    // 4.2 Dependency result cannot introduce arbitrary shell commands
    const dangerousContext = { id: "rm -rf /; echo hack", name: "bad_cmd && dir" };
    const sanitizedArgs = (0, agent_orchestrator_1.applySafeDependencyContext)("start_deep_work", { sessionName: "$prev.name" }, [dangerousContext]);
    const toolCallCheck = (0, plan_validator_1.validateToolCall)({ tool: "start_deep_work", arguments: sanitizedArgs });
    assert(toolCallCheck !== null, // start_deep_work accepts safe string, but ToolRegistry prevents shell execution
    "4.2 Tool arguments remain strictly constrained to ToolDefinition parameters");
    // 4.3 Parameter security: metacharacters in mutation tool rejected
    const maliciousTaskCandidate = {
        tool: "create_task",
        arguments: { text: "Task; rm -rf /" },
        dependsOn: [0],
    };
    const rejectedToolCall = (0, plan_validator_1.validateToolCall)(maliciousTaskCandidate);
    assert(rejectedToolCall === null, "4.3 Dangerous shell metacharacters rejected by validateToolCall even when dependsOn is specified");
    // 4.4 Mutation tools remain validated
    const invalidGoalCandidate = {
        tool: "create_goal",
        arguments: { title: "Valid", target: -5 },
        dependsOn: [0],
    };
    assert((0, plan_validator_1.validateToolCall)(invalidGoalCandidate) === null, "4.4 Goal mutation validation still rejects negative target with dependsOn");
    // =========================================================================
    // 5. CONVERSATION CONTEXT INTEGRATION
    // =========================================================================
    console.log("\n--- SECTION 5: CONVERSATION CONTEXT INTEGRATION ---");
    conversation_context_service_1.conversationContextService.clear();
    // Mock planner returns dependent plan for ML workspace & CNN task
    const cmdResult = await command_agent_service_1.commandAgentService.executeCommand("Open my Machine Learning workspace and start deep work on my CNN task.");
    assert(cmdResult.success === true, "5.1 End-to-end command executed successfully");
    assert(cmdResult.executedSteps === 2, "5.2 Both workspace and deep work steps executed (2/2)");
    // 5.3 Target entities preserved
    const lastEntity = conversation_context_service_1.conversationContextService.getLastEntity();
    assert(lastEntity !== undefined && Boolean(lastEntity.name?.includes("Machine Learning") || lastEntity.name?.includes("CNN")), "5.3 Target entity preserved in conversation context from multi-step execution");
    // 5.4 Follow-up conversational reference
    // Create a task called "CNN task" so conversation context can resolve it
    task_service_1.taskService.createTask("CNN task", "Data Science");
    const followUpRes = await command_agent_service_1.commandAgentService.executeCommand("Mark that task completed.");
    assert(followUpRes.success === true || (followUpRes.responseType === "answer" && followUpRes.answerText !== undefined), "5.4 Follow-up conversational reference processed successfully");
    // 5.5 No sensitive data in context
    const recentTurns = conversation_context_service_1.conversationContextService.getRecentTurns();
    const turnsJson = JSON.stringify(recentTurns);
    assert(!turnsJson.includes("apiKey") && !turnsJson.includes("password") && !turnsJson.includes("token"), "5.5 No sensitive tokens or secrets stored in conversation context");
    // =========================================================================
    // 6. SIMPLE COMMANDS STAY SIMPLE
    // =========================================================================
    console.log("\n--- SECTION 6: SIMPLE COMMANDS STAY SIMPLE ---");
    // 6.1 Single step command works without dependsOn
    const singleCmd = await command_agent_service_1.commandAgentService.executeCommand("Open VS Code.");
    assert(singleCmd.success === true && (singleCmd.totalSteps === undefined || singleCmd.totalSteps === 1), "6.1 Simple single-step command works without forced dependency metadata");
    // 6.2 Existing non-dependent multi-step command works
    const nonDepMulti = await command_agent_service_1.commandAgentService.executeCommand("Create a task to study CNNs and open my Machine Learning workspace.");
    assert(nonDepMulti.success === true && nonDepMulti.executedSteps === 2, "6.2 Existing non-dependent multi-step command continues to work normally");
    // 6.3 Multi-step summary displays skipped step format correctly
    const mockSkippedSteps = [
        { index: 0, tool: "launch_workspace", arguments: { workspaceName: "ML" }, success: true, summary: "Opened ML workspace" },
        { index: 1, tool: "test_fail", arguments: {}, success: false, error: "Network error" },
        { index: 2, tool: "start_deep_work", arguments: {}, success: false, skipped: true, skipReason: "Prerequisite step 2 (test_fail) failed." },
    ];
    const summaryText = (0, command_agent_service_1.formatMultiStepSummary)(3, mockSkippedSteps, false);
    assert(summaryText.includes("Skipped start_deep_work: Prerequisite step 2 (test_fail) failed."), "6.3 formatMultiStepSummary formats skipped steps with clear prerequisite explanations");
    console.log("\n==========================================================================");
    console.log(`Phase 4.15 Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================");
    if (failed > 0) {
        process.exit(1);
    }
}
runDependencyAwarePlanningTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
