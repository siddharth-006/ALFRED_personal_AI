"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const plan_validator_1 = require("./providers/impl/plan-validator");
const agent_orchestrator_1 = require("./orchestrator/agent-orchestrator");
const tool_registry_1 = require("./tools/tool-registry");
const command_agent_service_1 = require("./command-agent.service");
const conversation_context_service_1 = require("../services/conversation-context.service");
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
 * Phase 4.14 — Multi-Step Agent Planning and Execution Comprehensive Test Suite
 */
async function runMultiStepAgentPlanningTests() {
    console.log("==========================================================================");
    console.log("ALFRED Phase 4.14 — Multi-Step Agent Planning & Execution Test Suite");
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
    // Set up dedicated test ToolRegistry with all registered tools
    const testRegistry = new tool_registry_1.ToolRegistry();
    const allTools = [
        launch_application_tool_1.launchApplicationTool,
        navigate_tool_1.navigateTool,
        system_status_tool_1.systemStatusTool,
        start_deep_work_tool_1.startDeepWorkTool,
        launch_workspace_tool_1.launchWorkspaceTool,
        show_tasks_tool_1.showTasksTool,
        open_url_tool_1.openUrlTool,
        open_path_tool_1.openPathTool,
        create_task_tool_1.createTaskTool,
        complete_task_tool_1.completeTaskTool,
        create_goal_tool_1.createGoalTool,
        update_goal_tool_1.updateGoalTool,
        update_project_tool_1.updateProjectTool,
    ];
    for (const tool of allTools) {
        testRegistry.register(tool);
    }
    // =========================================================================
    // SECTION 1: PLAN VALIDATION
    // =========================================================================
    console.log("\n--- SECTION 1: PLAN VALIDATION ---");
    // 1.1 One-step plan works
    const oneStepPlan = {
        userRequest: "Open VS Code",
        type: "action",
        toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code" } }],
    };
    const v1 = (0, plan_validator_1.validateAgentPlan)(oneStepPlan);
    assert(v1.valid === true && v1.plan?.toolCalls.length === 1, "1.1 One-step plan passes validation");
    // 1.2 Two-step plan works
    const twoStepPlan = {
        userRequest: "Create task and open workspace",
        type: "action",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Study CNNs" } },
            { tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" } },
        ],
    };
    const v2 = (0, plan_validator_1.validateAgentPlan)(twoStepPlan);
    assert(v2.valid === true && v2.plan?.toolCalls.length === 2 && v2.plan?.toolCalls[0].tool === "create_task", "1.2 Two-step plan passes validation and preserves exact order");
    // 1.3 Five-step plan works (max allowed)
    const fiveStepPlan = {
        userRequest: "Perform 5 tasks",
        type: "action",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Step 1" } },
            { tool: "launch_workspace", arguments: { workspaceName: "Coding" } },
            { tool: "navigate", arguments: { target: "dashboard" } },
            { tool: "system_status", arguments: {} },
            { tool: "show_tasks", arguments: {} },
        ],
    };
    const v5 = (0, plan_validator_1.validateAgentPlan)(fiveStepPlan);
    assert(v5.valid === true && v5.plan?.toolCalls.length === 5, "1.3 Five-step plan (MAX_AGENT_PLAN_STEPS) passes validation");
    // 1.4 Six-step plan rejected
    const sixStepPlan = {
        userRequest: "Perform 6 tasks",
        type: "action",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Step 1" } },
            { tool: "create_task", arguments: { text: "Step 2" } },
            { tool: "create_task", arguments: { text: "Step 3" } },
            { tool: "create_task", arguments: { text: "Step 4" } },
            { tool: "create_task", arguments: { text: "Step 5" } },
            { tool: "create_task", arguments: { text: "Step 6" } },
        ],
    };
    const v6 = (0, plan_validator_1.validateAgentPlan)(sixStepPlan);
    assert(v6.valid === false && Boolean(v6.error?.includes("maximum allowed steps")), "1.4 Six-step plan is safely rejected before execution", v6.error);
    // 1.5 Empty toolCalls rejected
    const emptyPlan = {
        userRequest: "Do nothing",
        type: "action",
        toolCalls: [],
    };
    const vEmpty = (0, plan_validator_1.validateAgentPlan)(emptyPlan);
    assert(vEmpty.valid === false && Boolean(vEmpty.error?.includes("requires at least one tool call")), "1.5 Empty toolCalls array is rejected");
    // 1.6 Unknown tool rejected
    const unknownToolPlan = {
        userRequest: "Run unknown tool",
        type: "action",
        toolCalls: [{ tool: "arbitrary_shell_command", arguments: { cmd: "dir" } }],
    };
    const vUnknown = (0, plan_validator_1.validateAgentPlan)(unknownToolPlan);
    assert(vUnknown.valid === false && Boolean(vUnknown.error?.includes("invalid, unknown, or contains disallowed arguments")), "1.6 Unknown tool is rejected by plan validator");
    // 1.7 Malformed arguments rejected
    const malformedArgsPlan = {
        userRequest: "Launch with dangerous args",
        type: "action",
        toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code; calc.exe" } }],
    };
    const vMalformed = (0, plan_validator_1.validateAgentPlan)(malformedArgsPlan);
    assert(vMalformed.valid === false && Boolean(vMalformed.error?.includes("disallowed arguments")), "1.7 Malformed / shell injection arguments are rejected");
    // 1.8 Invalid later step causes entire plan to be rejected before execution
    const invalidLaterStepPlan = {
        userRequest: "Valid step 1 then invalid step 2",
        type: "action",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Valid Task" } },
            { tool: "unknown_hack_tool", arguments: {} },
        ],
    };
    const vLater = (0, plan_validator_1.validateAgentPlan)(invalidLaterStepPlan);
    assert(vLater.valid === false && Boolean(vLater.error?.includes("step 2 (unknown_hack_tool) is invalid")), "1.8 Invalid later step causes ENTIRE plan to be rejected before execution (no partial execution)", vLater.error);
    // =========================================================================
    // SECTION 2: SEQUENTIAL EXECUTION & STEP TRACKING
    // =========================================================================
    console.log("\n--- SECTION 2: SEQUENTIAL EXECUTION & STEP TRACKING ---");
    const executedOrder = [];
    const trackingRegistry = new tool_registry_1.ToolRegistry();
    trackingRegistry.register({
        name: "test_tool_a",
        description: "Test tool A",
        category: "utility",
        execute: async () => {
            executedOrder.push("test_tool_a");
            return { success: true, data: { step: "a" } };
        },
    });
    trackingRegistry.register({
        name: "test_tool_b",
        description: "Test tool B",
        category: "utility",
        execute: async () => {
            executedOrder.push("test_tool_b");
            return { success: true, data: { step: "b" } };
        },
    });
    trackingRegistry.register({
        name: "test_tool_c",
        description: "Test tool C",
        category: "utility",
        execute: async () => {
            executedOrder.push("test_tool_c");
            return { success: true, data: { step: "c" } };
        },
    });
    class OrderedPlanner {
        async plan(req) {
            return {
                userRequest: req,
                type: "action",
                toolCalls: [
                    { tool: "test_tool_a", arguments: {} },
                    { tool: "test_tool_b", arguments: {} },
                    { tool: "test_tool_c", arguments: {} },
                ],
            };
        }
    }
    const orderedOrchestrator = new agent_orchestrator_1.AgentOrchestrator(new OrderedPlanner(), trackingRegistry);
    const orderResult = await orderedOrchestrator.execute("Run A, B, C sequentially");
    assert(executedOrder.length === 3 &&
        executedOrder[0] === "test_tool_a" &&
        executedOrder[1] === "test_tool_b" &&
        executedOrder[2] === "test_tool_c", "2.1 Steps execute in exact sequential order (A -> B -> C)");
    assert(orderResult.success === true &&
        orderResult.totalSteps === 3 &&
        orderResult.executedSteps === 3 &&
        orderResult.steps?.length === 3 &&
        orderResult.steps[0].index === 0 &&
        orderResult.steps[1].index === 1 &&
        orderResult.steps[2].index === 2, "2.2 Results are accurately tracked per step with index, tool name, and success status");
    // =========================================================================
    // SECTION 3: FAILURE HANDLING
    // =========================================================================
    console.log("\n--- SECTION 3: FAILURE HANDLING ---");
    const failureTracking = [];
    const failRegistry = new tool_registry_1.ToolRegistry();
    failRegistry.register({
        name: "step_ok_1",
        description: "Step OK 1",
        category: "utility",
        execute: async () => {
            failureTracking.push("step_ok_1");
            return { success: true };
        },
    });
    failRegistry.register({
        name: "step_fail_2",
        description: "Step Fail 2",
        category: "utility",
        execute: async () => {
            failureTracking.push("step_fail_2");
            return { success: false, error: "Step 2 failed on purpose." };
        },
    });
    failRegistry.register({
        name: "step_never_3",
        description: "Step Never 3",
        category: "utility",
        execute: async () => {
            failureTracking.push("step_never_3");
            return { success: true };
        },
    });
    class FailMidwayPlanner {
        async plan(req) {
            return {
                userRequest: req,
                type: "action",
                toolCalls: [
                    { tool: "step_ok_1", arguments: {} },
                    { tool: "step_fail_2", arguments: {} },
                    { tool: "step_never_3", arguments: {} },
                ],
            };
        }
    }
    const failOrchestrator = new agent_orchestrator_1.AgentOrchestrator(new FailMidwayPlanner(), failRegistry);
    const failExecResult = await failOrchestrator.execute("Run 3 steps with step 2 failing");
    assert(failExecResult.success === false, "3.1 Orchestrator reports overall failure when a step fails");
    assert(failureTracking.length === 2 &&
        failureTracking.includes("step_ok_1") &&
        failureTracking.includes("step_fail_2") &&
        !failureTracking.includes("step_never_3"), "3.2 Middle step failure stops execution immediately — step 3 is NOT executed");
    assert(failExecResult.steps?.length === 2 &&
        failExecResult.steps[0].success === true &&
        failExecResult.steps[1].success === false, "3.3 Successful previous step result is preserved and failed step result is reported");
    assert(failExecResult.totalSteps === 3 && failExecResult.executedSteps === 2, "3.4 Total planned steps (3) and executed steps (2) are accurately tracked");
    // Test first-step failure
    const firstFailRegistry = new tool_registry_1.ToolRegistry();
    firstFailRegistry.register({
        name: "step_fail_1",
        description: "Step 1 fails",
        category: "utility",
        execute: async () => ({ success: false, error: "First step failed." }),
    });
    firstFailRegistry.register({
        name: "step_never_2",
        description: "Step 2 never",
        category: "utility",
        execute: async () => ({ success: true }),
    });
    class FirstFailPlanner {
        async plan(req) {
            return {
                userRequest: req,
                type: "action",
                toolCalls: [
                    { tool: "step_fail_1", arguments: {} },
                    { tool: "step_never_2", arguments: {} },
                ],
            };
        }
    }
    const firstFailOrch = new agent_orchestrator_1.AgentOrchestrator(new FirstFailPlanner(), firstFailRegistry);
    const firstFailRes = await firstFailOrch.execute("Step 1 fails");
    assert(firstFailRes.success === false && firstFailRes.executedSteps === 1 && firstFailRes.steps?.length === 1, "3.5 First step failure halts execution immediately without executing later steps");
    // =========================================================================
    // SECTION 4: COMMAND AGENT SERVICE & MULTI-STEP SUMMARY FORMATTING
    // =========================================================================
    console.log("\n--- SECTION 4: COMMAND AGENT SERVICE & FORMATTING ---");
    // 4.1 Success summary formatting
    const successSteps = [
        { index: 0, tool: "create_task", arguments: { text: "Study CNNs" }, success: true, summary: "Created task: Study CNNs" },
        { index: 1, tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" }, success: true, summary: "Opened Machine Learning workspace" },
    ];
    const successSummary = (0, command_agent_service_1.formatMultiStepSummary)(2, successSteps, true);
    assert(successSummary.includes("Completed 2 of 2 actions:") &&
        successSummary.includes("• Created task: Study CNNs") &&
        successSummary.includes("• Opened Machine Learning workspace"), "4.1 Multi-step success summary formatted correctly with bullet points", successSummary);
    // 4.2 Failure summary formatting
    const failureSteps = [
        { index: 0, tool: "create_task", arguments: { text: "Study CNNs" }, success: true, summary: "Created task: Study CNNs" },
        { index: 1, tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" }, success: false, error: "Workspace error" },
    ];
    const failureSummary = (0, command_agent_service_1.formatMultiStepSummary)(2, failureSteps, false);
    assert(failureSummary.includes("Completed 1 of 2 actions:") &&
        failureSummary.includes("• Created task: Study CNNs") &&
        failureSummary.includes("• Failed to open Machine Learning workspace") &&
        failureSummary.includes("The remaining actions were not executed."), "4.2 Multi-step failure summary clearly indicates halt point and remaining actions not executed", failureSummary);
    // 4.3 End-to-End CommandAgentService multi-step command execution
    conversation_context_service_1.conversationContextService.clear();
    const endToEndRes = await command_agent_service_1.commandAgentService.executeCommand("Create a task to study CNNs and open my Machine Learning workspace.", { isMock: true });
    assert(endToEndRes.success === true &&
        endToEndRes.executed === true &&
        Boolean(endToEndRes.steps && endToEndRes.steps.length === 2), "4.3 End-to-end CommandAgentService executes multi-step command sequentially", endToEndRes.explanation);
    assert(Boolean(endToEndRes.explanation?.includes("Completed 2 of 2 actions:")), "4.4 End-to-end user explanation displays formatted multi-step summary");
    // =========================================================================
    // SECTION 5: CONVERSATIONAL CONTEXT INTEGRATION
    // =========================================================================
    console.log("\n--- SECTION 5: CONVERSATIONAL CONTEXT INTEGRATION ---");
    // Check that both entities (task and workspace) were captured from the multi-step execution
    const lastTask = conversation_context_service_1.conversationContextService.getLastEntity("task");
    const lastWorkspace = conversation_context_service_1.conversationContextService.getLastEntity("workspace");
    const lastAny = conversation_context_service_1.conversationContextService.getLastEntity();
    assert(Boolean(lastTask && lastTask.name?.toLowerCase().includes("study cnns")), "5.1 Task entity preserved in conversation context from multi-step execution", `Task: ${lastTask?.name} (id: ${lastTask?.id})`);
    assert(Boolean(lastWorkspace && lastWorkspace.name === "Machine Learning"), "5.2 Workspace entity preserved in conversation context from multi-step execution", `Workspace: ${lastWorkspace?.name}`);
    assert(Boolean(lastAny && lastAny.type === "workspace"), "5.3 Most recent entity resolution finds the final executed entity");
    // Verify follow-up command can reference the created task
    if (lastTask?.id) {
        const followUpRes = await command_agent_service_1.commandAgentService.executeCommand("Mark it as completed.", { isMock: true });
        assert(followUpRes.success === true, "5.4 Follow-up pronoun command ('Mark it as completed') resolves task from multi-step context", followUpRes.explanation);
    }
    // =========================================================================
    // SECTION 6: ANSWER MODE
    // =========================================================================
    console.log("\n--- SECTION 6: ANSWER MODE ---");
    const answerPlanRes = await command_agent_service_1.commandAgentService.executeCommand("What is gradient descent?", { isMock: true });
    assert(answerPlanRes.success === true &&
        answerPlanRes.responseType === "answer" &&
        answerPlanRes.executed === false &&
        (!answerPlanRes.steps || answerPlanRes.steps.length === 0), "6.1 Answer mode does NOT invoke multi-step execution or run any tools");
    // =========================================================================
    // SECTION 7: SECURITY GUARANTEES
    // =========================================================================
    console.log("\n--- SECTION 7: SECURITY GUARANTEES ---");
    // 7.1 Arbitrary command / shell rejected in multi-step plan
    const hackPlan = {
        userRequest: "Evil multi-step",
        type: "action",
        toolCalls: [
            { tool: "create_task", arguments: { text: "Legit Task" } },
            { tool: "shell_exec", arguments: { command: "rmdir /s /q C:\\" } },
        ],
    };
    const hackValidation = (0, plan_validator_1.validateAgentPlan)(hackPlan);
    assert(hackValidation.valid === false, "7.1 Arbitrary tool ('shell_exec') rejected at plan validation before execution");
    // 7.2 Path traversal rejected in multi-step plan
    const traversalPlan = {
        userRequest: "Path traversal plan",
        type: "action",
        toolCalls: [
            { tool: "open_path", arguments: { path: "../../../windows/system32" } },
            { tool: "system_status", arguments: {} },
        ],
    };
    const traversalValidation = (0, plan_validator_1.validateAgentPlan)(traversalPlan);
    assert(traversalValidation.valid === false, "7.2 Path traversal in multi-step plan rejected at validation");
    // 7.3 Max steps boundary strictly enforced
    assert(plan_validator_1.MAX_AGENT_PLAN_STEPS === 5, "7.3 MAX_AGENT_PLAN_STEPS constant is exactly 5");
    console.log("\n==========================================================================");
    console.log(`Phase 4.14 Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================");
    if (failed > 0) {
        process.exit(1);
    }
}
runMultiStepAgentPlanningTests();
