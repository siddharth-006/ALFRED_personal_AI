"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerRegistry = exports.ProviderRegistry = void 0;
const provider_config_service_1 = require("./config/provider-config.service");
const logger_1 = require("../../utils/logger");
/**
 * Provider Registry (Phase 3.3 - Step 3)
 *
 * Central registry and factory for AI Provider instances (Mock, Ollama, Gemini, Claude).
 * Manages provider registration, metadata discovery, availability checks, and active provider selection.
 */
class ProviderRegistry {
    providers = new Map();
    activeProviderId = "mock";
    /**
     * Registers a new AI Provider into the registry.
     * @param provider IAIProvider implementation
     */
    registerProvider(provider) {
        if (!provider || typeof provider !== "object") {
            throw new Error("Provider Registry Error: Provider definition must be an object.");
        }
        if (!provider.id || typeof provider.id !== "string") {
            throw new Error("Provider Registry Error: Provider must have a valid ID string.");
        }
        if (this.providers.has(provider.id)) {
            logger_1.logger.warn(`ProviderRegistry: Overwriting existing provider '${provider.id}'.`);
        }
        this.providers.set(provider.id, provider);
        logger_1.logger.info(`ProviderRegistry: Registered AI provider '${provider.id}' (${provider.name})`);
    }
    /**
     * Retrieves a registered provider by ID.
     * @param id AIProviderId
     */
    getProvider(id) {
        return this.providers.get(id);
    }
    /**
     * Checks if a provider with the given ID is registered.
     * @param id Provider ID
     */
    hasProvider(id) {
        return this.providers.has(id);
    }
    /**
     * Lists all registered providers along with their current availability status.
     */
    async listProviders() {
        const metadata = [];
        for (const [id, provider] of this.providers.entries()) {
            let available = false;
            try {
                available = await provider.isAvailable();
            }
            catch {
                available = false;
            }
            metadata.push({
                id,
                name: provider.name,
                available,
                capabilities: provider.capabilities,
            });
        }
        return metadata;
    }
    /**
     * Sets the active provider ID for the application.
     * Throws an error if the requested provider is invalid.
     *
     * @param id AIProviderId
     */
    setActiveProviderId(id) {
        provider_config_service_1.providerConfigService.setActiveProviderId(id);
        this.activeProviderId = id;
        logger_1.logger.info(`ProviderRegistry: Active AI provider set to '${id}'`);
    }
    /**
     * Returns the currently effective active provider ID (resolves fallbacks if requested provider is disabled/unconfigured).
     */
    getActiveProviderId() {
        return provider_config_service_1.providerConfigService.resolveEffectiveProviderId();
    }
    /**
     * Returns the currently active provider instance.
     * Safely falls back to 'mock' provider if active provider is unconfigured or unregistered.
     */
    getActiveProvider() {
        const effectiveId = this.getActiveProviderId();
        let provider = this.providers.get(effectiveId);
        if (!provider) {
            logger_1.logger.warn(`ProviderRegistry: Effective provider '${effectiveId}' is not registered in memory. Defaulting to 'mock' provider.`);
            provider = this.providers.get("mock");
        }
        if (!provider) {
            throw new Error(`Provider Registry Error: Default 'mock' provider is missing from ProviderRegistry.`);
        }
        return provider;
    }
    /**
     * Clears all registered providers and resets active provider to 'mock' (for test resets).
     */
    clear() {
        this.providers.clear();
        this.activeProviderId = "mock";
        provider_config_service_1.providerConfigService.reset();
    }
}
exports.ProviderRegistry = ProviderRegistry;
exports.providerRegistry = new ProviderRegistry();
