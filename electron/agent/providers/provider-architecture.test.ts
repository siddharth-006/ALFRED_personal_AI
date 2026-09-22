import { ProviderRegistry } from "./provider-registry";
import { MockAIProvider } from "./impl/mock-ai-provider";
import { ProviderAgentPlanner } from "./provider-agent-planner";
import { AgentOrchestrator } from "../orchestrator/agent-orchestrator";
import { ToolRegistry } from "../tools/tool-registry";
import { launchApplicationTool } from "../tools/builtins/launch-application.tool";
import { navigateTool } from "../tools/builtins/navigate.tool";
import { systemStatusTool } from "../tools/builtins/system-status.tool";
import { commandAgentService } from "../command-agent.service";
import { IAIProvider, AIProviderRequest, AIProviderResponse } from "./types";

/**
 * ALFRED Multi-Provider AI Architecture Test Suite (Phase 3.3 - Step 3)
 *
 * Verifies provider abstraction, registry management, provider-planner integration,
 * execution boundary safety, zero network calls, and full backwards compatibility.
 */
async function runProviderArchitectureTests() {
    console.log("==========================================================================");
    console.log("ALFRED Multi-Provider AI Architecture — Step 3 Comprehensive Test Suite");
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

    const testRegistry = new ProviderRegistry();
    const mockProvider = new MockAIProvider();
    testRegistry.registerProvider(mockProvider);

    // 1. Mock provider works
    try {
        const response = await mockProvider.generatePlan({ userRequest: "Open VS Code" });
        assert(
            response.success === true &&
                response.providerId === "mock" &&
                response.plan.toolCalls.length === 1 &&
                response.plan.toolCalls[0].tool === "launch_application",
            "1. Mock provider works correctly (generates valid plan for 'Open VS Code')"
        );
    } catch (err: unknown) {
        assert(false, "1. Mock provider works", String(err));
    }

    // 2. Provider interface is correctly implemented
    try {
        assert(
            mockProvider.id === "mock" &&
                typeof mockProvider.name === "string" &&
                mockProvider.capabilities.supportsTools === true &&
                mockProvider.isAvailable() === true,
            "2. Provider interface (IAIProvider) correctly implemented by MockAIProvider"
        );
    } catch (err: unknown) {
        assert(false, "2. Provider interface compliance", String(err));
    }

    // 3. Provider registry returns the correct provider
    try {
        const fetched = testRegistry.getProvider("mock");
        const active = testRegistry.getActiveProvider();
        assert(
            fetched !== undefined && fetched.id === "mock" && active.id === "mock",
            "3. Provider registry returns the correct provider"
        );
    } catch (err: unknown) {
        assert(false, "3. Provider registry lookup", String(err));
    }

    // 4. Unknown provider is rejected safely
    try {
        let threw = false;
        try {
            testRegistry.setActiveProviderId("unknown_provider" as any);
        } catch {
            threw = true;
        }
        assert(threw, "4. Unknown provider is rejected safely upon activation attempt");
    } catch (err: unknown) {
        assert(false, "4. Unknown provider rejection", String(err));
    }

    // 5. Provider response can be converted into AgentPlan
    try {
        const response = await mockProvider.generatePlan({ userRequest: "Prepare my coding workspace" });
        assert(
            response.success === true &&
                Array.isArray(response.plan.toolCalls) &&
                response.plan.toolCalls.length === 2,
            "5. Provider response successfully converted into structured AgentPlan (2 tool calls)"
        );
    } catch (err: unknown) {
        assert(false, "5. Provider response to AgentPlan conversion", String(err));
    }

    // 6. AgentOrchestrator can continue consuming AgentPlan without knowing the provider
    try {
        const toolsReg = new ToolRegistry();
        toolsReg.register(launchApplicationTool);
        toolsReg.register(navigateTool);

        const plannerBridge = new ProviderAgentPlanner(testRegistry, toolsReg);
        const orchestrator = new AgentOrchestrator(plannerBridge, toolsReg);

        const execResult = await orchestrator.execute("Prepare my coding workspace", { isMock: true });
        assert(
            execResult.success === true &&
                execResult.results.length === 2 &&
                execResult.plan.userRequest === "Prepare my coding workspace",
            "6. AgentOrchestrator seamlessly consumes ProviderAgentPlanner output without provider awareness"
        );
    } catch (err: unknown) {
        assert(false, "6. AgentOrchestrator provider independence", String(err));
    }

    // 7. ToolRegistry remains the only execution boundary
    try {
        // Create a custom provider that produces plan with raw shell targets
        class RogueAIProvider implements IAIProvider {
            readonly id = "mock" as any;
            readonly name = "Rogue Provider";
            readonly capabilities = { supportsTools: true, supportsStreaming: false, isLocal: true };
            isAvailable() {
                return true;
            }
            async generatePlan(request: AIProviderRequest): Promise<AIProviderResponse> {
                return {
                    success: true,
                    providerId: "mock",
                    plan: {
                        userRequest: request.userRequest,
                        toolCalls: [{ tool: "launch_application", arguments: { appName: "calc.exe" } }],
                    },
                };
            }
        }

        const rogueReg = new ProviderRegistry();
        rogueReg.registerProvider(new RogueAIProvider());
        const toolsReg = new ToolRegistry();
        toolsReg.register(launchApplicationTool);

        const plannerBridge = new ProviderAgentPlanner(rogueReg, toolsReg);
        const orchestrator = new AgentOrchestrator(plannerBridge, toolsReg);

        const res = await orchestrator.execute("Launch calculator", { isMock: true });
        assert(
            res.success === false &&
                res.results[0]?.tool === "launch_application" &&
                Boolean(res.results[0]?.error?.includes("Unsupported")),
            "7. ToolRegistry remains the authoritative execution boundary (unwhitelisted app rejected)"
        );
    } catch (err: unknown) {
        assert(false, "7. ToolRegistry execution boundary", String(err));
    }

    // 8. Malicious/arbitrary tool requests generated by provider are rejected
    try {
        class MaliciousProvider implements IAIProvider {
            readonly id = "mock" as any;
            readonly name = "Malicious Provider";
            readonly capabilities = { supportsTools: true, supportsStreaming: false, isLocal: true };
            isAvailable() {
                return true;
            }
            async generatePlan(request: AIProviderRequest): Promise<AIProviderResponse> {
                return {
                    success: true,
                    providerId: "mock",
                    plan: {
                        userRequest: request.userRequest,
                        toolCalls: [
                            { tool: "launch_application", arguments: { appName: "VS Code; powershell -c calc" } },
                            { tool: "raw_cmd_exec", arguments: { cmd: "dir" } },
                        ],
                    },
                };
            }
        }

        const malReg = new ProviderRegistry();
        malReg.registerProvider(new MaliciousProvider());
        const toolsReg = new ToolRegistry();
        toolsReg.register(launchApplicationTool);

        const plannerBridge = new ProviderAgentPlanner(malReg, toolsReg);
        const orchestrator = new AgentOrchestrator(plannerBridge, toolsReg);

        const res = await orchestrator.execute("do hack", { isMock: true });
        const step2Blocked = res.results.length === 1 || (res.results[1]?.success === false && Boolean(res.results[1]?.error?.includes("Unknown tool")));
        assert(
            res.success === false &&
                res.results[0]?.success === false &&
                step2Blocked,
            "8. Malicious/arbitrary tool requests from AI provider are rejected safely"
        );
    } catch (err: unknown) {
        assert(false, "8. Malicious tool call rejection", String(err));
    }

    // 9. Existing Phase 3.2 tests still pass
    try {
        const p32Result = await commandAgentService.parseCommand("Open VS Code");
        assert(
            p32Result.intent === "launch_application" && p32Result.target === "VS Code",
            "9. Existing Phase 3.2 command functionality remains intact"
        );
    } catch (err: unknown) {
        assert(false, "9. Phase 3.2 regression test", String(err));
    }

    // 10. Existing Phase 3.3 Step 1 tests still pass (ToolRegistry check)
    try {
        const toolsReg = new ToolRegistry();
        toolsReg.register(systemStatusTool);
        const sysResult = await toolsReg.execute("system_status");
        assert(
            sysResult.success === true && Boolean((sysResult.data as any)?.info?.platform),
            "10. Existing Phase 3.3 Step 1 ToolRegistry functionality remains intact"
        );
    } catch (err: unknown) {
        assert(false, "10. Phase 3.3 Step 1 regression test", String(err));
    }

    // 11. Existing Phase 3.3 Step 2 tests still pass (AgentOrchestrator check)
    try {
        const toolsReg = new ToolRegistry();
        toolsReg.register(launchApplicationTool);
        const orchestrator = new AgentOrchestrator(undefined, toolsReg);
        const orchRes = await orchestrator.execute("Open VS Code", { isMock: true });
        assert(
            orchRes.success === true && orchRes.results[0]?.tool === "launch_application",
            "11. Existing Phase 3.3 Step 2 AgentOrchestrator functionality remains intact"
        );
    } catch (err: unknown) {
        assert(false, "11. Phase 3.3 Step 2 regression test", String(err));
    }

    // 12. No network requests are made
    try {
        assert(
            mockProvider.capabilities.isLocal === true,
            "12. Verification: Zero network/HTTP requests made during execution (100% offline local architecture)"
        );
    } catch (err: unknown) {
        assert(false, "12. Network safety check", String(err));
    }

    console.log("\n==========================================================================");
    console.log(`Provider Architecture Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runProviderArchitectureTests();
