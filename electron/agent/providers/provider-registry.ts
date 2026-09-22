import { IAIProvider, AIProviderId, AIProviderCapabilities } from "./types";
import { providerConfigService } from "./config/provider-config.service";
import { logger } from "../../utils/logger";

export interface ProviderMetadata {
    id: AIProviderId;
    name: string;
    available: boolean;
    capabilities: AIProviderCapabilities;
}

/**
 * Provider Registry (Phase 3.3 - Step 3)
 *
 * Central registry and factory for AI Provider instances (Mock, Ollama, Gemini, Claude).
 * Manages provider registration, metadata discovery, availability checks, and active provider selection.
 */
export class ProviderRegistry {
    private providers: Map<AIProviderId, IAIProvider> = new Map();
    private activeProviderId: AIProviderId = "mock";

    /**
     * Registers a new AI Provider into the registry.
     * @param provider IAIProvider implementation
     */
    public registerProvider(provider: IAIProvider): void {
        if (!provider || typeof provider !== "object") {
            throw new Error("Provider Registry Error: Provider definition must be an object.");
        }
        if (!provider.id || typeof provider.id !== "string") {
            throw new Error("Provider Registry Error: Provider must have a valid ID string.");
        }

        if (this.providers.has(provider.id)) {
            logger.warn(`ProviderRegistry: Overwriting existing provider '${provider.id}'.`);
        }

        this.providers.set(provider.id, provider);
        logger.info(`ProviderRegistry: Registered AI provider '${provider.id}' (${provider.name})`);
    }

    /**
     * Retrieves a registered provider by ID.
     * @param id AIProviderId
     */
    public getProvider(id: string): IAIProvider | undefined {
        return this.providers.get(id as AIProviderId);
    }

    /**
     * Checks if a provider with the given ID is registered.
     * @param id Provider ID
     */
    public hasProvider(id: string): boolean {
        return this.providers.has(id as AIProviderId);
    }

    /**
     * Lists all registered providers along with their current availability status.
     */
    public async listProviders(): Promise<ProviderMetadata[]> {
        const metadata: ProviderMetadata[] = [];
        for (const [id, provider] of this.providers.entries()) {
            let available = false;
            try {
                available = await provider.isAvailable();
            } catch {
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
    public setActiveProviderId(id: AIProviderId): void {
        providerConfigService.setActiveProviderId(id);
        this.activeProviderId = id;
        logger.info(`ProviderRegistry: Active AI provider set to '${id}'`);
    }

    /**
     * Returns the currently effective active provider ID (resolves fallbacks if requested provider is disabled/unconfigured).
     */
    public getActiveProviderId(): AIProviderId {
        return providerConfigService.resolveEffectiveProviderId();
    }

    /**
     * Returns the currently active provider instance.
     * Safely falls back to 'mock' provider if active provider is unconfigured or unregistered.
     */
    public getActiveProvider(): IAIProvider {
        const effectiveId = this.getActiveProviderId();
        let provider = this.providers.get(effectiveId);

        if (!provider) {
            logger.warn(
                `ProviderRegistry: Effective provider '${effectiveId}' is not registered in memory. Defaulting to 'mock' provider.`
            );
            provider = this.providers.get("mock");
        }

        if (!provider) {
            throw new Error(
                `Provider Registry Error: Default 'mock' provider is missing from ProviderRegistry.`
            );
        }
        return provider;
    }

    /**
     * Clears all registered providers and resets active provider to 'mock' (for test resets).
     */
    public clear(): void {
        this.providers.clear();
        this.activeProviderId = "mock";
        providerConfigService.reset();
    }
}

export const providerRegistry = new ProviderRegistry();
