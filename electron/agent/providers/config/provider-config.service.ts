import { AIProviderId } from "../types";
import {
    ExtendedAIProviderConfig,
    ProviderConfigStatus,
    ProviderStatusState,
    FullProviderConfigMap,
} from "./types";
import { logger } from "../../../utils/logger";

const VALID_PROVIDER_IDS: AIProviderId[] = ["mock", "ollama", "gemini", "claude"];

/**
 * AI Provider Configuration Service (Phase 3.3 - Step 4.1)
 *
 * Manages configuration state, parameter validation, status reporting,
 * active provider selection, and fallback resolution across AI providers.
 *
 * DOES NOT make network requests.
 * DOES NOT store API keys or secrets.
 * OPERATES 100% locally in-memory.
 */
export class ProviderConfigService {
    private activeProviderId: AIProviderId = "mock";
    private fallbackProviderId: AIProviderId = "mock";

    private configs: Record<AIProviderId, ExtendedAIProviderConfig> = {
        mock: {
            providerId: "mock",
            modelName: "mock-v1",
            enabled: true,
            apiKeyConfigured: true,
            temperature: 0.0,
        },
        ollama: {
            providerId: "ollama",
            modelName: "qwen3:latest",
            endpointUrl: "http://localhost:11434",
            enabled: false,
            apiKeyConfigured: false,
            temperature: 0.7,
        },
        gemini: {
            providerId: "gemini",
            modelName: "gemini-3.5-flash-lite",
            enabled: false,
            apiKeyConfigured: false,
            temperature: 0.7,
        },
        claude: {
            providerId: "claude",
            modelName: "claude-3-5-sonnet",
            enabled: false,
            apiKeyConfigured: false,
            temperature: 0.7,
        },
    };

    /**
     * Gets the currently selected active provider ID.
     */
    public getActiveProviderId(): AIProviderId {
        return this.activeProviderId;
    }

    /**
     * Sets the active provider ID after validating provider ID exists.
     * @param id AIProviderId
     */
    public setActiveProviderId(id: AIProviderId): void {
        if (!VALID_PROVIDER_IDS.includes(id)) {
            throw new Error(
                `ProviderConfigService Error: Invalid provider ID '${id}'. Allowed providers: ${VALID_PROVIDER_IDS.join(
                    ", "
                )}`
            );
        }
        this.activeProviderId = id;
        if (id === "ollama") {
            this.configs.ollama.enabled = true;
        }
        if (id === "gemini") {
            this.configs.gemini.enabled = true;
        }
        if (id === "claude") {
            this.configs.claude.enabled = true;
        }
        logger.info(`ProviderConfigService: Active provider set to '${id}'`);
    }

    /**
     * Retrieves current configuration object for a specific provider.
     * @param id AIProviderId
     */
    public getProviderConfig(id: AIProviderId): ExtendedAIProviderConfig {
        if (!VALID_PROVIDER_IDS.includes(id)) {
            throw new Error(`ProviderConfigService Error: Invalid provider ID '${id}'`);
        }
        return { ...this.configs[id] };
    }

    /**
     * Validates configuration settings for a provider.
     * @param config ExtendedAIProviderConfig
     */
    public validateConfig(config: ExtendedAIProviderConfig): { valid: boolean; error?: string } {
        if (!config || typeof config !== "object") {
            return { valid: false, error: "Configuration must be an object." };
        }
        if (!VALID_PROVIDER_IDS.includes(config.providerId)) {
            return {
                valid: false,
                error: `Invalid providerId '${config.providerId}'. Allowed: ${VALID_PROVIDER_IDS.join(", ")}`,
            };
        }
        if (typeof config.modelName !== "string" || !config.modelName.trim()) {
            return { valid: false, error: "Model name ('modelName') must be a non-empty string." };
        }
        if (config.endpointUrl !== undefined) {
            if (typeof config.endpointUrl !== "string" || !config.endpointUrl.trim()) {
                return { valid: false, error: "Endpoint URL must be a non-empty string if provided." };
            }
            const trimmedUrl = config.endpointUrl.trim().toLowerCase();
            if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
                return { valid: false, error: "Endpoint URL must start with 'http://' or 'https://'." };
            }
        }
        return { valid: true };
    }

    /**
     * Updates configuration settings for a provider.
     * @param id AIProviderId
     * @param updates Partial<ExtendedAIProviderConfig>
     */
    public updateProviderConfig(
        id: AIProviderId,
        updates: Partial<ExtendedAIProviderConfig>
    ): ExtendedAIProviderConfig {
        const current = this.getProviderConfig(id);
        const updated: ExtendedAIProviderConfig = {
            ...current,
            ...updates,
            providerId: id, // Ensure providerId cannot be mutated dynamically
        };

        const validation = this.validateConfig(updated);
        if (!validation.valid) {
            throw new Error(`ProviderConfigService Error (${id}): ${validation.error}`);
        }

        this.configs[id] = updated;
        logger.info(`ProviderConfigService: Updated configuration for '${id}'`);
        return { ...this.configs[id] };
    }

    /**
     * Computes status and readiness metrics for a provider.
     * @param id AIProviderId
     */
    public getProviderStatus(id: AIProviderId): ProviderConfigStatus {
        const config = this.getProviderConfig(id);

        let name = "Mock AI Provider";
        if (id === "ollama") name = "Ollama (Local AI)";
        if (id === "gemini") name = "Google Gemini";
        if (id === "claude") name = "Anthropic Claude";

        let configured = false;
        let statusMessage = "";

        if (id === "mock") {
            configured = true;
            statusMessage = "Mock provider ready for offline testing.";
        } else if (id === "ollama") {
            configured = Boolean(config.endpointUrl && config.modelName);
            statusMessage = configured
                ? `Endpoint set to ${config.endpointUrl} (${config.modelName})`
                : "Endpoint URL or model name missing.";
        } else if (id === "gemini") {
            const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
            configured = Boolean(apiKey && config.modelName);
            statusMessage = configured
                ? `Gemini API key configured (${config.modelName})`
                : "Gemini API key missing. Configure GEMINI_API_KEY env var or provider apiKey.";
        } else if (id === "claude") {
            const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
            configured = Boolean(apiKey && config.modelName);
            statusMessage = configured
                ? `Claude API key configured (${config.modelName})`
                : "Claude API key missing. Configure ANTHROPIC_API_KEY env var or provider apiKey.";
        }

        let status: ProviderStatusState = "unconfigured";
        if (!config.enabled) {
            status = "disabled";
        } else if (configured) {
            status = "ready";
        } else {
            status = "unconfigured";
        }

        return {
            providerId: id,
            name,
            enabled: config.enabled,
            configured,
            status,
            modelName: config.modelName,
            endpointUrl: config.endpointUrl,
            statusMessage,
        };
    }

    /**
     * Lists status objects for all supported providers.
     */
    public listAllProviderStatuses(): ProviderConfigStatus[] {
        return VALID_PROVIDER_IDS.map((id) => this.getProviderStatus(id));
    }

    /**
     * Resolves the effective provider ID to use for execution.
     * If the selected active provider is disabled or unconfigured, it safely falls back to 'mock'.
     */
    public resolveEffectiveProviderId(): AIProviderId {
        const activeStatus = this.getProviderStatus(this.activeProviderId);

        if (activeStatus.status === "ready") {
            return this.activeProviderId;
        }

        logger.warn(
            `ProviderConfigService: Active provider '${this.activeProviderId}' is ${activeStatus.status} (${activeStatus.statusMessage}). Falling back to '${this.fallbackProviderId}'.`
        );
        return this.fallbackProviderId;
    }

    /**
     * Returns full snapshot of provider configuration map.
     */
    public getFullConfigMap(): FullProviderConfigMap {
        return {
            activeProviderId: this.activeProviderId,
            fallbackProviderId: this.fallbackProviderId,
            configs: {
                mock: { ...this.configs.mock },
                ollama: { ...this.configs.ollama },
                gemini: { ...this.configs.gemini },
                claude: { ...this.configs.claude },
            },
        };
    }

    /**
     * Resets config state back to defaults (for test resets).
     */
    public reset(): void {
        this.activeProviderId = "mock";
        this.fallbackProviderId = "mock";
        this.configs.mock = {
            providerId: "mock",
            modelName: "mock-v1",
            enabled: true,
            apiKeyConfigured: true,
            temperature: 0.0,
        };
        this.configs.ollama = {
            providerId: "ollama",
            modelName: "qwen3:latest",
            endpointUrl: "http://localhost:11434",
            enabled: false,
            apiKeyConfigured: false,
            temperature: 0.7,
        };
        this.configs.gemini = {
            providerId: "gemini",
            modelName: "gemini-3.5-flash-lite",
            enabled: false,
            apiKeyConfigured: false,
            temperature: 0.7,
        };
        this.configs.claude = {
            providerId: "claude",
            modelName: "claude-3-5-sonnet",
            enabled: false,
            apiKeyConfigured: false,
            temperature: 0.7,
        };
    }
}

export const providerConfigService = new ProviderConfigService();
