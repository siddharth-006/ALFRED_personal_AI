import { AgentPlan } from "../orchestrator/types";

/**
 * Multi-Provider AI Architecture Types (Phase 3.3 - Step 3)
 *
 * Defines provider abstraction types, configuration options, request/response formats,
 * and the provider interface for ALFRED's AI layer.
 *
 * PROVIDERS ONLY PLAN/THINK. THEY NEVER DIRECTLY EXECUTE SYSTEM COMMANDS.
 */

export type AIProviderId = "mock" | "ollama" | "gemini" | "claude";

export interface AIProviderCapabilities {
    /** Whether the provider supports tool calling / structured function execution */
    supportsTools: boolean;
    /** Whether the provider supports token streaming responses */
    supportsStreaming: boolean;
    /** Whether the provider runs locally on device without network connection */
    isLocal: boolean;
    /** Maximum context window size in tokens */
    maxContextTokens?: number;
}

export interface AIProviderConfig {
    /** Identifier of the target provider */
    providerId: AIProviderId;
    /** Target model identifier string (e.g. "llama3:latest", "gemini-1.5-pro", "claude-3-5-sonnet") */
    modelName: string;
    /** Optional endpoint URL (e.g. for local Ollama server http://localhost:11434) */
    endpointUrl?: string;
    /** Model sampling temperature (0.0 to 1.0) */
    temperature?: number;
    /** Maximum completion response tokens */
    maxTokens?: number;
}

export interface AIProviderRequest {
    /** Raw user prompt string */
    userRequest: string;
    /** Array of registered tool definitions available for planning */
    availableTools?: Array<{ name: string; description: string; category: string }>;
    /** Optional contextual state (e.g. active workspace, current route) */
    context?: Record<string, unknown>;
}

export interface AIProviderResponse {
    /** Response status */
    success: boolean;
    /** ID of the provider that generated this response */
    providerId: AIProviderId;
    /** Structured AgentPlan produced by the AI model */
    plan: AgentPlan;
    /** Optional raw text response from model before parsing */
    rawResponse?: string;
    /** Error message if provider execution or parsing failed */
    error?: string;
}

export interface IAIProvider {
    /** Unique provider identifier key */
    readonly id: AIProviderId;
    /** Human-readable provider display name */
    readonly name: string;
    /** Provider feature capabilities */
    readonly capabilities: AIProviderCapabilities;

    /**
     * Checks if the provider is active and ready to handle requests.
     */
    isAvailable(): Promise<boolean> | boolean;

    /**
     * Generates a structured AgentPlan for a given user request.
     * MUST NOT execute system primitives directly.
     *
     * @param request AIProviderRequest
     * @returns Promise<AIProviderResponse>
     */
    generatePlan(request: AIProviderRequest): Promise<AIProviderResponse>;
}
