import { providerConfigService } from "../config/provider-config.service";
import { providerRegistry } from "../provider-registry";
import { ollamaAIProvider, OllamaAIProvider } from "./ollama-ai-provider";
import { toolRegistry, registerDefaultTools } from "../../tools";
import { commandAgentService } from "../../command-agent.service";
import { taskService } from "../../../services/task.service";
import { goalService } from "../../../services/goal.service";
import { projectService } from "../../../services/project.service";
import { conversationContextService } from "../../../services/conversation-context.service";
import { confirmationStore } from "../../risk";

/**
 * Ollama Runtime Integration & Configuration Test Suite
 */
async function runOllamaRuntimeIntegrationTests() {
    console.log("==========================================================================");
    console.log("ALFRED Ollama Runtime Integration & Configuration Test Suite");
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

    function resetEnv() {
        confirmationStore.clear();
        conversationContextService.clear();
        taskService.syncTasks([]);
        goalService.syncGoals([]);
        projectService.syncProjects([]);
        providerConfigService.reset();
    }

    resetEnv();

    // 1. Default Ollama model resolves to qwen3:latest
    const defaultOllamaConfig = providerConfigService.getProviderConfig("ollama");
    assert(
        defaultOllamaConfig.modelName === "qwen3:latest",
        "1. Default Ollama model in providerConfigService resolves to 'qwen3:latest'",
        `modelName: ${defaultOllamaConfig.modelName}`
    );

    // 2. Ollama provider uses the configured model
    const effectiveClientConfig = ollamaAIProvider.getEffectiveClientConfig();
    assert(
        effectiveClientConfig.modelName === "qwen3:latest",
        "2. OllamaAIProvider effective client config uses 'qwen3:latest'",
        `modelName: ${effectiveClientConfig.modelName}`
    );

    // 3. Default Ollama timeout is 60000ms
    assert(
        effectiveClientConfig.timeoutMs === 60000,
        "3. Default Ollama inference timeout is 60000ms (safe for local inference)",
        `timeoutMs: ${effectiveClientConfig.timeoutMs}`
    );

    // 4. Default tools are registered during runtime initialization
    const expectedTools = [
        "launch_application",
        "navigate",
        "system_status",
        "start_deep_work",
        "launch_workspace",
        "show_tasks",
        "open_url",
        "open_path",
        "create_task",
        "complete_task",
        "create_goal",
        "update_goal",
        "update_project",
    ];
    const registeredToolNames = toolRegistry.list().map((t) => t.name);
    const allToolsPresent = expectedTools.every((name) => toolRegistry.has(name));
    assert(
        allToolsPresent && registeredToolNames.length >= expectedTools.length,
        "4. Default tools are registered in ToolRegistry at runtime",
        `toolCount: ${registeredToolNames.length}`
    );

    // 5. ToolRegistry contains each expected tool by name
    assert(
        toolRegistry.has("show_tasks") &&
        toolRegistry.has("create_task") &&
        toolRegistry.has("create_goal") &&
        toolRegistry.has("update_project"),
        "5. ToolRegistry contains core productivity and query tools (show_tasks, create_task, etc.)"
    );

    // 6. Duplicate initialization does not duplicate tools
    const countBefore = toolRegistry.list().length;
    registerDefaultTools();
    const countAfter = toolRegistry.list().length;
    assert(
        countBefore === countAfter,
        "6. Duplicate initialization is idempotent and does not create duplicate tools",
        `before: ${countBefore}, after: ${countAfter}`
    );

    // Helper: test with injected fake fetch to verify provider handling deterministically
    async function withFakeOllamaFetch<T>(
        fakeFetch: typeof globalThis.fetch,
        fn: () => Promise<T>
    ): Promise<T> {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = fakeFetch;
        try {
            return await fn();
        } finally {
            globalThis.fetch = originalFetch;
        }
    }

    // 7. Ollama action plan reaches ToolRegistry execution
    resetEnv();
    providerConfigService.setActiveProviderId("ollama");
    const actionResponseJson = JSON.stringify({
        model: "qwen3:latest",
        response: JSON.stringify({
            type: "action",
            toolCalls: [
                {
                    tool: "create_task",
                    arguments: { text: "Study Neural Networks", category: "Data Science" },
                },
            ],
            explanation: "Creating task in Mission Control.",
        }),
        done: true,
    });

    const actionExecution = await withFakeOllamaFetch(
        async (url) => {
            if (String(url).includes("/api/tags")) {
                return new Response(JSON.stringify({ models: [{ name: "qwen3:latest" }] }), { status: 200 });
            }
            return new Response(actionResponseJson, { status: 200, headers: { "Content-Type": "application/json" } });
        },
        async () => {
            return await commandAgentService.executeCommand("Create a task called Study Neural Networks");
        }
    );

    assert(
        actionExecution.success === true &&
        actionExecution.executed === true &&
        actionExecution.providerId === "ollama" &&
        taskService.getTasks().length === 1 &&
        taskService.getTasks()[0].text === "Study Neural Networks",
        "7. Ollama action plan (create_task) executes through ToolRegistry without mock fallback",
        `executed: ${actionExecution.executed}, provider: ${actionExecution.providerId}, tasks: ${taskService.getTasks().length}`
    );

    // 8. Ollama answer plan works without tool execution
    resetEnv();
    providerConfigService.setActiveProviderId("ollama");
    const answerResponseJson = JSON.stringify({
        model: "qwen3:latest",
        response: JSON.stringify({
            type: "answer",
            answerText: "You currently have 0 pending tasks in your ALFRED workspace.",
            toolCalls: [],
            explanation: "Informational answer provided.",
        }),
        done: true,
    });

    const answerExecution = await withFakeOllamaFetch(
        async (url) => {
            if (String(url).includes("/api/tags")) {
                return new Response(JSON.stringify({ models: [{ name: "qwen3:latest" }] }), { status: 200 });
            }
            return new Response(answerResponseJson, { status: 200, headers: { "Content-Type": "application/json" } });
        },
        async () => {
            return await commandAgentService.executeCommand("What tasks do I currently have?");
        }
    );

    assert(
        answerExecution.success === true &&
        answerExecution.responseType === "answer" &&
        answerExecution.executed === false &&
        answerExecution.providerId === "ollama" &&
        Boolean(answerExecution.answerText?.includes("0 pending tasks")),
        "8. Ollama answer plan returns text directly without tool execution (executed = false)",
        `responseType: ${answerExecution.responseType}, answer: ${answerExecution.answerText?.slice(0, 40)}...`
    );

    // 9. Ollama unavailable still falls back safely to Mock
    resetEnv();
    providerConfigService.setActiveProviderId("ollama");
    const fallbackExecution = await withFakeOllamaFetch(
        async () => {
            throw new Error("ECONNREFUSED");
        },
        async () => {
            return await commandAgentService.executeCommand("Open VS Code", { isMock: true });
        }
    );

    assert(
        fallbackExecution.fallbackUsed === true &&
        Boolean(fallbackExecution.error?.includes("fallback")),
        "9. Ollama unavailable safely falls back to Mock AI",
        `fallbackUsed: ${fallbackExecution.fallbackUsed}, error: ${fallbackExecution.error}`
    );

    // 10. Existing confirmation/risk-control behavior remains intact with Ollama
    resetEnv();
    providerConfigService.setActiveProviderId("ollama");
    const highRiskResponseJson = JSON.stringify({
        model: "qwen3:latest",
        response: JSON.stringify({
            type: "action",
            toolCalls: [
                { tool: "create_task", arguments: { text: "Task A" } },
                { tool: "create_goal", arguments: { title: "Goal B", target: 5 } },
            ],
            explanation: "High risk 2-mutation action plan.",
        }),
        done: true,
    });

    const highRiskExecution = await withFakeOllamaFetch(
        async (url) => {
            if (String(url).includes("/api/tags")) {
                return new Response(JSON.stringify({ models: [{ name: "qwen3:latest" }] }), { status: 200 });
            }
            return new Response(highRiskResponseJson, { status: 200, headers: { "Content-Type": "application/json" } });
        },
        async () => {
            return await commandAgentService.executeCommand("Create task Task A and create goal Goal B");
        }
    );

    assert(
        highRiskExecution.requiresConfirmation === true &&
        highRiskExecution.risk?.level === "high" &&
        highRiskExecution.risk?.mutationCount === 2 &&
        highRiskExecution.executed === false &&
        typeof highRiskExecution.confirmationId === "string" &&
        taskService.getTasks().length === 0,
        "10. High-risk multi-mutation plan from Ollama halts at confirmation gate (0 tools executed before confirmation)",
        `requiresConfirmation: ${highRiskExecution.requiresConfirmation}, risk: ${highRiskExecution.risk?.level}, id: ${highRiskExecution.confirmationId}`
    );

    // Confirm execution
    const confirmResult = await commandAgentService.confirmAction(highRiskExecution.confirmationId!);
    assert(
        confirmResult.success === true &&
        confirmResult.executed === true &&
        taskService.getTasks().length === 1 &&
        goalService.getGoals().length === 1,
        "10b. Confirming Ollama high-risk plan executes mutations successfully",
        `tasks: ${taskService.getTasks().length}, goals: ${goalService.getGoals().length}`
    );

    resetEnv();

    console.log("\n==========================================================================");
    console.log(`Ollama Runtime Integration Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log("==========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runOllamaRuntimeIntegrationTests().catch((err) => {
    console.error("Test failed with exception:", err);
    process.exit(1);
});
