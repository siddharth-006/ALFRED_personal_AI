"use strict";
/**
 * Controlled Task Mutation Test Suite (Phase 4.11)
 *
 * Verifies that ALFRED supports safe, controlled task mutations (create_task, complete_task)
 * with strict argument validation, tool whitelisting, ToolRegistry execution, and real-time state management.
 *
 * Test cases:
 *  1. create_task: Valid creation with text and category
 *  2. create_task: Empty title/text rejected
 *  3. create_task: Whitespace-only title rejected
 *  4. create_task: Malformed arguments (non-object) rejected
 *  5. create_task: Exactly one task created
 *  6. complete_task: Valid existing task completes successfully
 *  7. complete_task: Nonexistent task returns safe structured failure
 *  8. complete_task: Malformed/empty taskId rejected
 *  9. complete_task: Only the requested task changes
 * 10. Security: Unregistered mutation tools (e.g. 'delete_task', 'drop_database') rejected
 * 11. Security: Shell metacharacters in arguments rejected
 * 12. Security: Answer Mode cannot execute mutation tools
 * 13. Integration: CommandAgent -> Orchestrator -> ToolRegistry -> TaskService flow
 * 14. Compatibility: Existing read-only tools (navigate, system_status, show_tasks) still work
 * 15. Compatibility: Mock provider & fallback behavior remain intact
 */
Object.defineProperty(exports, "__esModule", { value: true });
const task_service_1 = require("../services/task.service");
const create_task_tool_1 = require("./tools/builtins/create-task.tool");
const complete_task_tool_1 = require("./tools/builtins/complete-task.tool");
const tool_registry_1 = require("./tools/tool-registry");
const index_1 = require("./tools/index");
const plan_validator_1 = require("./providers/impl/plan-validator");
const planning_prompt_1 = require("./providers/impl/planning-prompt");
const command_agent_service_1 = require("./command-agent.service");
const provider_config_service_1 = require("./providers/config/provider-config.service");
const provider_registry_1 = require("./providers/provider-registry");
const mock_ai_provider_1 = require("./providers/impl/mock-ai-provider");
const claude_ai_provider_1 = require("./providers/impl/claude-ai-provider");
require("./providers/index");
// Mock helper to intercept fetch for cloud providers
async function withFakeFetch(responseFactory, fn) {
    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = (input, init) => {
            const urlString = typeof input === "string" ? input : input.toString();
            return Promise.resolve(responseFactory(urlString, init));
        };
        return await fn();
    }
    finally {
        globalThis.fetch = originalFetch;
    }
}
async function runTaskMutationTests() {
    console.log("==========================================================================");
    console.log("ALFRED Controlled Task Mutation — Phase 4.11 Test Suite");
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
    // Setup fresh environment
    (0, index_1.registerDefaultTools)();
    provider_config_service_1.providerConfigService.reset();
    provider_registry_1.providerRegistry.clear();
    provider_registry_1.providerRegistry.registerProvider(mock_ai_provider_1.mockAIProvider);
    provider_registry_1.providerRegistry.registerProvider(claude_ai_provider_1.claudeAIProvider);
    const initialTestTasks = [
        { id: "task-1", text: "Read research paper", completed: false, category: "Research" },
        { id: "task-2", text: "Fix database index", completed: false, category: "Engineering" },
        { id: "task-3", text: "Prepare slides", completed: true, category: "Management" },
    ];
    task_service_1.taskService.reset(initialTestTasks);
    // ===========================================================================
    // TEST 1: create_task: Valid creation
    // ===========================================================================
    {
        const val = create_task_tool_1.createTaskTool.validateInput?.({ text: "Finish ML project", category: "Data Science" });
        const res = await create_task_tool_1.createTaskTool.execute({ text: "Finish ML project", category: "Data Science" });
        assert(Boolean(val?.valid) &&
            res.success === true &&
            res.data?.task.text === "Finish ML project" &&
            res.data?.task.category === "Data Science" &&
            res.data?.task.completed === false, "1. create_task: Valid creation creates task with correct properties");
    }
    // ===========================================================================
    // TEST 2: create_task: Empty title rejected
    // ===========================================================================
    {
        const val = create_task_tool_1.createTaskTool.validateInput?.({ text: "" });
        assert(val?.valid === false && Boolean(val?.error), "2. create_task: Empty title/text rejected by validator");
    }
    // ===========================================================================
    // TEST 3: create_task: Whitespace-only title rejected
    // ===========================================================================
    {
        const val = create_task_tool_1.createTaskTool.validateInput?.({ text: "    \t\n  " });
        assert(val?.valid === false && Boolean(val?.error), "3. create_task: Whitespace-only title rejected by validator");
    }
    // ===========================================================================
    // TEST 4: create_task: Malformed arguments (non-object) rejected
    // ===========================================================================
    {
        const val1 = create_task_tool_1.createTaskTool.validateInput?.(null);
        const val2 = create_task_tool_1.createTaskTool.validateInput?.("just a string");
        const val3 = create_task_tool_1.createTaskTool.validateInput?.(["array"]);
        assert(val1?.valid === false && val2?.valid === false && val3?.valid === false, "4. create_task: Malformed arguments (null, string, array) rejected");
    }
    // ===========================================================================
    // TEST 5: create_task: Exactly one task created
    // ===========================================================================
    {
        task_service_1.taskService.reset(initialTestTasks);
        const countBefore = task_service_1.taskService.getTasks().length;
        await create_task_tool_1.createTaskTool.execute({ text: "Review PR #42", category: "Engineering" });
        const countAfter = task_service_1.taskService.getTasks().length;
        assert(countAfter === countBefore + 1, "5. create_task: Exactly one task is created in task state");
    }
    // ===========================================================================
    // TEST 6: complete_task: Valid existing task completes successfully
    // ===========================================================================
    {
        task_service_1.taskService.reset(initialTestTasks);
        const val = complete_task_tool_1.completeTaskTool.validateInput?.({ taskId: "task-2" });
        const res = await complete_task_tool_1.completeTaskTool.execute({ taskId: "task-2" });
        const updated = task_service_1.taskService.getTasks().find((t) => t.id === "task-2");
        assert(Boolean(val?.valid) &&
            res.success === true &&
            res.data?.task.id === "task-2" &&
            res.data?.task.completed === true &&
            updated?.completed === true, "6. complete_task: Valid existing task completes successfully");
    }
    // ===========================================================================
    // TEST 7: complete_task: Nonexistent task returns safe failure
    // ===========================================================================
    {
        task_service_1.taskService.reset(initialTestTasks);
        const res = await complete_task_tool_1.completeTaskTool.execute({ taskId: "nonexistent-id-999" });
        assert(res.success === false && Boolean(res.error?.includes("not found")), "7. complete_task: Nonexistent task returns safe structured failure without crashing");
    }
    // ===========================================================================
    // TEST 8: complete_task: Malformed/empty taskId rejected
    // ===========================================================================
    {
        const val1 = complete_task_tool_1.completeTaskTool.validateInput?.({ taskId: "" });
        const val2 = complete_task_tool_1.completeTaskTool.validateInput?.({});
        const val3 = complete_task_tool_1.completeTaskTool.validateInput?.("just-string");
        assert(val1?.valid === false && val2?.valid === false && val3?.valid === false, "8. complete_task: Malformed or empty taskId rejected");
    }
    // ===========================================================================
    // TEST 9: complete_task: Only the requested task changes
    // ===========================================================================
    {
        task_service_1.taskService.reset(initialTestTasks);
        await complete_task_tool_1.completeTaskTool.execute({ taskId: "task-1" });
        const tasks = task_service_1.taskService.getTasks();
        const t1 = tasks.find((t) => t.id === "task-1");
        const t2 = tasks.find((t) => t.id === "task-2");
        assert(t1?.completed === true && t2?.completed === false, "9. complete_task: Mutates only the requested task without affecting other tasks");
    }
    // ===========================================================================
    // TEST 10: Security: Unregistered mutation tool rejected
    // ===========================================================================
    {
        const plan = (0, plan_validator_1.parseAndValidateAgentPlan)(JSON.stringify({
            type: "action",
            toolCalls: [
                { tool: "delete_task", arguments: { taskId: "task-1" } },
                { tool: "drop_database", arguments: {} },
            ],
        }), "delete my task");
        assert(plan.valid === false || (plan.plan?.toolCalls.length === 0), "10. Security: Unregistered mutation tools ('delete_task', 'drop_database') rejected");
    }
    // ===========================================================================
    // TEST 11: Security: Shell metacharacters rejected
    // ===========================================================================
    {
        const valCreate = create_task_tool_1.createTaskTool.validateInput?.({ text: "echo test; rm -rf /" });
        const valComplete = complete_task_tool_1.completeTaskTool.validateInput?.({ taskId: "1; cat /etc/passwd" });
        const plan = (0, plan_validator_1.parseAndValidateAgentPlan)(JSON.stringify({
            type: "action",
            toolCalls: [
                { tool: "create_task", arguments: { text: "malicious && whoami" } },
            ],
        }), "run injection");
        assert(valCreate?.valid === false &&
            valComplete?.valid === false &&
            (plan.plan?.toolCalls.length === 0), "11. Security: Shell metacharacters in create_task and complete_task rejected");
    }
    // ===========================================================================
    // TEST 12: Security: Answer Mode cannot execute mutation tools
    // ===========================================================================
    {
        const plan = (0, plan_validator_1.parseAndValidateAgentPlan)(JSON.stringify({
            type: "answer",
            answerText: "Here is your answer",
            toolCalls: [{ tool: "create_task", arguments: { text: "Sneaky Task" } }],
        }), "What is a task?");
        assert(plan.valid === true &&
            plan.plan?.type === "answer" &&
            plan.plan?.toolCalls.length === 0, "12. Security: Answer Mode strictly forces empty toolCalls array");
    }
    // ===========================================================================
    // TEST 13: Integration: CommandAgent -> Orchestrator -> ToolRegistry -> TaskService
    // ===========================================================================
    {
        task_service_1.taskService.reset(initialTestTasks);
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.setActiveProviderId("mock");
        // End-to-end task creation via natural language
        const resCreate = await command_agent_service_1.commandAgentService.executeCommand("Create a task called Prepare for tomorrow's interview", { isMock: true });
        // End-to-end task completion via natural language
        const resComplete = await command_agent_service_1.commandAgentService.executeCommand("Complete task task-1", { isMock: true });
        const tasks = task_service_1.taskService.getTasks();
        const createdFound = tasks.find((t) => t.text.includes("Prepare for tomorrow's interview"));
        const completedFound = tasks.find((t) => t.id === "task-1");
        assert(Boolean(resCreate.success) &&
            resCreate.intent === "create_task" &&
            Boolean(createdFound) &&
            Boolean(resComplete.success) &&
            resComplete.intent === "complete_task" &&
            completedFound?.completed === true, "13. Integration: CommandAgent executes create_task & complete_task end-to-end");
    }
    // ===========================================================================
    // TEST 14: Compatibility: Existing read-only tools continue working
    // ===========================================================================
    {
        const hasNav = tool_registry_1.toolRegistry.has("navigate");
        const hasSys = tool_registry_1.toolRegistry.has("system_status");
        const hasTasks = tool_registry_1.toolRegistry.has("show_tasks");
        const hasCreate = tool_registry_1.toolRegistry.has("create_task");
        const hasComplete = tool_registry_1.toolRegistry.has("complete_task");
        assert(hasNav && hasSys && hasTasks && hasCreate && hasComplete, "14. Compatibility: ToolRegistry registers both read-only and task mutation tools");
    }
    // ===========================================================================
    // TEST 15: Compatibility: Claude & provider fallback intact
    // ===========================================================================
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        provider_config_service_1.providerConfigService.setActiveProviderId("claude");
        const claudeCreateTaskBody = JSON.stringify({
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        type: "action",
                        toolCalls: [
                            { tool: "create_task", arguments: { text: "Review ML Paper", category: "Data Science" } },
                        ],
                        explanation: "Creating ML research task via Claude.",
                    }),
                },
            ],
        });
        const res = await withFakeFetch(async () => new Response(claudeCreateTaskBody, { status: 200 }), async () => command_agent_service_1.commandAgentService.executeCommand("Add task Review ML Paper", { isMock: true }));
        const prompt = (0, planning_prompt_1.buildAgentSystemPrompt)({ userRequest: "Create a task" });
        assert(Boolean(res.success) &&
            res.intent === "create_task" &&
            res.executed === true &&
            prompt.includes("create_task") &&
            prompt.includes("complete_task"), "15. Compatibility: Claude planning & system prompt catalog include task mutations");
    }
    console.log("==========================================================================");
    console.log(`Task Mutation Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================\n");
    if (failed > 0) {
        process.exit(1);
    }
}
runTaskMutationTests().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
});
