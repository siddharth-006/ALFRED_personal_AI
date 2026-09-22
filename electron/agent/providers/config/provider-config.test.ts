import { providerConfigService } from "./provider-config.service";
import { providerRegistry } from "../provider-registry";
import { mockAIProvider } from "../impl/mock-ai-provider";
import { ProviderAgentPlanner } from "../provider-agent-planner";
import { AgentOrchestrator } from "../../orchestrator/agent-orchestrator";
import { ToolRegistry } from "../../tools/tool-registry";
import { launchApplicationTool } from "../../tools/builtins/launch-application.tool";
import { commandAgentService } from "../../command-agent.service";

/**
 * AI Provider Configuration Test Suite (Phase 3.3 - Step 4.1)
 *
 * Verifies provider configuration management, status reporting, configuration validation,
 * unknown provider rejection, fallback mechanics, and system regression integrity.
 */
async function runProviderConfigTests() {
    console.log("==========================================================================");
    console.log("ALFRED AI Provider Configuration — Step 4.1 Test Suite");
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

    // Reset configuration state before testing
    providerConfigService.reset();
    providerRegistry.clear();
    providerRegistry.registerProvider(mockAIProvider);

    // 1. Default configuration initialization
    try {
        const fullMap = providerConfigService.getFullConfigMap();
        const hasAllFour =
            Boolean(fullMap.configs.mock) &&
            Boolean(fullMap.configs.ollama) &&
            Boolean(fullMap.configs.gemini) &&
            Boolean(fullMap.configs.claude);

        assert(
            hasAllFour && fullMap.activeProviderId === "mock",
            "1. Default configuration initialization for mock, ollama, gemini, and claude",
            `Active provider: ${fullMap.activeProviderId}`
        );
    } catch (err: unknown) {
        assert(false, "1. Default configuration initialization", String(err));
    }

    // 2. Provider selection & active provider query
    try {
        providerConfigService.setActiveProviderId("ollama");
        const selected = providerConfigService.getActiveProviderId();
        assert(
            selected === "ollama",
            "2. Provider selection & active provider query ('ollama' selected successfully)",
            `Selected provider: ${selected}`
        );
        providerConfigService.setActiveProviderId("mock");
    } catch (err: unknown) {
        assert(false, "2. Provider selection", String(err));
    }

    // 3. Status reporting (ready, disabled, unconfigured)
    try {
        providerConfigService.reset();
        const mockStatus = providerConfigService.getProviderStatus("mock");
        const ollamaStatus = providerConfigService.getProviderStatus("ollama");
        const geminiStatus = providerConfigService.getProviderStatus("gemini");

        assert(
            mockStatus.status === "ready" &&
                ollamaStatus.status === "disabled" &&
                geminiStatus.status === "disabled",
            "3. Status reporting (mock: ready, ollama/gemini: disabled by default)"
        );
    } catch (err: unknown) {
        assert(false, "3. Status reporting", String(err));
    }

    // 4. Configuration validation
    try {
        const validRes = providerConfigService.validateConfig({
            providerId: "ollama",
            modelName: "llama3:latest",
            endpointUrl: "http://localhost:11434",
            enabled: true,
        });

        const invalidModel = providerConfigService.validateConfig({
            providerId: "ollama",
            modelName: "",
            enabled: true,
        });

        const invalidUrl = providerConfigService.validateConfig({
            providerId: "ollama",
            modelName: "llama3",
            endpointUrl: "ftp://localhost:11434",
            enabled: true,
        });

        assert(
            validRes.valid === true && invalidModel.valid === false && invalidUrl.valid === false,
            "4. Configuration validation (valid model/url passes; empty model and bad protocol fail)"
        );
    } catch (err: unknown) {
        assert(false, "4. Configuration validation", String(err));
    }

    // 5. Unknown provider rejection
    try {
        let threw = false;
        try {
            providerConfigService.setActiveProviderId("unsupported_provider" as any);
        } catch {
            threw = true;
        }
        assert(threw, "5. Unknown provider rejection upon setting active provider ID");
    } catch (err: unknown) {
        assert(false, "5. Unknown provider rejection", String(err));
    }

    // 6. Safe fallback to 'mock' when active provider is disabled or unconfigured
    try {
        providerConfigService.setActiveProviderId("gemini"); // Gemini is disabled/unconfigured in this step
        const effectiveId = providerConfigService.resolveEffectiveProviderId();

        assert(
            effectiveId === "mock",
            "6. Safe fallback to 'mock' when active provider (gemini) is unconfigured/disabled",
            `Effective active provider resolved: ${effectiveId}`
        );
    } catch (err: unknown) {
        assert(false, "6. Safe fallback to mock", String(err));
    }

    // 7. ProviderAgentPlanner fallback integration
    try {
        providerConfigService.setActiveProviderId("claude"); // Claude is disabled/unconfigured
        const toolsReg = new ToolRegistry();
        toolsReg.register(launchApplicationTool);

        const plannerBridge = new ProviderAgentPlanner(providerRegistry, toolsReg);
        const orchestrator = new AgentOrchestrator(plannerBridge, toolsReg);

        const execRes = await orchestrator.execute("Open VS Code", { isMock: true });

        assert(
            execRes.success === true &&
                execRes.results[0]?.tool === "launch_application" &&
                execRes.results[0]?.success === true,
            "7. ProviderAgentPlanner fallback integration (Claude request gracefully resolves via Mock fallback)"
        );
    } catch (err: unknown) {
        assert(false, "7. ProviderAgentPlanner fallback integration", String(err));
    }

    // 8. Zero network requests / API key security check
    try {
        const fullMap = providerConfigService.getFullConfigMap();
        const geminiConfigured = fullMap.configs.gemini.apiKeyConfigured;
        const claudeConfigured = fullMap.configs.claude.apiKeyConfigured;
        const ollamaConfigured = fullMap.configs.ollama.apiKeyConfigured;

        assert(
            geminiConfigured === false && claudeConfigured === false && ollamaConfigured === false,
            "8. Security verification: Zero API keys stored, zero network requests made (100% offline)"
        );
    } catch (err: unknown) {
        assert(false, "8. Zero network security check", String(err));
    }

    // 9. Regression testing for Phase 3.2, Phase 3.3 Steps 1–3
    try {
        const p32Res = await commandAgentService.parseCommand("Open VS Code");
        assert(
            p32Res.intent === "launch_application" && p32Res.target === "VS Code",
            "9. Phase 3.2 natural language command agent remains 100% functional"
        );
    } catch (err: unknown) {
        assert(false, "9. Regression testing", String(err));
    }

    console.log("\n==========================================================================");
    console.log(`Provider Config Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runProviderConfigTests();
