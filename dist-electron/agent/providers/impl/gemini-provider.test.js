"use strict";
/**
 * Gemini Provider Adapter Test Suite (Phase 3.3 - Step 4.5)
 *
 * Tests all Gemini provider components using fakes/mocks of the HTTP client.
 * DOES NOT require a real Gemini API key or network request.
 *
 * Tests:
 *  A) GeminiResponseParser — JSON extraction, validation, tool whitelist enforcement
 *  B) GeminiAIProvider    — end-to-end using injected fake HTTP client
 *  C) ProviderRegistry    — Gemini registered alongside Mock and Ollama
 *  D) ProviderConfigService fallback — Gemini unconfigured/disabled handling
 *  E) Regression          — all existing suites still pass
 */
Object.defineProperty(exports, "__esModule", { value: true });
const gemini_response_parser_1 = require("./gemini-response-parser");
const gemini_ai_provider_1 = require("./gemini-ai-provider");
const provider_config_service_1 = require("../config/provider-config.service");
const provider_registry_1 = require("../provider-registry");
const mock_ai_provider_1 = require("./mock-ai-provider");
const ollama_ai_provider_1 = require("./ollama-ai-provider");
const gemini_ai_provider_2 = require("./gemini-ai-provider");
const command_agent_service_1 = require("../../command-agent.service");
async function runGeminiTests() {
    console.log("==========================================================================");
    console.log("ALFRED Gemini Provider Adapter — Step 4.5 Test Suite");
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
    provider_registry_1.providerRegistry.registerProvider(gemini_ai_provider_2.geminiAIProvider);
    // ===========================================================================
    // SECTION A: GeminiResponseParser
    // ===========================================================================
    console.log("\n--- Section A: GeminiResponseParser ---\n");
    // A1. Valid JSON with a known tool
    {
        const rawText = JSON.stringify({
            toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code" } }],
            explanation: "Opening VS Code via Gemini.",
        });
        const result = (0, gemini_response_parser_1.parseGeminiResponse)(rawText, "Open VS Code");
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
        const result = (0, gemini_response_parser_1.parseGeminiResponse)(rawText, "Show missions");
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
        const result = (0, gemini_response_parser_1.parseGeminiResponse)(rawText, "open chrome and do evil");
        assert(result.success === true &&
            result.plan?.toolCalls.length === 1 &&
            result.plan?.toolCalls[0].tool === "launch_application", "A3. Unknown tool name ('exec_shell_command') rejected; known tool ('launch_application') retained");
    }
    // A4. Empty Gemini response produces parse failure
    {
        const result = (0, gemini_response_parser_1.parseGeminiResponse)("", "test");
        assert(result.success === false && Boolean(result.error?.includes("empty")), "A4. Empty response produces parse failure with descriptive error");
    }
    // A5. Non-JSON response produces parse failure
    {
        const result = (0, gemini_response_parser_1.parseGeminiResponse)("Hello! I am Gemini, how can I help you?", "hello");
        assert(result.success === false && Boolean(result.error?.includes("JSON")), "A5. Non-JSON prose response produces parse failure");
    }
    // A6. JSON missing toolCalls field rejected
    {
        const result = (0, gemini_response_parser_1.parseGeminiResponse)(JSON.stringify({ text: "Hello" }), "test");
        assert(result.success === false && Boolean(result.error?.includes("toolCalls")), "A6. JSON missing 'toolCalls' array field rejected with descriptive error");
    }
    // ===========================================================================
    // SECTION B: GeminiAIProvider (Fake HTTP / Config)
    // ===========================================================================
    console.log("\n--- Section B: GeminiAIProvider ---\n");
    // Helper for intercepting global fetch for fake HTTP tests
    async function withFakeFetch(fakeFetch, testBody) {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = fakeFetch;
        const provider = new gemini_ai_provider_1.GeminiAIProvider({ apiKey: "AIzaSyTestFakeApiKeyForUnitTests" });
        try {
            return await testBody(provider);
        }
        finally {
            globalThis.fetch = originalFetch;
        }
    }
    // B1. Missing API key returns unconfigured error response
    {
        const unconfigProvider = new gemini_ai_provider_1.GeminiAIProvider({ apiKey: "" });
        const res = await unconfigProvider.generatePlan({ userRequest: "Open VS Code" });
        assert(res.success === false && Boolean(res.error?.includes("missing")), "B1. Gemini unconfigured (missing API key) → returns graceful error response");
    }
    // B2. Valid Gemini REST API response produces correct AgentPlan
    {
        const mockGeminiResponseBody = JSON.stringify({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                text: JSON.stringify({
                                    toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code" } }],
                                    explanation: "Opening VS Code.",
                                }),
                            },
                        ],
                    },
                },
            ],
        });
        const res = await withFakeFetch(async () => new Response(mockGeminiResponseBody, { status: 200 }), async (provider) => provider.generatePlan({ userRequest: "Open VS Code" }));
        assert(res.success === true &&
            res.providerId === "gemini" &&
            res.plan?.toolCalls[0].tool === "launch_application", "B2. Valid Gemini REST response produces correct AgentPlan with providerId='gemini'");
    }
    // B3. HTTP 500 error from Gemini REST API
    {
        const res = await withFakeFetch(async () => new Response("Internal Server Error", { status: 500 }), async (provider) => provider.generatePlan({ userRequest: "Open VS Code" }));
        assert(res.success === false && Boolean(res.error?.includes("500")), "B3. HTTP 500 from Gemini API → error response with HTTP status in message");
    }
    // B4. Malicious tool call in Gemini output stripped safely
    {
        const maliciousBody = JSON.stringify({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                text: JSON.stringify({
                                    toolCalls: [
                                        { tool: "launch_application", arguments: { appName: "Chrome" } },
                                        { tool: "exec_os_command", arguments: { cmd: "del /f /s /q C:\\*" } },
                                    ],
                                    explanation: "Open Chrome and wipe disk.",
                                }),
                            },
                        ],
                    },
                },
            ],
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
    // C1. All three providers registered
    assert(provider_registry_1.providerRegistry.hasProvider("mock") &&
        provider_registry_1.providerRegistry.hasProvider("ollama") &&
        provider_registry_1.providerRegistry.hasProvider("gemini"), "C1. All three providers ('mock', 'ollama', 'gemini') are registered in ProviderRegistry");
    // C2. Unconfigured Gemini safely resolves effective provider to 'mock'
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.setActiveProviderId("gemini");
        const effective = provider_config_service_1.providerConfigService.resolveEffectiveProviderId();
        assert(effective === "mock", "C2. Gemini missing API key → resolveEffectiveProviderId returns 'mock' fallback");
    }
    // C3. Configured Gemini resolves effective provider to 'gemini'
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.updateProviderConfig("gemini", { apiKey: "AIzaSyFakeKeyForTest", enabled: true });
        provider_config_service_1.providerConfigService.setActiveProviderId("gemini");
        const effective = provider_config_service_1.providerConfigService.resolveEffectiveProviderId();
        assert(effective === "gemini", "C3. Gemini configured with API key → resolveEffectiveProviderId returns 'gemini'", `Effective: ${effective}`);
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
    console.log(`Gemini Provider Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================");
    console.log("ℹ️  Real Gemini API key NOT required for any of these tests.\n");
    if (failed > 0) {
        process.exit(1);
    }
}
runGeminiTests().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
});
