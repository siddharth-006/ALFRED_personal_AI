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

import { taskService, Task } from "../services/task.service";
import { createTaskTool } from "./tools/builtins/create-task.tool";
import { completeTaskTool } from "./tools/builtins/complete-task.tool";
import { toolRegistry } from "./tools/tool-registry";
import { registerDefaultTools } from "./tools/index";
import { parseAndValidateAgentPlan } from "./providers/impl/plan-validator";
import { buildAgentSystemPrompt } from "./providers/impl/planning-prompt";
import { commandAgentService } from "./command-agent.service";
import { providerConfigService } from "./providers/config/provider-config.service";
import { providerRegistry } from "./providers/provider-registry";
import { mockAIProvider } from "./providers/impl/mock-ai-provider";
import { claudeAIProvider } from "./providers/impl/claude-ai-provider";
import "./providers/index";

// Mock helper to intercept fetch for cloud providers
async function withFakeFetch<T>(
    responseFactory: (url: string, init?: RequestInit) => Response | Promise<Response>,
    fn: () => Promise<T>
): Promise<T> {
    const originalFetch = globalThis.fetch;
    try {
        globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
            const urlString = typeof input === "string" ? input : input.toString();
            return Promise.resolve(responseFactory(urlString, init));
        };
        return await fn();
    } finally {
        globalThis.fetch = originalFetch;
    }
}

async function runTaskMutationTests() {
    console.log("==========================================================================");
    console.log("ALFRED Controlled Task Mutation — Phase 4.11 Test Suite");
    console.log("==========================================================================\n");

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, testName: string, detail?: string) {
        if (condition) {
            passed++;
            console.log(`✅ [PASS] ${testName}`);
            if (detail) console.log(`   Detail: ${detail}`);
        } else {
            failed++;
            console.log(`❌ [FAIL] ${testName}`);
            if (detail) console.log(`   Failure Detail: ${detail}`);
        }
    }

    // Setup fresh environment
    registerDefaultTools();
    providerConfigService.reset();
    providerRegistry.clear();
    providerRegistry.registerProvider(mockAIProvider);
    providerRegistry.registerProvider(claudeAIProvider);

    const initialTestTasks: Task[] = [
        { id: "task-1", text: "Read research paper", completed: false, category: "Research" },
        { id: "task-2", text: "Fix database index", completed: false, category: "Engineering" },
        { id: "task-3", text: "Prepare slides", completed: true, category: "Management" },
    ];
    taskService.reset(initialTestTasks);

    // ===========================================================================
    // TEST 1: create_task: Valid creation
    // ===========================================================================
    {
        const val = createTaskTool.validateInput?.({ text: "Finish ML project", category: "Data Science" });
        const res = await createTaskTool.execute({ text: "Finish ML project", category: "Data Science" });

        assert(
            Boolean(val?.valid) &&
                res.success === true &&
                res.data?.task.text === "Finish ML project" &&
                res.data?.task.category === "Data Science" &&
                res.data?.task.completed === false,
            "1. create_task: Valid creation creates task with correct properties"
        );
    }

    // ===========================================================================
    // TEST 2: create_task: Empty title rejected
    // ===========================================================================
    {
        const val = createTaskTool.validateInput?.({ text: "" });
        assert(
            val?.valid === false && Boolean(val?.error),
            "2. create_task: Empty title/text rejected by validator"
        );
    }

    // ===========================================================================
    // TEST 3: create_task: Whitespace-only title rejected
    // ===========================================================================
    {
        const val = createTaskTool.validateInput?.({ text: "    \t\n  " });
        assert(
            val?.valid === false && Boolean(val?.error),
            "3. create_task: Whitespace-only title rejected by validator"
        );
    }

    // ===========================================================================
    // TEST 4: create_task: Malformed arguments (non-object) rejected
    // ===========================================================================
    {
        const val1 = createTaskTool.validateInput?.(null);
        const val2 = createTaskTool.validateInput?.("just a string");
        const val3 = createTaskTool.validateInput?.(["array"]);

        assert(
            val1?.valid === false && val2?.valid === false && val3?.valid === false,
            "4. create_task: Malformed arguments (null, string, array) rejected"
        );
    }

    // ===========================================================================
    // TEST 5: create_task: Exactly one task created
    // ===========================================================================
    {
        taskService.reset(initialTestTasks);
        const countBefore = taskService.getTasks().length;

        await createTaskTool.execute({ text: "Review PR #42", category: "Engineering" });
        const countAfter = taskService.getTasks().length;

        assert(
            countAfter === countBefore + 1,
            "5. create_task: Exactly one task is created in task state"
        );
    }

    // ===========================================================================
    // TEST 6: complete_task: Valid existing task completes successfully
    // ===========================================================================
    {
        taskService.reset(initialTestTasks);
        const val = completeTaskTool.validateInput?.({ taskId: "task-2" });
        const res = await completeTaskTool.execute({ taskId: "task-2" });

        const updated = taskService.getTasks().find((t) => t.id === "task-2");

        assert(
            Boolean(val?.valid) &&
                res.success === true &&
                res.data?.task.id === "task-2" &&
                res.data?.task.completed === true &&
                updated?.completed === true,
            "6. complete_task: Valid existing task completes successfully"
        );
    }

    // ===========================================================================
    // TEST 7: complete_task: Nonexistent task returns safe failure
    // ===========================================================================
    {
        taskService.reset(initialTestTasks);
        const res = await completeTaskTool.execute({ taskId: "nonexistent-id-999" });

        assert(
            res.success === false && Boolean(res.error?.includes("not found")),
            "7. complete_task: Nonexistent task returns safe structured failure without crashing"
        );
    }

    // ===========================================================================
    // TEST 8: complete_task: Malformed/empty taskId rejected
    // ===========================================================================
    {
        const val1 = completeTaskTool.validateInput?.({ taskId: "" });
        const val2 = completeTaskTool.validateInput?.({});
        const val3 = completeTaskTool.validateInput?.("just-string");

        assert(
            val1?.valid === false && val2?.valid === false && val3?.valid === false,
            "8. complete_task: Malformed or empty taskId rejected"
        );
    }

    // ===========================================================================
    // TEST 9: complete_task: Only the requested task changes
    // ===========================================================================
    {
        taskService.reset(initialTestTasks);
        await completeTaskTool.execute({ taskId: "task-1" });

        const tasks = taskService.getTasks();
        const t1 = tasks.find((t) => t.id === "task-1");
        const t2 = tasks.find((t) => t.id === "task-2");

        assert(
            t1?.completed === true && t2?.completed === false,
            "9. complete_task: Mutates only the requested task without affecting other tasks"
        );
    }

    // ===========================================================================
    // TEST 10: Security: Unregistered mutation tool rejected
    // ===========================================================================
    {
        const plan = parseAndValidateAgentPlan(
            JSON.stringify({
                type: "action",
                toolCalls: [
                    { tool: "delete_task", arguments: { taskId: "task-1" } },
                    { tool: "drop_database", arguments: {} },
                ],
            }),
            "delete my task"
        );

        assert(
            plan.valid === false || (plan.plan?.toolCalls.length === 0),
            "10. Security: Unregistered mutation tools ('delete_task', 'drop_database') rejected"
        );
    }

    // ===========================================================================
    // TEST 11: Security: Shell metacharacters rejected
    // ===========================================================================
    {
        const valCreate = createTaskTool.validateInput?.({ text: "echo test; rm -rf /" });
        const valComplete = completeTaskTool.validateInput?.({ taskId: "1; cat /etc/passwd" });

        const plan = parseAndValidateAgentPlan(
            JSON.stringify({
                type: "action",
                toolCalls: [
                    { tool: "create_task", arguments: { text: "malicious && whoami" } },
                ],
            }),
            "run injection"
        );

        assert(
            valCreate?.valid === false &&
                valComplete?.valid === false &&
                (plan.plan?.toolCalls.length === 0),
            "11. Security: Shell metacharacters in create_task and complete_task rejected"
        );
    }

    // ===========================================================================
    // TEST 12: Security: Answer Mode cannot execute mutation tools
    // ===========================================================================
    {
        const plan = parseAndValidateAgentPlan(
            JSON.stringify({
                type: "answer",
                answerText: "Here is your answer",
                toolCalls: [{ tool: "create_task", arguments: { text: "Sneaky Task" } }],
            }),
            "What is a task?"
        );

        assert(
            plan.valid === true &&
                plan.plan?.type === "answer" &&
                plan.plan?.toolCalls.length === 0,
            "12. Security: Answer Mode strictly forces empty toolCalls array"
        );
    }

    // ===========================================================================
    // TEST 13: Integration: CommandAgent -> Orchestrator -> ToolRegistry -> TaskService
    // ===========================================================================
    {
        taskService.reset(initialTestTasks);
        providerConfigService.reset();
        providerConfigService.setActiveProviderId("mock");

        // End-to-end task creation via natural language
        const resCreate = await commandAgentService.executeCommand(
            "Create a task called Prepare for tomorrow's interview",
            { isMock: true }
        );

        // End-to-end task completion via natural language
        const resComplete = await commandAgentService.executeCommand(
            "Complete task task-1",
            { isMock: true }
        );

        const tasks = taskService.getTasks();
        const createdFound = tasks.find((t) => t.text.includes("Prepare for tomorrow's interview"));
        const completedFound = tasks.find((t) => t.id === "task-1");

        assert(
            Boolean(resCreate.success) &&
                resCreate.intent === "create_task" &&
                Boolean(createdFound) &&
                Boolean(resComplete.success) &&
                resComplete.intent === "complete_task" &&
                completedFound?.completed === true,
            "13. Integration: CommandAgent executes create_task & complete_task end-to-end"
        );
    }

    // ===========================================================================
    // TEST 14: Compatibility: Existing read-only tools continue working
    // ===========================================================================
    {
        const hasNav = toolRegistry.has("navigate");
        const hasSys = toolRegistry.has("system_status");
        const hasTasks = toolRegistry.has("show_tasks");
        const hasCreate = toolRegistry.has("create_task");
        const hasComplete = toolRegistry.has("complete_task");

        assert(
            hasNav && hasSys && hasTasks && hasCreate && hasComplete,
            "14. Compatibility: ToolRegistry registers both read-only and task mutation tools"
        );
    }

    // ===========================================================================
    // TEST 15: Compatibility: Claude & provider fallback intact
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        providerConfigService.setActiveProviderId("claude");

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

        const res = await withFakeFetch(
            async () => new Response(claudeCreateTaskBody, { status: 200 }),
            async () => commandAgentService.executeCommand("Add task Review ML Paper", { isMock: true })
        );

        const prompt = buildAgentSystemPrompt({ userRequest: "Create a task" });

        assert(
            Boolean(res.success) &&
                res.intent === "create_task" &&
                res.executed === true &&
                prompt.includes("create_task") &&
                prompt.includes("complete_task"),
            "15. Compatibility: Claude planning & system prompt catalog include task mutations"
        );
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
