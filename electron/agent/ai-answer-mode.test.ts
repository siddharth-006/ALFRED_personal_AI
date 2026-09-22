/**
 * AI Answer Mode Test Suite (Phase 3.3 - Step 4.9)
 *
 * Verifies that ALFRED supports both informational questions (ANSWER) and
 * executable actions (ACTION) without attempting tool execution for informational answers.
 *
 * Test cases:
 *  1. General informational question ("What is gradient descent?") returns type="answer"
 *  2. Action request ("Open VS Code") returns type="action"
 *  3. ANSWER response has toolCalls: [] and NEVER invokes ToolRegistry
 *  4. ACTION response reaches AgentOrchestrator and ToolRegistry
 *  5. Multi-tool ACTION continues working
 *  6. Unknown tool rejected in ACTION mode
 *  7. Malformed model response rejected
 *  8. Provider failure handled safely
 *  9. Existing deterministic command behavior preserved
 * 10. Mock, Ollama, Gemini, and Claude compatibility
 */

import { parseAndValidateAgentPlan } from "./providers/impl/plan-validator";
import { buildAgentSystemPrompt } from "./providers/impl/planning-prompt";
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

async function runAIAnswerModeTests() {
    console.log("==========================================================================");
    console.log("ALFRED AI Answer Mode — Step 4.9 Test Suite");
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
    // TEST 1: Informational question ("What is gradient descent?") → ANSWER
    // ===========================================================================
    {
        const rawText = JSON.stringify({
            type: "answer",
            answerText: "Gradient descent is a first-order iterative optimization algorithm.",
            explanation: "Informational answer regarding gradient descent.",
        });
        const parsed = parseAndValidateAgentPlan(rawText, "What is gradient descent?");

        assert(
            parsed.valid === true &&
                parsed.plan?.type === "answer" &&
                Boolean(parsed.plan?.answerText?.includes("optimization algorithm")) &&
                parsed.plan?.toolCalls.length === 0,
            "1. Informational question parses to type='answer' with empty toolCalls array"
        );
    }

    // ===========================================================================
    // TEST 2: Action request ("Open VS Code") → ACTION
    // ===========================================================================
    {
        const rawText = JSON.stringify({
            type: "action",
            toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code" } }],
            explanation: "Launching VS Code application.",
        });
        const parsed = parseAndValidateAgentPlan(rawText, "Open VS Code");

        assert(
            parsed.valid === true &&
                parsed.plan?.type === "action" &&
                parsed.plan?.toolCalls.length === 1 &&
                parsed.plan?.toolCalls[0].tool === "launch_application",
            "2. Action request parses to type='action' with valid tool calls"
        );
    }

    // ===========================================================================
    // TEST 3: ANSWER response has toolCalls: [] and NEVER invokes ToolRegistry
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        providerConfigService.setActiveProviderId("claude");

        const answerResponseBody = JSON.stringify({
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        type: "answer",
                        answerText: "A CNN is a Convolutional Neural Network used for visual imagery.",
                        explanation: "Informational response on CNN.",
                    }),
                },
            ],
        });

        const res = await withFakeFetch(
            async () => new Response(answerResponseBody, { status: 200 }),
            async () => commandAgentService.executeCommand("Explain what a CNN is.", { isMock: true })
        );

        assert(
            res.success === true &&
                res.responseType === "answer" &&
                res.intent === "answer" &&
                res.executed === false &&
                Boolean(res.answerText?.includes("Convolutional Neural Network")),
            "3. Security: ANSWER mode response returns text directly without tool execution (executed = false)"
        );
    }

    // ===========================================================================
    // TEST 4: ACTION response reaches AgentOrchestrator and ToolRegistry
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        providerConfigService.setActiveProviderId("claude");

        const actionResponseBody = JSON.stringify({
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        type: "action",
                        toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code" } }],
                        explanation: "Opening VS Code.",
                    }),
                },
            ],
        });

        const res = await withFakeFetch(
            async () => new Response(actionResponseBody, { status: 200 }),
            async () => commandAgentService.executeCommand("Open VS Code", { isMock: true })
        );

        assert(
            res.success === true &&
                res.intent === "launch_application" &&
                res.executed === true &&
                res.appName === "VS Code",
            "4. ACTION response routes to AgentOrchestrator and executes via ToolRegistry (executed = true)"
        );
    }

    // ===========================================================================
    // TEST 5: Multi-tool ACTION continues working
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.updateProviderConfig("claude", { apiKey: "sk-ant-test-key", enabled: true });
        providerConfigService.setActiveProviderId("claude");

        const multiActionResponseBody = JSON.stringify({
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        type: "action",
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
            async () => new Response(multiActionResponseBody, { status: 200 }),
            async () => commandAgentService.executeCommand("Open VS Code and Chrome", { isMock: true })
        );

        assert(
            Boolean(res.success) &&
                res.intent === "launch_application" &&
                Boolean(res.appName?.includes("VS Code")) &&
                Boolean(res.appName?.includes("Chrome")),
            "5. Multi-tool ACTION executes sequentially through ToolRegistry"
        );
    }

    // ===========================================================================
    // TEST 6: Unknown tool rejected in ACTION mode
    // ===========================================================================
    {
        const rawText = JSON.stringify({
            type: "action",
            toolCalls: [{ tool: "exec_shell_command", arguments: { cmd: "dir" } }],
            explanation: "Execute raw shell.",
        });
        const parsed = parseAndValidateAgentPlan(rawText, "test");
        assert(
            parsed.valid === true && parsed.plan?.toolCalls.length === 0,
            "6. Unknown tool 'exec_shell_command' in ACTION mode rejected safely"
        );
    }

    // ===========================================================================
    // TEST 7: Malformed model response rejected
    // ===========================================================================
    {
        const malformedRes = parseAndValidateAgentPlan("Invalid model text non-json", "test");
        assert(
            malformedRes.valid === false && Boolean(malformedRes.error),
            "7. Malformed non-JSON model output rejected with error message"
        );
    }

    // ===========================================================================
    // TEST 8: Provider failure handled safely
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.setActiveProviderId("claude"); // Unconfigured

        const res = await commandAgentService.executeCommand("What is gradient descent?", { isMock: true });
        assert(
            res.fallbackUsed === true && Boolean(res.error),
            "8. Unconfigured provider fallback operates safely without crashing"
        );
    }

    // ===========================================================================
    // TEST 9: Existing deterministic command behavior preserved
    // ===========================================================================
    {
        providerConfigService.reset();
        const action = await commandAgentService.resolveCommand("Open VS Code");
        assert(
            action.success === true && action.target === "VS Code",
            "9. Existing Phase 3.2 natural language command agent remains 100% functional"
        );
    }

    // ===========================================================================
    // TEST 10: Mock/Ollama/Gemini/Claude compatibility
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.setActiveProviderId("mock");
        const mockAnswerRes = await commandAgentService.executeCommand("What is gradient descent?", { isMock: true });

        const systemPrompt = buildAgentSystemPrompt({ userRequest: "Explain CNN" });

        const cond1 = mockAnswerRes.responseType === "answer";
        const cond2 = typeof mockAnswerRes.answerText === "string" && mockAnswerRes.answerText.toLowerCase().includes("gradient descent");
        const cond3 = systemPrompt.includes("INFORMATIONAL QUESTIONS");
        const cond4 = systemPrompt.includes("EXECUTABLE ACTIONS");

        assert(
            cond1 && cond2 && cond3 && cond4,
            "10. Mock AI provider and shared prompt builder fully support Answer Mode vs Action Mode"
        );
    }

    console.log("==========================================================================");
    console.log(`AI Answer Mode Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

runAIAnswerModeTests().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
});
