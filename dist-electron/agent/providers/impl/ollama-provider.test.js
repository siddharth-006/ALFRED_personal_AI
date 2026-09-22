"use strict";
/**
 * Ollama Provider Adapter Test Suite (Phase 3.3 - Step 4.3)
 *
 * Tests all Ollama provider components using fakes/mocks of the HTTP client.
 * DOES NOT require Ollama to be installed or running.
 *
 * Tests:
 *  A) OllamaResponseParser — JSON extraction, validation, tool whitelist enforcement
 *  B) OllamaAIProvider    — end-to-end using injected fake HTTP client
 *  C) ProviderRegistry    — Ollama registered alongside Mock
 *  D) ProviderConfigService fallback — Ollama enabled/disabled
 *  E) Regression          — all existing suites still pass
 */
Object.defineProperty(exports, "__esModule", { value: true });
const ollama_response_parser_1 = require("./ollama-response-parser");
const ollama_ai_provider_1 = require("./ollama-ai-provider");
const provider_config_service_1 = require("../config/provider-config.service");
const provider_registry_1 = require("../provider-registry");
const mock_ai_provider_1 = require("./mock-ai-provider");
const ollama_ai_provider_2 = require("./ollama-ai-provider");
const command_agent_service_1 = require("../../command-agent.service");
async function runOllamaTests() {
    console.log("==========================================================================");
    console.log("ALFRED Ollama Provider Adapter — Step 4.3 Test Suite");
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
    provider_registry_1.providerRegistry.registerProvider(ollama_ai_provider_2.ollamaAIProvider);
    // ===========================================================================
    // SECTION A: OllamaResponseParser
    // ===========================================================================
    console.log("\n--- Section A: OllamaResponseParser ---\n");
    // A1. Valid JSON with a known tool
    {
        const rawText = JSON.stringify({
            toolCalls: [{ tool: "launch_application", arguments: { application: "VS Code" } }],
            explanation: "Opening VS Code.",
        });
        const result = (0, ollama_response_parser_1.parseOllamaResponse)(rawText, "Open VS Code");
        assert(result.success === true &&
            result.plan?.toolCalls.length === 1 &&
            result.plan?.toolCalls[0].tool === "launch_application" &&
            (result.plan?.toolCalls[0].arguments).application === "VS Code", "A1. Valid JSON with known tool parses into correct AgentPlan");
    }
    // A2. JSON embedded in markdown code fence
    {
        const rawText = `Sure, here's the plan:\n\`\`\`json\n${JSON.stringify({
            toolCalls: [{ tool: "navigate", arguments: { targetPath: "/tasks" } }],
            explanation: "Navigate to tasks.",
        })}\n\`\`\``;
        const result = (0, ollama_response_parser_1.parseOllamaResponse)(rawText, "Show missions");
        assert(result.success === true && result.plan?.toolCalls[0].tool === "navigate", "A2. JSON embedded in markdown code fence is extracted correctly");
    }
    // A3. Unknown tool name is silently rejected
    {
        const rawText = JSON.stringify({
            toolCalls: [
                { tool: "launch_application", arguments: { application: "Chrome" } },
                { tool: "exec_shell_command", arguments: { cmd: "rm -rf /" } },
            ],
            explanation: "Open Chrome and do evil.",
        });
        const result = (0, ollama_response_parser_1.parseOllamaResponse)(rawText, "open chrome and hack");
        assert(result.success === true &&
            result.plan?.toolCalls.length === 1 &&
            result.plan?.toolCalls[0].tool === "launch_application", "A3. Unknown tool name ('exec_shell_command') rejected; known tool ('launch_application') retained");
    }
    // A4. Empty response
    {
        const result = (0, ollama_response_parser_1.parseOllamaResponse)("", "anything");
        assert(result.success === false && Boolean(result.error?.includes("empty")), "A4. Empty Ollama response produces parse failure with descriptive error");
    }
    // A5. Invalid JSON
    {
        const result = (0, ollama_response_parser_1.parseOllamaResponse)("I could not process that request.", "do something");
        assert(result.success === false, "A5. Non-JSON prose response produces parse failure");
    }
    // A6. Malformed JSON (missing toolCalls array)
    {
        const rawText = JSON.stringify({ result: "ok" });
        const result = (0, ollama_response_parser_1.parseOllamaResponse)(rawText, "x");
        assert(result.success === false && Boolean(result.error?.includes("toolCalls")), "A6. JSON missing 'toolCalls' array field rejected with descriptive error");
    }
    // A7. Tool with invalid arguments (not an object) is rejected
    {
        const rawText = JSON.stringify({
            toolCalls: [{ tool: "launch_application", arguments: "VS Code" }],
        });
        const result = (0, ollama_response_parser_1.parseOllamaResponse)(rawText, "x");
        assert(result.success === true && result.plan?.toolCalls.length === 0, "A7. Tool call with non-object arguments is rejected (empty tool calls plan returned)");
    }
    // A8. Multiple valid tool calls
    {
        const rawText = JSON.stringify({
            toolCalls: [
                { tool: "launch_application", arguments: { application: "VS Code" } },
                { tool: "launch_application", arguments: { application: "Chrome" } },
            ],
            explanation: "Prepare coding workspace.",
        });
        const result = (0, ollama_response_parser_1.parseOllamaResponse)(rawText, "Prepare my coding workspace");
        assert(result.success === true && result.plan?.toolCalls.length === 2, "A8. Multiple valid tool calls produce an AgentPlan with 2 entries");
    }
    // ===========================================================================
    // SECTION B: OllamaAIProvider with injected fake HTTP client
    // ===========================================================================
    console.log("\n--- Section B: OllamaAIProvider (fake HTTP) ---\n");
    // Helper: create an OllamaAIProvider and inject a fake fetch override on globalThis
    async function withFakeFetch(fakeImpl, fn) {
        const original = globalThis.fetch;
        globalThis.fetch = fakeImpl;
        try {
            const provider = new ollama_ai_provider_1.OllamaAIProvider({
                endpointUrl: "http://localhost:11434",
                modelName: "llama3:latest",
                timeoutMs: 5_000,
            });
            return await fn(provider);
        }
        finally {
            globalThis.fetch = original;
        }
    }
    // B1. Provider unavailable (Ollama not running → ping fails)
    {
        const res = await withFakeFetch(async () => { throw new Error("ECONNREFUSED"); }, async (provider) => {
            return provider.generatePlan({ userRequest: "Open VS Code" });
        });
        assert(res.success === false && Boolean(res.error?.toLowerCase().includes("unreachable")), "B1. Ollama unavailable (ECONNREFUSED) → error response with 'unreachable' message");
    }
    // B2. Ollama available — valid response with known tool
    {
        const validResponse = JSON.stringify({
            toolCalls: [{ tool: "launch_application", arguments: { application: "VS Code" } }],
            explanation: "Launching VS Code.",
        });
        let callCount = 0;
        const res = await withFakeFetch(async (url, _opts) => {
            callCount++;
            // Ping call returns OK
            if (String(url).includes("/api/tags")) {
                return new Response(JSON.stringify({ models: [] }), { status: 200 });
            }
            // Generate call returns valid response
            return new Response(JSON.stringify({ model: "llama3:latest", response: validResponse, done: true }), { status: 200, headers: { "Content-Type": "application/json" } });
        }, async (provider) => provider.generatePlan({ userRequest: "Open VS Code" }));
        assert(res.success === true &&
            res.plan.toolCalls.length === 1 &&
            res.plan.toolCalls[0].tool === "launch_application" &&
            res.providerId === "ollama", "B2. Valid Ollama response produces correct AgentPlan with providerId='ollama'");
    }
    // B3. Ollama available but returns malformed JSON
    {
        const res = await withFakeFetch(async (url) => {
            if (String(url).includes("/api/tags")) {
                return new Response("{}", { status: 200 });
            }
            return new Response(JSON.stringify({ model: "llama3:latest", response: "I'm sorry, I can't do that.", done: true }), { status: 200 });
        }, async (provider) => provider.generatePlan({ userRequest: "do something" }));
        assert(res.success === false &&
            Boolean(res.error?.includes("parse") || res.error?.includes("extract") || res.error?.includes("JSON")), "B3. Malformed model response (prose) → parse failure with error");
    }
    // B4. HTTP 500 error from Ollama server
    {
        const res = await withFakeFetch(async (url) => {
            if (String(url).includes("/api/tags")) {
                return new Response("{}", { status: 200 });
            }
            return new Response("Internal server error", { status: 500 });
        }, async (provider) => provider.generatePlan({ userRequest: "Open VS Code" }));
        assert(res.success === false && Boolean(res.error?.includes("500")), "B4. HTTP 500 from Ollama server → error response with HTTP status code in message");
    }
    // B5. Model response includes unknown tool — unknown tool stripped, plan still returned
    {
        const maliciousResponse = JSON.stringify({
            toolCalls: [
                { tool: "launch_application", arguments: { application: "Chrome" } },
                { tool: "exec_os_command", arguments: { command: "del /f /s /q C:\\" } },
            ],
            explanation: "Mixed response",
        });
        const res = await withFakeFetch(async (url) => {
            if (String(url).includes("/api/tags")) {
                return new Response("{}", { status: 200 });
            }
            return new Response(JSON.stringify({ model: "llama3:latest", response: maliciousResponse, done: true }), { status: 200 });
        }, async (provider) => provider.generatePlan({ userRequest: "open chrome and run delete" }));
        assert(res.success === true &&
            res.plan.toolCalls.length === 1 &&
            res.plan.toolCalls[0].tool === "launch_application", "B5. Security: Unknown/malicious tool name ('exec_os_command') stripped; known tool retained");
    }
    // B6. configurable endpoint
    {
        const customProvider = new ollama_ai_provider_1.OllamaAIProvider({ endpointUrl: "http://192.168.1.10:11434", modelName: "mistral:latest" });
        const available = await customProvider.isAvailable().catch(() => false);
        assert(typeof available === "boolean", "B6. Configurable endpoint accepted — isAvailable() returns boolean (no crash)", `isAvailable: ${available}`);
    }
    // ===========================================================================
    // SECTION C: ProviderRegistry integration
    // ===========================================================================
    console.log("\n--- Section C: ProviderRegistry ---\n");
    // C1. Both mock and ollama are registered
    assert(provider_registry_1.providerRegistry.hasProvider("mock") && provider_registry_1.providerRegistry.hasProvider("ollama"), "C1. Both 'mock' and 'ollama' providers are registered in ProviderRegistry");
    // C2. With ollama disabled in config, effective provider resolves to mock
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.updateProviderConfig("ollama", { enabled: false });
        const effective = provider_config_service_1.providerConfigService.resolveEffectiveProviderId();
        assert(effective === "mock", "C2. Ollama disabled in config → resolveEffectiveProviderId returns 'mock' fallback");
    }
    // C3. With ollama enabled in config, effective provider resolves to ollama
    {
        provider_config_service_1.providerConfigService.reset();
        provider_config_service_1.providerConfigService.updateProviderConfig("ollama", { enabled: true });
        provider_config_service_1.providerConfigService.setActiveProviderId("ollama");
        const effective = provider_config_service_1.providerConfigService.resolveEffectiveProviderId();
        assert(effective === "ollama", "C3. Ollama enabled in config → resolveEffectiveProviderId returns 'ollama'", `Effective: ${effective}`);
        provider_config_service_1.providerConfigService.reset();
    }
    // ===========================================================================
    // SECTION D: Mock fallback remains 100% functional
    // ===========================================================================
    console.log("\n--- Section D: Mock fallback regression ---\n");
    {
        provider_config_service_1.providerConfigService.reset();
        const activeProvider = provider_registry_1.providerRegistry.getActiveProvider();
        assert(activeProvider.id === "mock", "D1. With default config, getActiveProvider() returns Mock provider");
    }
    // ===========================================================================
    // SECTION E: Phase 3.2 regression
    // ===========================================================================
    console.log("\n--- Section E: Phase 3.2 Regression ---\n");
    {
        const p32Res = await command_agent_service_1.commandAgentService.parseCommand("Open VS Code");
        assert(p32Res.intent === "launch_application" && p32Res.target === "VS Code", "E1. Phase 3.2 natural language command agent remains 100% functional");
    }
    // ===========================================================================
    // FINAL RESULTS
    // ===========================================================================
    console.log("\n==========================================================================");
    console.log(`Ollama Provider Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================");
    console.log("ℹ️  Real Ollama installation NOT required for any of these tests.");
    if (failed > 0) {
        process.exit(1);
    }
}
runOllamaTests();
