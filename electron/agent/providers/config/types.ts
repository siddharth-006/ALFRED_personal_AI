import { AIProviderId } from "../types";

/**
 * AI Provider Configuration Types (Phase 3.3 - Step 4.1)
 *
 * Defines configuration schemas, extended metadata, status reporting,
 * and status states for provider configuration management.
 */

export type ProviderStatusState = "ready" | "configured" | "unconfigured" | "disabled";

export interface ExtendedAIProviderConfig {
    /** Target provider identifier */
    providerId: AIProviderId;
    /** Model identifier name (e.g. "mock-v1", "qwen3:latest", "gemini-3.5-flash-lite", "claude-3-5-sonnet") */
    modelName: string;
    /** Endpoint URL (for local models e.g. Ollama http://localhost:11434) */
    endpointUrl?: string;
    /** Sampling temperature */
    temperature?: number;
    /** Max completion tokens */
    maxTokens?: number;
    /** Whether the provider is enabled by user configuration */
    enabled: boolean;
    /** Whether an API key/credential is configured (read-only flag for status reporting) */
    apiKeyConfigured?: boolean;
    /** Optional API Key for cloud AI providers (e.g. Gemini, Claude) */
    apiKey?: string;
}

export interface ProviderConfigStatus {
    /** Target provider identifier */
    providerId: AIProviderId;
    /** Human-readable provider display name */
    name: string;
    /** Whether provider is enabled */
    enabled: boolean;
    /** Whether provider has required configuration present */
    configured: boolean;
    /** Overall status state */
    status: ProviderStatusState;
    /** Current model name */
    modelName: string;
    /** Current endpoint URL if applicable */
    endpointUrl?: string;
    /** Informational status message */
    statusMessage?: string;
}

export interface FullProviderConfigMap {
    activeProviderId: AIProviderId;
    fallbackProviderId: AIProviderId;
    configs: Record<AIProviderId, ExtendedAIProviderConfig>;
}
