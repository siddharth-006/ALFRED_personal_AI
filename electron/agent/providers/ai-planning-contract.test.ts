/**
 * AI Tool Selection & Intent Planning Test Suite (Phase 3.3 - Step 4.8)
 *
 * Tests the shared planning contract, prompt builder, validator, multi-tool ordering,
 * argument validation, and security boundaries across all AI providers.
 *
 * Test cases:
 *  1. Single-tool intent selection ("Open VS Code")
 *  2. Multi-tool intent ordering ("Open VS Code, then Chrome")
 *  3. Correct arguments mapping (e.g. appName: "VS Code", target: "missions")
 *  4. Unknown tool rejection ("exec_raw_command" rejected)
 *  5. Invalid argument / shell injection rejection ("appName; rm -rf /" rejected)
 *  6. Empty / malformed plan rejection
 *  7. Arbitrary command rejection
 *  8. Provider planning failure handling
 *  9. Existing fallback behavior
 * 10. Multi-provider compatibility (Ollama, Gemini, Claude, Mock)
 */

import { buildAgentSystemPrompt, ALFRED_TOOL_CATALOG } from "./impl/planning-prompt";
import { parseAndValidateAgentPlan, validateToolCall } from "./impl/plan-validator";
import { parseOllamaResponse } from "./impl/ollama-response-parser";
import { parseGeminiResponse } from "./impl/gemini-response-parser";
import { parseClaudeResponse } from "./impl/claude-response-parser";
import { providerConfigService } from "./config/provider-config.service";
import { providerRegistry } from "./provider-registry";
import { mockAIProvider } from "./impl/mock-ai-provider";
import { ollamaAIProvider } from "./impl/ollama-ai-provider";
import { geminiAIProvider } from "./impl/gemini-ai-provider";
import { claudeAIProvider } from "./impl/claude-ai-provider";
import { commandAgentService } from "../command-agent.service";

async function runAIPlanningTests() {
    console.log("==========================================================================");
    console.log("ALFRED AI Tool Selection & Intent Planning — Step 4.8 Test Suite");
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

    // ===========================================================================
    // TEST 1: Single-tool intent selection ("Open VS Code")
    // ===========================================================================
    {
        const rawText = JSON.stringify({
            toolCalls: [{ tool: "launch_application", arguments: { appName: "VS Code" } }],
            explanation: "Opening VS Code application.",
        });
        const res = parseAndValidateAgentPlan(rawText, "Open VS Code");
        assert(
            res.valid === true &&
                res.plan?.toolCalls.length === 1 &&
                res.plan?.toolCalls[0].tool === "launch_application" &&
                res.plan?.toolCalls[0].arguments.appName === "VS Code",
            "1. Single-tool intent ('launch_application' -> VS Code) successfully parsed"
        );
    }

    // ===========================================================================
    // TEST 2: Multi-tool intent ordering ("Open VS Code, then Chrome")
    // ===========================================================================
    {
        const rawText = JSON.stringify({
            toolCalls: [
                { tool: "launch_application", arguments: { appName: "VS Code" } },
                { tool: "launch_application", arguments: { appName: "Chrome" } },
                { tool: "navigate", arguments: { target: "dashboard" } },
            ],
            explanation: "Opening VS Code, Chrome, and navigating to dashboard.",
        });
        const res = parseAndValidateAgentPlan(rawText, "Open VS Code, then Chrome and go home");
        assert(
            res.valid === true &&
                res.plan?.toolCalls.length === 3 &&
                res.plan?.toolCalls[0].arguments.appName === "VS Code" &&
                res.plan?.toolCalls[1].arguments.appName === "Chrome" &&
                res.plan?.toolCalls[2].tool === "navigate",
            "2. Multi-tool plan preserves exact sequential tool call ordering (VS Code -> Chrome -> dashboard)"
        );
    }

    // ===========================================================================
    // TEST 3: Correct arguments mapping (appName, target, url, workspaceName)
    // ===========================================================================
    {
        const navRes = parseAndValidateAgentPlan(
            JSON.stringify({ toolCalls: [{ tool: "navigate", arguments: { target: "missions" } }] }),
            "Show missions"
        );
        const wsRes = parseAndValidateAgentPlan(
            JSON.stringify({ toolCalls: [{ tool: "launch_workspace", arguments: { workspaceName: "Coding" } }] }),
            "Launch Coding"
        );
        const urlRes = parseAndValidateAgentPlan(
            JSON.stringify({ toolCalls: [{ tool: "open_url", arguments: { url: "https://github.com" } }] }),
            "Open github"
        );

        assert(
            navRes.plan?.toolCalls[0].arguments.target === "missions" &&
                wsRes.plan?.toolCalls[0].arguments.workspaceName === "Coding" &&
                urlRes.plan?.toolCalls[0].arguments.url === "https://github.com",
            "3. Tool argument values strictly mapped (navigate: missions, workspace: Coding, url: https://github.com)"
        );
    }

    // ===========================================================================
    // TEST 4: Unknown tool rejection
    // ===========================================================================
    {
        const rawText = JSON.stringify({
            toolCalls: [
                { tool: "launch_application", arguments: { appName: "VS Code" } },
                { tool: "unregistered_custom_tool", arguments: { cmd: "whoami" } },
            ],
        });
        const res = parseAndValidateAgentPlan(rawText, "test");
        assert(
            res.valid === true &&
                res.plan?.toolCalls.length === 1 &&
                res.plan?.toolCalls[0].tool === "launch_application" &&
                res.rejectedCallsCount === 1,
            "4. Unknown tool 'unregistered_custom_tool' rejected; valid tool retained"
        );
    }

    // ===========================================================================
    // TEST 5: Invalid argument / shell injection rejection
    // ===========================================================================
    {
        const shellInj = validateToolCall({
            tool: "launch_application",
            arguments: { appName: "VS Code; rm -rf /" },
        });
        const pathTrav = validateToolCall({
            tool: "open_path",
            arguments: { path: "../../../etc/passwd" },
        });

        assert(
            shellInj === null && pathTrav === null,
            "5. Security: Shell metacharacter injection and path traversal parameters rejected"
        );
    }

    // ===========================================================================
    // TEST 6: Empty / malformed plan rejection
    // ===========================================================================
    {
        const emptyRes = parseAndValidateAgentPlan("", "test");
        const proseRes = parseAndValidateAgentPlan("I will open VS Code for you!", "test");
        const noCallsRes = parseAndValidateAgentPlan(JSON.stringify({ hello: "world" }), "test");

        assert(
            emptyRes.valid === false && proseRes.valid === false && noCallsRes.valid === false,
            "6. Empty output, plain text prose, and JSON missing 'toolCalls' are safely rejected"
        );
    }

    // ===========================================================================
    // TEST 7: Arbitrary command rejection
    // ===========================================================================
    {
        const rawCmdCall = validateToolCall({
            tool: "exec_shell_command",
            arguments: { command: "powershell -Command Get-Process" },
        });

        assert(
            rawCmdCall === null,
            "7. Security: Attempted arbitrary command execution ('exec_shell_command') completely rejected"
        );
    }

    // ===========================================================================
    // TEST 8: Provider planning failure handling
    // ===========================================================================
    {
        const failedResponse = parseOllamaResponse("Internal LLM Error", "Open VS Code");
        assert(
            failedResponse.success === false && Boolean(failedResponse.error),
            "8. Provider planning failure returns graceful error object without throwing exception"
        );
    }

    // ===========================================================================
    // TEST 9: Existing fallback behavior
    // ===========================================================================
    {
        providerConfigService.reset();
        providerConfigService.setActiveProviderId("claude"); // Unconfigured
        const execRes = await commandAgentService.executeCommand("Open VS Code", { isMock: true });
        assert(
            execRes.fallbackUsed === true && execRes.appName === "VS Code",
            "9. Unconfigured active provider ('claude') triggers safe fallback execution to deterministic rules"
        );
    }

    // ===========================================================================
    // TEST 10: Multi-provider compatibility (Ollama, Gemini, Claude, Mock)
    // ===========================================================================
    {
        const promptOllama = buildAgentSystemPrompt({ userRequest: "Open VS Code" });
        const parseGemini = parseGeminiResponse(
            JSON.stringify({ toolCalls: [{ tool: "launch_application", arguments: { appName: "Chrome" } }] }),
            "Open Chrome"
        );
        const parseClaude = parseClaudeResponse(
            JSON.stringify({ toolCalls: [{ tool: "system_status", arguments: {} }] }),
            "System status"
        );

        assert(
            Boolean(promptOllama.includes("ALFRED_TOOL_CATALOG") || promptOllama.includes("launch_application")) &&
                parseGemini.success === true &&
                parseClaude.success === true &&
                providerRegistry.hasProvider("mock") &&
                providerRegistry.hasProvider("ollama") &&
                providerRegistry.hasProvider("gemini") &&
                providerRegistry.hasProvider("claude"),
            "10. Multi-provider compatibility: All 4 providers share planning prompt builder and validator"
        );
    }

    console.log("==========================================================================");
    console.log(`AI Planning Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================\n");

    if (failed > 0) {
        process.exit(1);
    }
}

runAIPlanningTests().catch((err) => {
    console.error("Test execution error:", err);
    process.exit(1);
});
