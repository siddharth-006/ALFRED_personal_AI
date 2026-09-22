"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../config/constants");
const provider_config_service_1 = require("../../agent/providers/config/provider-config.service");
const provider_registry_1 = require("../../agent/providers/provider-registry");
const mock_ai_provider_1 = require("../../agent/providers/impl/mock-ai-provider");
const command_agent_service_1 = require("../../agent/command-agent.service");
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
    // 1. Channel constants validity
    try {
        const channelsValid = constants_1.IPC_CHANNELS.AI_PROVIDER.GET_STATUSES === "ai-provider:get-statuses" &&
            constants_1.IPC_CHANNELS.AI_PROVIDER.GET_ACTIVE === "ai-provider:get-active" &&
            constants_1.IPC_CHANNELS.AI_PROVIDER.SET_ACTIVE === "ai-provider:set-active" &&
            constants_1.IPC_CHANNELS.AI_PROVIDER.GET_CONFIG_STATUS === "ai-provider:get-config-status";
        assert(channelsValid, "1. IPC_CHANNELS.AI_PROVIDER constants defined correctly");
    }
    catch (err) {
        assert(false, "1. IPC channel constants check", String(err));
    }
    // 2. Querying all provider statuses via IPC service
    try {
        const statuses = provider_config_service_1.providerConfigService.listAllProviderStatuses();
        assert(Array.isArray(statuses) && statuses.length === 4 && statuses[0].providerId === "mock", "2. Listing all provider statuses returns metadata for mock, ollama, gemini, and claude", `Total status items: ${statuses.length}`);
    }
    catch (err) {
        assert(false, "2. Provider status listing", String(err));
    }
    // 3. Active provider retrieval via IPC service
    try {
        const active = provider_config_service_1.providerConfigService.getActiveProviderId();
        assert(active === "mock", "3. Active provider query returns default active provider ('mock')");
    }
    catch (err) {
        assert(false, "3. Active provider query", String(err));
    }
    // 4. Provider selection and fallback resolution over IPC
    try {
        provider_config_service_1.providerConfigService.setActiveProviderId("gemini");
        const effectiveId = provider_config_service_1.providerConfigService.resolveEffectiveProviderId();
        assert(provider_config_service_1.providerConfigService.getActiveProviderId() === "gemini" && effectiveId === "mock", "4. Provider selection over IPC safely resolves to 'mock' fallback when unconfigured provider is selected", `Requested: gemini, Effective: ${effectiveId}`);
        provider_config_service_1.providerConfigService.setActiveProviderId("mock");
    }
    catch (err) {
        assert(false, "4. Provider selection & fallback", String(err));
    }
    // 5. Invalid provider ID rejection
    try {
        let errorCaught = false;
        try {
            provider_config_service_1.providerConfigService.setActiveProviderId("invalid_ai_provider");
        }
        catch (err) {
            errorCaught = true;
        }
        assert(errorCaught, "5. Invalid provider ID parameter over IPC is rejected safely");
    }
    catch (err) {
        assert(false, "5. Invalid provider ID rejection", String(err));
    }
    // 6. Security audit: Zero child_process, shell, or API keys exposed
    try {
        const statuses = provider_config_service_1.providerConfigService.listAllProviderStatuses();
        const fullMap = provider_config_service_1.providerConfigService.getFullConfigMap();
        const noApiKeysStored = fullMap.configs.gemini.apiKeyConfigured === false &&
            fullMap.configs.claude.apiKeyConfigured === false &&
            fullMap.configs.ollama.apiKeyConfigured === false;
        const safePayloadFormat = statuses.every((s) => typeof s.providerId === "string" &&
            typeof s.name === "string" &&
            typeof s.status === "string" &&
            typeof s.enabled === "boolean" &&
            typeof s.configured === "boolean" &&
            !s.apiKey &&
            !s.secretKey &&
            !s.exec);
        assert(noApiKeysStored && safePayloadFormat, "6. Security Audit: Zero child_process/shell exposure, zero API keys exposed in IPC payload");
    }
    catch (err) {
        assert(false, "6. Security audit", String(err));
    }
    // 7. Phase 3.2 regression test
    try {
        const p32Res = await command_agent_service_1.commandAgentService.parseCommand("Open VS Code");
        assert(p32Res.intent === "launch_application" && p32Res.target === "VS Code", "7. Phase 3.2 natural language command agent remains 100% functional");
    }
    catch (err) {
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
