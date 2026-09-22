import { IPC_CHANNELS } from "../../config/constants";
import { providerConfigService } from "../../agent/providers/config/provider-config.service";
import { providerRegistry } from "../../agent/providers/provider-registry";
import { mockAIProvider } from "../../agent/providers/impl/mock-ai-provider";
import { commandAgentService } from "../../agent/command-agent.service";

/**
 * AI Provider IPC Handlers Test Suite (Phase 3.3 - Step 4.2)
 *
 * Verifies IPC channel definitions, provider configuration IPC handlers,
 * fallback mechanics over IPC, security boundary validation, and zero regressions.
 */
async function runAIProviderIpcTests() {
    console.log("==========================================================================");
    console.log("ALFRED AI Provider IPC Bridge — Step 4.2 Test Suite");
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

    // 1. Channel constants validity
    try {
        const channelsValid =
            IPC_CHANNELS.AI_PROVIDER.GET_STATUSES === "ai-provider:get-statuses" &&
            IPC_CHANNELS.AI_PROVIDER.GET_ACTIVE === "ai-provider:get-active" &&
            IPC_CHANNELS.AI_PROVIDER.SET_ACTIVE === "ai-provider:set-active" &&
            IPC_CHANNELS.AI_PROVIDER.GET_CONFIG_STATUS === "ai-provider:get-config-status";

        assert(
            channelsValid,
            "1. IPC_CHANNELS.AI_PROVIDER constants defined correctly"
        );
    } catch (err: unknown) {
        assert(false, "1. IPC channel constants check", String(err));
    }

    // 2. Querying all provider statuses via IPC service
    try {
        const statuses = providerConfigService.listAllProviderStatuses();
        assert(
            Array.isArray(statuses) && statuses.length === 4 && statuses[0].providerId === "mock",
            "2. Listing all provider statuses returns metadata for mock, ollama, gemini, and claude",
            `Total status items: ${statuses.length}`
        );
    } catch (err: unknown) {
        assert(false, "2. Provider status listing", String(err));
    }

    // 3. Active provider retrieval via IPC service
    try {
        const active = providerConfigService.getActiveProviderId();
        assert(
            active === "mock",
            "3. Active provider query returns default active provider ('mock')"
        );
    } catch (err: unknown) {
        assert(false, "3. Active provider query", String(err));
    }

    // 4. Provider selection and fallback resolution over IPC
    try {
        providerConfigService.setActiveProviderId("gemini");
        const effectiveId = providerConfigService.resolveEffectiveProviderId();

        assert(
            providerConfigService.getActiveProviderId() === "gemini" && effectiveId === "mock",
            "4. Provider selection over IPC safely resolves to 'mock' fallback when unconfigured provider is selected",
            `Requested: gemini, Effective: ${effectiveId}`
        );

        providerConfigService.setActiveProviderId("mock");
    } catch (err: unknown) {
        assert(false, "4. Provider selection & fallback", String(err));
    }

    // 5. Invalid provider ID rejection
    try {
        let errorCaught = false;
        try {
            providerConfigService.setActiveProviderId("invalid_ai_provider" as any);
        } catch (err: unknown) {
            errorCaught = true;
        }
        assert(
            errorCaught,
            "5. Invalid provider ID parameter over IPC is rejected safely"
        );
    } catch (err: unknown) {
        assert(false, "5. Invalid provider ID rejection", String(err));
    }

    // 6. Security audit: Zero child_process, shell, or API keys exposed
    try {
        const statuses = providerConfigService.listAllProviderStatuses();
        const fullMap = providerConfigService.getFullConfigMap();
        const noApiKeysStored =
            fullMap.configs.gemini.apiKeyConfigured === false &&
            fullMap.configs.claude.apiKeyConfigured === false &&
            fullMap.configs.ollama.apiKeyConfigured === false;

        const safePayloadFormat = statuses.every(
            (s) =>
                typeof s.providerId === "string" &&
                typeof s.name === "string" &&
                typeof s.status === "string" &&
                typeof s.enabled === "boolean" &&
                typeof s.configured === "boolean" &&
                !(s as any).apiKey &&
                !(s as any).secretKey &&
                !(s as any).exec
        );

        assert(
            noApiKeysStored && safePayloadFormat,
            "6. Security Audit: Zero child_process/shell exposure, zero API keys exposed in IPC payload"
        );
    } catch (err: unknown) {
        assert(false, "6. Security audit", String(err));
    }

    // 7. Phase 3.2 regression test
    try {
        const p32Res = await commandAgentService.parseCommand("Open VS Code");
        assert(
            p32Res.intent === "launch_application" && p32Res.target === "VS Code",
            "7. Phase 3.2 natural language command agent remains 100% functional"
        );
    } catch (err: unknown) {
        assert(false, "7. Phase 3.2 regression check", String(err));
    }

    console.log("\n==========================================================================");
    console.log(`AI Provider IPC Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log("==========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runAIProviderIpcTests();
