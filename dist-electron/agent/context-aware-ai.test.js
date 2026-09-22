"use strict";
/**
 * Context-Aware AI Test Suite (Phase 3.3 - Step 4.10)
 *
 * Verifies that ALFRED supports read-only application state context snapshots,
 * preserving privacy, reusing state models, and enabling context-informed AI planning
 * for both Answer Mode and Action Mode across all AI providers.
 *
 * Test cases:
 *  1. Context builder creates a valid sanitized snapshot from raw ALFRED state.
 *  2. Pending and completed tasks are represented correctly.
 *  3. Projects, goals, and workspaces use existing models.
 *  4. Context is strictly read-only (unmodified original state).
 *  5. Secrets, API keys, and environment credentials are NOT exposed.
 *  6. Empty or missing state is handled gracefully without crashing.
 *  7. Context is passed to provider planning requests.
 *  8. Answer Mode uses context to answer task/project questions.
 *  9. Action Mode uses context to resolve targeted workspace launch.
 * 10. Multi-provider architecture remains 100% compatible.
 * 11. ToolRegistry remains execution authority for context-based actions.
 * 12. Fallback behavior remains intact when active provider is unconfigured.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const context_builder_1 = require("./providers/impl/context-builder");
const planning_prompt_1 = require("./providers/impl/planning-prompt");
const command_agent_service_1 = require("./command-agent.service");
const provider_config_service_1 = require("./providers/config/provider-config.service");
const provider_registry_1 = require("./providers/provider-registry");
const mock_ai_provider_1 = require("./providers/impl/mock-ai-provider");
const ollama_ai_provider_1 = require("./providers/impl/ollama-ai-provider");
const gemini_ai_provider_1 = require("./providers/impl/gemini-ai-provider");
const claude_ai_provider_1 = require("./providers/impl/claude-ai-provider");
const index_1 = require("./tools/index");
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
async function runContextAwareAITests() {
    console.log("==========================================================================");
    console.log("ALFRED Context-Aware AI — Step 4.10 Test Suite");
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
    provider_config_service_1.providerConfigService.reset();
    provider_registry_1.providerRegistry.clear();
    provider_registry_1.providerRegistry.registerProvider(mock_ai_provider_1.mockAIProvider);
    provider_registry_1.providerRegistry.registerProvider(ollama_ai_provider_1.ollamaAIProvider);
    provider_registry_1.providerRegistry.registerProvider(gemini_ai_provider_1.geminiAIProvider);
    provider_registry_1.providerRegistry.registerProvider(claude_ai_provider_1.claudeAIProvider);
    (0, index_1.registerDefaultTools)();
    // Sample ALFRED application state
    const sampleTasks = [
        { id: "t1", text: "Implement Context Builder", completed: true, category: "Engineering" },
        { id: "t2", text: "Write Unit Tests", completed: false, category: "Engineering" },
        { id: "t3", text: "Review Security Boundary", completed: false, category: "Security" },
    ];
    const sampleProjects = [
        {
            id: "p1",
            name: "ALFRED AI",
            description: "Context-aware desktop AI assistant",
            category: "Personal",
            status: "In Progress",
            progress: 85,
            createdDate: "2026-09-21",
        },
    ];
    const sampleGoals = [
        { id: "g1", title: "Complete Phase 3.3 Step 4.10", type: "Weekly", target: 1, current: 0, completed: false },
    ];
    const sampleWorkspaces = [
        {
            id: "ws_ml",
            name: "Machine Learning",
            description: "PyTorch & Jupyter setup",
            type: "machinelearning",
            applications: ["VS Code", "Windows Terminal"],
            websites: ["https://kaggle.com"],
            localFolders: [],
            createdDate: "2026-09-21",
            launchCount: 5,
            lastLaunched: "2026-09-21",
        },
    ];
    // ===========================================================================
    // TEST 1: Context builder creates a valid sanitized snapshot
    // ===========================================================================
    {
        const snapshot = (0, context_builder_1.buildAlfredContext)({
            tasks: sampleTasks,
            projects: sampleProjects,
            goals: sampleGoals,
            workspaces: sampleWorkspaces,
            currentFocus: "Engineering",
        });
        assert(Boolean(snapshot.tasks) &&
            snapshot.tasks?.length === 3 &&
            snapshot.projects?.length === 1 &&
            snapshot.goals?.length === 1 &&
            snapshot.workspaces?.length === 1 &&
            snapshot.currentFocus === "Engineering", "1. Context builder creates a valid sanitized snapshot from raw ALFRED state");
    }
    // ===========================================================================
    // TEST 2: Pending and completed tasks represented correctly
    // ===========================================================================
    {
        const snapshot = (0, context_builder_1.buildAlfredContext)({ tasks: sampleTasks });
        const completed = snapshot.tasks?.filter((t) => t.completed);
        const pending = snapshot.tasks?.filter((t) => !t.completed);
        assert(completed?.length === 1 && completed[0].id === "t1" && pending?.length === 2, "2. Pending and completed tasks are represented correctly");
    }
    // ===========================================================================
    // TEST 3: Projects, goals, and workspaces use existing models
    // ===========================================================================
    {
        const snapshot = (0, context_builder_1.buildAlfredContext)({
            projects: sampleProjects,
            goals: sampleGoals,
            workspaces: sampleWorkspaces,
        });
        assert(snapshot.projects?.[0].name === "ALFRED AI" &&
            snapshot.goals?.[0].title === "Complete Phase 3.3 Step 4.10" &&
            snapshot.workspaces?.[0].name === "Machine Learning" &&
            snapshot.workspaces?.[0].applications.includes("VS Code"), "3. Projects, goals, and workspaces use existing models");
    }
    // ===========================================================================
    // TEST 4: Context is strictly READ-ONLY
    // ===========================================================================
    {
        const originalTasksJSON = JSON.stringify(sampleTasks);
        const snapshot = (0, context_builder_1.buildAlfredContext)({ tasks: sampleTasks });
        if (snapshot.tasks && snapshot.tasks[0]) {
            snapshot.tasks[0].text = "MUTATED TEXT";
        }
        assert(JSON.stringify(sampleTasks) === originalTasksJSON, "4. Context is strictly read-only (original application state is immutable)");
    }
    // ===========================================================================
    // TEST 5: Secrets, API keys, and environment variables are NOT exposed
    // ===========================================================================
    {
        const snapshotJson = JSON.stringify((0, context_builder_1.buildAlfredContext)({
            tasks: sampleTasks,
            workspaces: sampleWorkspaces,
        }));
        assert(!snapshotJson.includes("apiKey") &&
            !snapshotJson.includes("password") &&
            !snapshotJson.includes("secret") &&
            !snapshotJson.includes("ANTHROPIC_API_KEY") &&
            !snapshotJson.includes("GEMINI_API_KEY"), "5. Secrets, API keys, and environment credentials are NOT exposed");
    }
    // ===========================================================================
    // TEST 6: Empty/missing state is handled gracefully
    // ===========================================================================
    {
        const emptySnapshot1 = (0, context_builder_1.buildAlfredContext)();
        const emptySnapshot2 = (0, context_builder_1.buildAlfredContext)({});
        assert(Object.keys(emptySnapshot1).length === 0 && Object.keys(emptySnapshot2).length === 0, "6. Empty or missing state is handled gracefully without errors");
    }
    // ===========================================================================
    // TEST 7: Context is passed to provider planning requests
    // ===========================================================================
    {
        const context = (0, context_builder_1.buildAlfredContext)({ tasks: sampleTasks });
        const prompt = (0, planning_prompt_1.buildAgentSystemPrompt)({
            userRequest: "What tasks are pending?",
            context: context,
        });
        assert(prompt.includes("ALFRED Application Context (READ-ONLY Snapshot)") &&
            prompt.includes("Write Unit Tests") &&
            prompt.includes("Review Security Boundary"), "7. Context is formatted into system prompt and passed to provider planning");
    }
    // ===========================================================================
    // TEST 8: Answer Mode uses context to answer questions
    // ===========================================================================
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.setActiveProviderId("mock");
        const context = (0, context_builder_1.buildAlfredContext)({ tasks: sampleTasks });
        const res = await command_agent_service_1.commandAgentService.executeCommand("What should I work on now?", {
            isMock: true,
            context: context,
        });
        assert(Boolean(res.success) &&
            res.responseType === "answer" &&
            res.executed === false &&
            Boolean(res.answerText?.includes("Write Unit Tests")), "8. Answer Mode uses context to answer user question without tool execution");
    }
    // ===========================================================================
    // TEST 9: Action Mode uses context to resolve targeted workspace launch
    // ===========================================================================
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.setActiveProviderId("mock");
        const context = (0, context_builder_1.buildAlfredContext)({ workspaces: sampleWorkspaces });
        const res = await command_agent_service_1.commandAgentService.executeCommand("Open the workspace for my ML project", {
            isMock: true,
            context: context,
        });
        assert(Boolean(res.success) &&
            res.intent === "launch_workspace" &&
            res.appName === "Machine Learning" &&
            res.executed === true, "9. Action Mode uses context to construct targeted action plan");
    }
    // ===========================================================================
    // TEST 10: Multi-provider architecture compatibility (Claude with context)
    // ===========================================================================
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        provider_config_service_1.providerConfigService.setActiveProviderId("claude");
        const context = (0, context_builder_1.buildAlfredContext)({ tasks: sampleTasks });
        const mockClaudeResponseBody = JSON.stringify({
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        type: "answer",
                        answerText: "Based on your context, you have 2 pending tasks: Write Unit Tests and Review Security Boundary.",
                        toolCalls: [],
                        explanation: "Context-aware answer via Claude.",
                    }),
                },
            ],
        });
        const res = await withFakeFetch(async () => new Response(mockClaudeResponseBody, { status: 200 }), async () => command_agent_service_1.commandAgentService.executeCommand("What should I work on now?", {
            isMock: true,
            context: context,
        }));
        assert(Boolean(res.success) &&
            res.providerId === "claude" &&
            res.responseType === "answer" &&
            Boolean(res.answerText?.includes("Write Unit Tests")), "10. Multi-provider architecture compatibility: Claude executes context-aware Answer Mode");
    }
    // ===========================================================================
    // TEST 11: Action execution still routes through ToolRegistry
    // ===========================================================================
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        provider_config_service_1.providerConfigService.setActiveProviderId("claude");
        const context = (0, context_builder_1.buildAlfredContext)({ workspaces: sampleWorkspaces });
        const mockClaudeActionBody = JSON.stringify({
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        type: "action",
                        toolCalls: [{ tool: "launch_workspace", arguments: { workspaceName: "Machine Learning" } }],
                        explanation: "Launching workspace via ToolRegistry.",
                    }),
                },
            ],
        });
        const res = await withFakeFetch(async () => new Response(mockClaudeActionBody, { status: 200 }), async () => command_agent_service_1.commandAgentService.executeCommand("Open Machine Learning workspace", {
            isMock: true,
            context: context,
        }));
        assert(Boolean(res.success) &&
            res.intent === "launch_workspace" &&
            res.executed === true &&
            res.appName === "Machine Learning", "11. Action execution still routes through ToolRegistry");
    }
    // ===========================================================================
    // TEST 12: Fallback behavior remains intact when active provider unconfigured
    // ===========================================================================
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.setActiveProviderId("claude"); // Unconfigured (no API key)
        const res = await command_agent_service_1.commandAgentService.executeCommand("Open VS Code", { isMock: true });
        assert(Boolean(res.success) &&
            res.fallbackUsed === true &&
            res.intent === "launch_application" &&
            res.appName === "VS Code", "12. Fallback behavior remains intact when active provider is unconfigured");
    }
    console.log("==========================================================================");
    console.log(`Context-Aware AI Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================\n");
    if (failed > 0) {
        process.exit(1);
    }
}
runContextAwareAITests().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
});
