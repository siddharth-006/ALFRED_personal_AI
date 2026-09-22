"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const provider_config_service_1 = require("../config/provider-config.service");
const ollama_ai_provider_1 = require("./ollama-ai-provider");
const tools_1 = require("../../tools");
const command_agent_service_1 = require("../../command-agent.service");
const task_service_1 = require("../../../services/task.service");
const goal_service_1 = require("../../../services/goal.service");
const project_service_1 = require("../../../services/project.service");
const conversation_context_service_1 = require("../../../services/conversation-context.service");
const risk_1 = require("../../risk");
/**
 * Ollama Runtime Integration & Configuration Test Suite
 */
async function runOllamaRuntimeIntegrationTests() {
    console.log("==========================================================================");
    console.log("ALFRED Ollama Runtime Integration & Configuration Test Suite");
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
    function resetEnv() {
        risk_1.confirmationStore.clear();
        conversation_context_service_1.conversationContextService.clear();
        task_service_1.taskService.syncTasks([]);
        goal_service_1.goalService.syncGoals([]);
        project_service_1.projectService.syncProjects([]);
        provider_config_service_1.providerConfigService.reset();
    }
    resetEnv();
    // 1. Default Ollama model resolves to qwen3:latest
    const defaultOllamaConfig = provider_config_service_1.providerConfigService.getProviderConfig("ollama");
    assert(defaultOllamaConfig.modelName === "qwen3:latest", "1. Default Ollama model in providerConfigService resolves to 'qwen3:latest'", `modelName: ${defaultOllamaConfig.modelName}`);
    // 2. Ollama provider uses the configured model
    const effectiveClientConfig = ollama_ai_provider_1.ollamaAIProvider.getEffectiveClientConfig();
    assert(effectiveClientConfig.modelName === "qwen3:latest", "2. OllamaAIProvider effective client config uses 'qwen3:latest'", `modelName: ${effectiveClientConfig.modelName}`);
    // 3. Default Ollama timeout is 60000ms
    assert(effectiveClientConfig.timeoutMs === 60000, "3. Default Ollama inference timeout is 60000ms (safe for local inference)", `timeoutMs: ${effectiveClientConfig.timeoutMs}`);
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
    const registeredToolNames = tools_1.toolRegistry.list().map((t) => t.name);
    const allToolsPresent = expectedTools.every((name) => tools_1.toolRegistry.has(name));
    assert(allToolsPresent && registeredToolNames.length >= expectedTools.length, "4. Default tools are registered in ToolRegistry at runtime", `toolCount: ${registeredToolNames.length}`);
    // 5. ToolRegistry contains each expected tool by name
    assert(tools_1.toolRegistry.has("show_tasks") &&
        tools_1.toolRegistry.has("create_task") &&
        tools_1.toolRegistry.has("create_goal") &&
        tools_1.toolRegistry.has("update_project"), "5. ToolRegistry contains core productivity and query tools (show_tasks, create_task, etc.)");
    // 6. Duplicate initialization does not duplicate tools
    const countBefore = tools_1.toolRegistry.list().length;
    (0, tools_1.registerDefaultTools)();
    const countAfter = tools_1.toolRegistry.list().length;
    assert(countBefore === countAfter, "6. Duplicate initialization is idempotent and does not create duplicate tools", `before: ${countBefore}, after: ${countAfter}`);
    // Helper: test with injected fake fetch to verify provider handling deterministically
    async function withFakeOllamaFetch(fakeFetch, fn) {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = fakeFetch;
        try {
            return await fn();
        }
        finally {
            globalThis.fetch = originalFetch;
        }
    }
    // 7. Ollama action plan reaches ToolRegistry execution
    resetEnv();
    provider_config_service_1.providerConfigService.setActiveProviderId("ollama");
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
    const actionExecution = await withFakeOllamaFetch(async (url) => {
        if (String(url).includes("/api/tags")) {
            return new Response(JSON.stringify({ models: [{ name: "qwen3:latest" }] }), { status: 200 });
        }
        return new Response(actionResponseJson, { status: 200, headers: { "Content-Type": "application/json" } });
    }, async () => {
        return await command_agent_service_1.commandAgentService.executeCommand("Create a task called Study Neural Networks");
    });
    assert(actionExecution.success === true &&
        actionExecution.executed === true &&
        actionExecution.providerId === "ollama" &&
        task_service_1.taskService.getTasks().length === 1 &&
        task_service_1.taskService.getTasks()[0].text === "Study Neural Networks", "7. Ollama action plan (create_task) executes through ToolRegistry without mock fallback", `executed: ${actionExecution.executed}, provider: ${actionExecution.providerId}, tasks: ${task_service_1.taskService.getTasks().length}`);
    // 8. Ollama answer plan works without tool execution
    resetEnv();
    provider_config_service_1.providerConfigService.setActiveProviderId("ollama");
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
    const answerExecution = await withFakeOllamaFetch(async (url) => {
        if (String(url).includes("/api/tags")) {
            return new Response(JSON.stringify({ models: [{ name: "qwen3:latest" }] }), { status: 200 });
        }
        return new Response(answerResponseJson, { status: 200, headers: { "Content-Type": "application/json" } });
    }, async () => {
        return await command_agent_service_1.commandAgentService.executeCommand("What tasks do I currently have?");
    });
    assert(answerExecution.success === true &&
        answerExecution.responseType === "answer" &&
        answerExecution.executed === false &&
        answerExecution.providerId === "ollama" &&
        Boolean(answerExecution.answerText?.includes("0 pending tasks")), "8. Ollama answer plan returns text directly without tool execution (executed = false)", `responseType: ${answerExecution.responseType}, answer: ${answerExecution.answerText?.slice(0, 40)}...`);
    // 9. Ollama unavailable still falls back safely to Mock
    resetEnv();
    provider_config_service_1.providerConfigService.setActiveProviderId("ollama");
    const fallbackExecution = await withFakeOllamaFetch(async () => {
        throw new Error("ECONNREFUSED");
    }, async () => {
        return await command_agent_service_1.commandAgentService.executeCommand("Open VS Code", { isMock: true });
    });
    assert(fallbackExecution.fallbackUsed === true &&
        Boolean(fallbackExecution.error?.includes("fallback")), "9. Ollama unavailable safely falls back to Mock AI", `fallbackUsed: ${fallbackExecution.fallbackUsed}, error: ${fallbackExecution.error}`);
    // 10. Existing confirmation/risk-control behavior remains intact with Ollama
    resetEnv();
    provider_config_service_1.providerConfigService.setActiveProviderId("ollama");
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
    const highRiskExecution = await withFakeOllamaFetch(async (url) => {
        if (String(url).includes("/api/tags")) {
            return new Response(JSON.stringify({ models: [{ name: "qwen3:latest" }] }), { status: 200 });
        }
        return new Response(highRiskResponseJson, { status: 200, headers: { "Content-Type": "application/json" } });
    }, async () => {
        return await command_agent_service_1.commandAgentService.executeCommand("Create task Task A and create goal Goal B");
    });
    assert(highRiskExecution.requiresConfirmation === true &&
        highRiskExecution.risk?.level === "high" &&
        highRiskExecution.risk?.mutationCount === 2 &&
        highRiskExecution.executed === false &&
        typeof highRiskExecution.confirmationId === "string" &&
        task_service_1.taskService.getTasks().length === 0, "10. High-risk multi-mutation plan from Ollama halts at confirmation gate (0 tools executed before confirmation)", `requiresConfirmation: ${highRiskExecution.requiresConfirmation}, risk: ${highRiskExecution.risk?.level}, id: ${highRiskExecution.confirmationId}`);
    // Confirm execution
    const confirmResult = await command_agent_service_1.commandAgentService.confirmAction(highRiskExecution.confirmationId);
    assert(confirmResult.success === true &&
        confirmResult.executed === true &&
        task_service_1.taskService.getTasks().length === 1 &&
        goal_service_1.goalService.getGoals().length === 1, "10b. Confirming Ollama high-risk plan executes mutations successfully", `tasks: ${task_service_1.taskService.getTasks().length}, goals: ${goal_service_1.goalService.getGoals().length}`);
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
