/**
 * Unified AI Command Execution Test Suite (Phase 3.3 - Step 4.7)
 *
 * Verifies that CommandAgentService handles unified AI command execution
 * across Mock, Ollama, Gemini, and Claude providers without duplicated provider-specific logic.
 *
 * Test cases:
 *  1. Mock provider execution (Rule-based / Mock fallback)
 *  2. Ollama provider pipeline (fake HTTP)
 *  3. Gemini provider pipeline (fake HTTP)
 *  4. Claude provider pipeline (fake HTTP)
 *  5. Single-tool command execution
 *  6. Multi-tool command execution ("Open VS Code and Chrome")
 *  7. Unknown tool rejection
 *  8. Malformed plan rejection
 *  9. Provider unavailable fallback
 * 10. Existing rule-based command behavior
 * 11. ToolRegistry remains the execution authority
 */

import { commandAgentService } from "./command-agent.service";
import { providerConfigService } from "./providers/config/provider-config.service";
import { providerRegistry } from "./providers/provider-registry";
import { mockAIProvider } from "./providers/impl/mock-ai-provider";
import { ollamaAIProvider } from "./providers/impl/ollama-ai-provider";
import { geminiAIProvider } from "./providers/impl/gemini-ai-provider";
import { claudeAIProvider } from "./providers/impl/claude-ai-provider";
import { toolRegistry } from "./tools/tool-registry";
import { registerDefaultTools } from "./tools/index";
import "./providers/index";

async function runUnifiedCommandTests() {
    console.log("==========================================================================");
    console.log("ALFRED Unified AI Command Execution — Step 4.7 Test Suite");
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

    // Reset environment
    providerConfigService.reset();
    providerRegistry.clear();
    providerRegistry.registerProvider(mockAIProvider);
    providerRegistry.registerProvider(ollamaAIProvider);
    providerRegistry.registerProvider(geminiAIProvider);
    providerRegistry.registerProvider(claudeAIProvider);
    registerDefaultTools();

    // Helper for fake fetch interception
    async function withFakeFetch<T>(
        fakeFetch: (url: string | URL | Request, init?: RequestInit) => Promise<Response>,
        testBody: () => Promise<T>
    ): Promise<T> {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = fakeFetch as typeof globalThis.fetch;
        try {
            return await testBody();
        } finally {
            globalThis.fetch = originalFetch;
        }
    }

    // ===========================================================================
    // TEST 1: Mock provider execution
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.setActiveProviderId("mock");
        const res = await commandAgentService.executeCommand("Open VS Code", { isMock: true });
        assert(
            res.success === true && res.appName === "VS Code" && res.providerId === "mock",
            "1. Mock provider execution routes successfully via fallback command"
        );
    }

    // ===========================================================================
    // TEST 2: Ollama provider pipeline (fake HTTP)
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.updateProviderConfig("ollama", { enabled: true });
        providerConfigService.setActiveProviderId("ollama");

        const ollamaResponseBody = JSON.stringify({
            model: "llama3:latest",
            response: JSON.stringify({
                toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code" } }],
                explanation: "Opening VS Code via Ollama.",
            }),
            done: true,
        });

        const res = await withFakeFetch(
            async () => new Response(ollamaResponseBody, { status: 200 }),
            async () => commandAgentService.executeCommand("Open VS Code", { isMock: true })
        );

        assert(
            res.success === true && res.providerId === "ollama" && res.appName === "VS Code",
            "2. Ollama provider pipeline routes prompt through AgentOrchestrator to ToolRegistry"
        );
    }

    // ===========================================================================
    // TEST 3: Gemini provider pipeline (fake HTTP)
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.updateProviderConfig("gemini", { apiKey: "TEST_GEMINI_API_KEY", enabled: true });
        providerConfigService.setActiveProviderId("gemini");

        const geminiResponseBody = JSON.stringify({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                text: JSON.stringify({
                                    toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code" } }],
                                    explanation: "Opening VS Code via Gemini.",
                                }),
                            },
                        ],
                    },
                },
            ],
        });

        const res = await withFakeFetch(
            async () => new Response(geminiResponseBody, { status: 200 }),
            async () => commandAgentService.executeCommand("Open VS Code", { isMock: true })
        );

        assert(
            res.success === true && res.providerId === "gemini" && res.appName === "VS Code",
            "3. Gemini provider pipeline routes prompt through AgentOrchestrator to ToolRegistry"
        );
    }

    // ===========================================================================
    // TEST 4: Claude provider pipeline (fake HTTP)
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        providerConfigService.setActiveProviderId("claude");

        const claudeResponseBody = JSON.stringify({
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
        });

        const res = await withFakeFetch(
            async () => new Response(claudeResponseBody, { status: 200 }),
            async () => commandAgentService.executeCommand("Open VS Code", { isMock: true })
        );

        assert(
            res.success === true && res.providerId === "claude" && res.appName === "VS Code",
            "4. Claude provider pipeline routes prompt through AgentOrchestrator to ToolRegistry"
        );
    }

    // ===========================================================================
    // TEST 5: Single-tool command execution
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        providerConfigService.setActiveProviderId("claude");

        const responseBody = JSON.stringify({
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        toolCalls: [{ tool: "navigate", arguments: { target: "missions" } }],
                        explanation: "Navigating to missions.",
                    }),
                },
            ],
        });

        const res = await withFakeFetch(
            async () => new Response(responseBody, { status: 200 }),
            async () => commandAgentService.executeCommand("Open missions", { isMock: true })
        );

        assert(
            res.success === true && res.intent === "navigate",
            "5. Single-tool command execution ('navigate') returns correct intent"
        );
    }

    // ===========================================================================
    // TEST 6: Multi-tool command execution ("Open VS Code and Chrome")
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        providerConfigService.setActiveProviderId("claude");

        const multiToolResponse = JSON.stringify({
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        toolCalls: [
                            { tool: "launch_application", arguments: { appName: "VS Code" } },
                            { tool: "launch_application", arguments: { appName: "Chrome" } },
                        ],
                        explanation: "Opening VS Code and Chrome.",
                    }),
                },
            ],
        });

        const res = await withFakeFetch(
            async () => new Response(multiToolResponse, { status: 200 }),
            async () => commandAgentService.executeCommand("Open VS Code and Chrome", { isMock: true })
        );

        assert(
            Boolean(
                res.success === true &&
                res.intent === "launch_application" &&
                res.appName?.includes("VS Code") &&
                res.appName?.includes("Chrome")
            ),
            "6. Multi-tool plan ('Open VS Code and Chrome') executes both tools via ToolRegistry",
            `AppNames aggregated: ${res.appName}`
        );
    }

    // ===========================================================================
    // TEST 7: Unknown tool rejection
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        providerConfigService.setActiveProviderId("claude");

        const unknownToolResponse = JSON.stringify({
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        toolCalls: [{ tool: "exec_raw_shell", arguments: { cmd: "rm -rf /" } }],
                        explanation: "Attempt evil shell execution.",
                    }),
                },
            ],
        });

        const res = await withFakeFetch(
            async () => new Response(unknownToolResponse, { status: 200 }),
            async () => commandAgentService.executeCommand("Do evil", { isMock: true })
        );

        assert(
            res.fallbackUsed === true || res.success === false || res.appName === null,
            "7. Unknown tool ('exec_raw_shell') rejected; fallback executed safely"
        );
    }

    // ===========================================================================
    // TEST 8: Malformed plan rejection
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        providerConfigService.setActiveProviderId("claude");

        const malformedResponse = JSON.stringify({
            content: [
                {
                    type: "text",
                    text: "I cannot give you JSON output today.",
                },
            ],
        });

        const res = await withFakeFetch(
            async () => new Response(malformedResponse, { status: 200 }),
            async () => commandAgentService.executeCommand("Open VS Code", { isMock: true })
        );

        assert(
            res.fallbackUsed === true && res.success === true && res.appName === "VS Code",
            "8. Malformed plan output from provider triggers deterministic fallback execution without crashing"
        );
    }

    // ===========================================================================
    // TEST 9: Provider unavailable fallback
    // ===========================================================================
    {
        providerConfigService.reset();
        // Unconfigured Claude provider (no API key)
        providerConfigService.setActiveProviderId("claude");

        const res = await commandAgentService.executeCommand("Open VS Code", { isMock: true });

        assert(
            res.fallbackUsed === true && res.providerId === "claude" && res.appName === "VS Code",
            "9. Unconfigured/unavailable provider triggers safe fallback execution to Mock/Rule engine"
        );
    }

    // ===========================================================================
    // TEST 10: Existing rule-based command behavior
    // ===========================================================================
    {
        providerConfigService.reset();
        const action = await commandAgentService.resolveCommand("Open VS Code");
        assert(
            action.success === true && action.target === "VS Code",
            "10. Existing Phase 3.2 natural language command agent remains 100% functional"
        );
    }

    // ===========================================================================
    // TEST 11: ToolRegistry remains the execution authority
    // ===========================================================================
    {
        assert(
            toolRegistry.has("launch_application") && toolRegistry.has("navigate"),
            "11. ToolRegistry remains single execution authority holding all registered tools"
        );
    }

    console.log("==========================================================================");
    console.log(`Unified AI Command Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

runUnifiedCommandTests().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
});
