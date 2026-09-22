"use strict";
/**
 * Anthropic Claude Provider Adapter Test Suite (Phase 3.3 - Step 4.6)
 *
 * Tests all Claude provider components using fakes/mocks of the HTTP client.
 * DOES NOT require a real Claude API key or network request.
 *
 * Tests:
 *  A) ClaudeResponseParser — JSON extraction, validation, tool whitelist enforcement
 *  B) ClaudeAIProvider    — end-to-end using injected fake HTTP client
 *  C) ProviderRegistry    — Claude registered alongside Mock, Ollama, and Gemini
 *  D) ProviderConfigService fallback — Claude unconfigured/disabled handling
 *  E) Regression          — all existing suites still pass
 */
Object.defineProperty(exports, "__esModule", { value: true });
const claude_response_parser_1 = require("./claude-response-parser");
const claude_ai_provider_1 = require("./claude-ai-provider");
const provider_config_service_1 = require("../config/provider-config.service");
const provider_registry_1 = require("../provider-registry");
const mock_ai_provider_1 = require("./mock-ai-provider");
const ollama_ai_provider_1 = require("./ollama-ai-provider");
const gemini_ai_provider_1 = require("./gemini-ai-provider");
const claude_ai_provider_2 = require("./claude-ai-provider");
const command_agent_service_1 = require("../../command-agent.service");
async function runClaudeTests() {
    console.log("==========================================================================");
    console.log("ALFRED Claude Provider Adapter — Step 4.6 Test Suite");
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
    provider_registry_1.providerRegistry.registerProvider(claude_ai_provider_2.claudeAIProvider);
    // ===========================================================================
    // SECTION A: ClaudeResponseParser
    // ===========================================================================
    console.log("\n--- Section A: ClaudeResponseParser ---\n");
    // A1. Valid JSON with a known tool
    {
        const rawText = JSON.stringify({
            toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code" } }],
            explanation: "Opening VS Code via Claude.",
        });
        const result = (0, claude_response_parser_1.parseClaudeResponse)(rawText, "Open VS Code");
        assert(result.success === true &&
            result.plan?.toolCalls.length === 1 &&
            result.plan?.toolCalls[0].tool === "launch_application" &&
            (result.plan?.toolCalls[0].arguments).appName === "VS Code", "A1. Valid JSON with known tool parses into correct AgentPlan");
    }
    // A2. JSON embedded in markdown code fence
    {
        const rawText = `Here is the plan:\n\`\`\`json\n${JSON.stringify({
            toolCalls: [{ tool: "navigate", arguments: { target: "missions" } }],
            explanation: "Navigate to tasks view.",
        })}\n\`\`\``;
        const result = (0, claude_response_parser_1.parseClaudeResponse)(rawText, "Show missions");
        assert(result.success === true && result.plan?.toolCalls[0].tool === "navigate", "A2. JSON embedded in markdown code fence is extracted correctly");
    }
    // A3. Unknown tool name is silently rejected
    {
        const rawText = JSON.stringify({
            toolCalls: [
                { tool: "launch_application", arguments: { appName: "Chrome" } },
                { tool: "exec_shell_command", arguments: { cmd: "rm -rf /" } },
            ],
            explanation: "Open Chrome and execute raw command.",
        });
        const result = (0, claude_response_parser_1.parseClaudeResponse)(rawText, "open chrome and do evil");
        assert(result.success === true &&
            result.plan?.toolCalls.length === 1 &&
            result.plan?.toolCalls[0].tool === "launch_application", "A3. Unknown tool name ('exec_shell_command') rejected; known tool ('launch_application') retained");
    }
    // A4. Empty Claude response produces parse failure
    {
        const result = (0, claude_response_parser_1.parseClaudeResponse)("", "test");
        assert(result.success === false && Boolean(result.error?.includes("empty")), "A4. Empty response produces parse failure with descriptive error");
    }
    // A5. Non-JSON response produces parse failure
    {
        const result = (0, claude_response_parser_1.parseClaudeResponse)("Hello! I am Claude, how can I help you?", "hello");
        assert(result.success === false && Boolean(result.error?.includes("JSON")), "A5. Non-JSON prose response produces parse failure");
    }
    // A6. JSON missing toolCalls field rejected
    {
        const result = (0, claude_response_parser_1.parseClaudeResponse)(JSON.stringify({ text: "Hello" }), "test");
        assert(result.success === false && Boolean(result.error?.includes("toolCalls")), "A6. JSON missing 'toolCalls' array field rejected with descriptive error");
    }
    // ===========================================================================
    // SECTION B: ClaudeAIProvider (Fake HTTP / Config)
    // ===========================================================================
    console.log("\n--- Section B: ClaudeAIProvider ---\n");
    // Helper for intercepting global fetch for fake HTTP tests
    async function withFakeFetch(fakeFetch, testBody) {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = fakeFetch;
        const provider = new claude_ai_provider_1.ClaudeAIProvider({ apiKey: "sk-ant-api03-test-fake-key" });
        try {
            return await testBody(provider);
        }
        finally {
            globalThis.fetch = originalFetch;
        }
    }
    // B1. Missing API key returns unconfigured error response
    {
        const unconfigProvider = new claude_ai_provider_1.ClaudeAIProvider({ apiKey: "" });
        const res = await unconfigProvider.generatePlan({ userRequest: "Open VS Code" });
        assert(res.success === false && Boolean(res.error?.includes("missing")), "B1. Claude unconfigured (missing API key) → returns graceful error response");
    }
    // B2. Valid Claude REST API response produces correct AgentPlan
    {
        const mockClaudeResponseBody = JSON.stringify({
            id: "msg_012345",
            type: "message",
            role: "assistant",
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code" } }],
                        explanation: "Opening VS Code via Claude.",
                    }),
                },
            ],
            model: "claude-3-5-sonnet-20241022",
            stop_reason: "end_turn",
        });
        const res = await withFakeFetch(async () => new Response(mockClaudeResponseBody, { status: 200 }), async (provider) => provider.generatePlan({ userRequest: "Open VS Code" }));
        assert(res.success === true &&
            res.providerId === "claude" &&
            res.plan?.toolCalls[0].tool === "launch_application", "B2. Valid Claude REST response produces correct AgentPlan with providerId='claude'");
    }
    // B3. HTTP 500 error from Claude REST API
    {
        const res = await withFakeFetch(async () => new Response("Internal Server Error", { status: 500 }), async (provider) => provider.generatePlan({ userRequest: "Open VS Code" }));
        assert(res.success === false && Boolean(res.error?.includes("500")), "B3. HTTP 500 from Claude API → error response with HTTP status in message");
    }
    // B4. Malicious tool call in Claude output stripped safely
    {
        const maliciousBody = JSON.stringify({
            id: "msg_012345",
            type: "message",
            role: "assistant",
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        toolCalls: [
                            { tool: "launch_application", arguments: { appName: "Chrome" } },
                            { tool: "exec_os_command", arguments: { cmd: "del /f /s /q C:\\*" } },
                        ],
                        explanation: "Open Chrome and wipe disk.",
                    }),
                },
            ],
            model: "claude-3-5-sonnet-20241022",
        });
        const res = await withFakeFetch(async () => new Response(maliciousBody, { status: 200 }), async (provider) => provider.generatePlan({ userRequest: "open chrome and run delete" }));
        assert(res.success === true &&
            res.plan.toolCalls.length === 1 &&
            res.plan.toolCalls[0].tool === "launch_application", "B4. Security: Unknown/malicious tool name ('exec_os_command') stripped; known tool retained");
    }
    // ===========================================================================
    // SECTION C: ProviderRegistry & Fallback Integration
    // ===========================================================================
    console.log("\n--- Section C: ProviderRegistry & Fallback ---\n");
    // C1. All four providers registered
    assert(provider_registry_1.providerRegistry.hasProvider("mock") &&
        provider_registry_1.providerRegistry.hasProvider("ollama") &&
        provider_registry_1.providerRegistry.hasProvider("gemini") &&
        provider_registry_1.providerRegistry.hasProvider("claude"), "C1. All four providers ('mock', 'ollama', 'gemini', 'claude') are registered in ProviderRegistry");
    // C2. Unconfigured Claude safely resolves effective provider to 'mock'
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.setActiveProviderId("claude");
        const effective = provider_config_service_1.providerConfigService.resolveEffectiveProviderId();
        assert(effective === "mock", "C2. Claude missing API key → resolveEffectiveProviderId returns 'mock' fallback");
    }
    // C3. Configured Claude resolves effective provider to 'claude'
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-api03-test-key", enabled: true });
        provider_config_service_1.providerConfigService.setActiveProviderId("claude");
        const effective = provider_config_service_1.providerConfigService.resolveEffectiveProviderId();
        assert(effective === "claude", "C3. Claude configured with API key → resolveEffectiveProviderId returns 'claude'", `Effective: ${effective}`);
    }
    // ===========================================================================
    // SECTION D: Phase 3.2 Command Agent Regression
    // ===========================================================================
    console.log("\n--- Section D: Command Agent Regression ---\n");
    {
        provider_config_service_1.providerConfigService.reset();
        const action = await command_agent_service_1.commandAgentService.resolveCommand("Open VS Code");
        assert(action.success === true && action.target === "VS Code", "D1. Phase 3.2 natural language command agent remains 100% functional");
    }
    console.log("==========================================================================");
    console.log(`Claude Provider Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================");
    console.log("ℹ️  Real Claude API key NOT required for any of these tests.\n");
    if (failed > 0) {
        process.exit(1);
    }
}
runClaudeTests().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
});
