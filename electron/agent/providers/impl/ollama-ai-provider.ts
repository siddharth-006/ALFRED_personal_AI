import {
    IAIProvider,
    AIProviderId,
    AIProviderCapabilities,
    AIProviderRequest,
    AIProviderResponse,
} from "../types";
import { ollamaGenerate, ollamaPing, OllamaClientConfig } from "./ollama-client";
import { parseOllamaResponse } from "./ollama-response-parser";
import { buildAgentSystemPrompt } from "./planning-prompt";
import { logger } from "../../../utils/logger";

import { providerConfigService } from "../config/provider-config.service";

/**
 * Ollama AI Provider (Phase 3.3 - Step 4.3)
 *
 * Implements IAIProvider for local Ollama LLM inference.
 *
 * SECURITY GUARANTEES:
 * - Does NOT import child_process, spawn, exec, shell, or filesystem primitives.
 * - Does NOT execute ToolRegistry actions directly.
 * - Communicates ONLY with a configured local HTTP endpoint (default: localhost:11434).
 * - All model responses are parsed and validated by OllamaResponseParser.
 * - Unknown tool names in model responses are silently rejected before returning a plan.
 * - Endpoint URL is fully configurable — no hardcoded application assumptions.
 *
 * DATA FLOW:
 * UserRequest → buildPrompt() → ollamaGenerate() → parseOllamaResponse() → AgentPlan
 */
export class OllamaAIProvider implements IAIProvider {
    public readonly id: AIProviderId = "ollama";
    public readonly name: string = "Ollama (Local AI)";
    public readonly capabilities: AIProviderCapabilities = {
        supportsTools: true,
        supportsStreaming: false,
        isLocal: true,
        maxContextTokens: 8192,
    };

    private clientConfig: Partial<OllamaClientConfig> = {};

    constructor(config?: Partial<OllamaClientConfig>) {
        if (config) {
            this.clientConfig = { ...config };
        }
    }

    /**
     * Resolves active client configuration merging explicit overrides and ProviderConfigService.
     */
    public getEffectiveClientConfig(): OllamaClientConfig {
        let envConfig: Partial<OllamaClientConfig> = {};
        try {
            const conf = providerConfigService.getProviderConfig("ollama");
            envConfig = {
                endpointUrl: conf.endpointUrl,
                modelName: conf.modelName,
            };
        } catch {
            // Fall back if service is unavailable
        }

        return {
            endpointUrl: this.clientConfig.endpointUrl || envConfig.endpointUrl || "http://127.0.0.1:11434",
            modelName:   this.clientConfig.modelName   || envConfig.modelName   || "qwen3:latest",
            timeoutMs:   this.clientConfig.timeoutMs   ?? 60_000,
        };
    }

    /**
     * Allows updating endpoint/model/timeout at runtime (e.g. when user changes settings).
     */
    public updateConfig(updates: Partial<OllamaClientConfig>): void {
        this.clientConfig = { ...this.clientConfig, ...updates };
        const effective = this.getEffectiveClientConfig();
        logger.info(
            `OllamaAIProvider: Config updated — endpoint: ${effective.endpointUrl}, model: ${effective.modelName}`
        );
    }

    /**
     * Checks Ollama server availability via /api/tags ping.
     * Non-throwing — returns false if unreachable.
     */
    public async isAvailable(): Promise<boolean> {
        const config = this.getEffectiveClientConfig();
        try {
            return await ollamaPing(config.endpointUrl);
        } catch {
            return false;
        }
    }

    /**
     * Builds the structured prompt string for the Ollama model.
     * Instructs the model to return strictly valid JSON conforming to ALFRED's tool schema.
     */
    private buildPrompt(request: AIProviderRequest): string {
        return buildAgentSystemPrompt(request);
    }

    /**
     * Generates a structured AgentPlan by calling the local Ollama model.
     * Handles: unavailable endpoint, timeout, malformed response, unknown tools.
     */
    public async generatePlan(request: AIProviderRequest): Promise<AIProviderResponse> {
        const config = this.getEffectiveClientConfig();
        logger.info(`OllamaAIProvider: Processing request for -> "${request.userRequest}"`);

        // 1. Availability check
        const available = await this.isAvailable();
        if (!available) {
            const errMsg = `Ollama server is unreachable at '${config.endpointUrl}'. Ensure Ollama is running.`;
            logger.warn(`OllamaAIProvider: ${errMsg}`);
            return this.errorResponse(request.userRequest, errMsg);
        }

        // 2. Build prompt
        const prompt = this.buildPrompt(request);

        // 3. Call Ollama HTTP endpoint
        const clientResult = await ollamaGenerate(
            config,
            prompt,
            request.context?.temperature as number | undefined,
            request.context?.maxTokens as number | undefined
        );

        if (!clientResult.success) {
            logger.error(`OllamaAIProvider: HTTP error -> ${clientResult.error}`);
            return this.errorResponse(request.userRequest, clientResult.error ?? "Unknown Ollama HTTP error");
        }

        // 4. Parse and validate response
        const parsed = parseOllamaResponse(clientResult.rawText, request.userRequest);

        if (!parsed.success || !parsed.plan) {
            logger.warn(`OllamaAIProvider: Parse error -> ${parsed.error}`);
            return this.errorResponse(
                request.userRequest,
                parsed.error ?? "Failed to parse Ollama response into a valid plan.",
                clientResult.rawText
            );
        }

        logger.info(
            `OllamaAIProvider: Plan produced with ${parsed.plan.toolCalls.length} tool call(s) for -> "${request.userRequest}"`
        );

        return {
            success: true,
            providerId: this.id,
            plan: parsed.plan,
            rawResponse: clientResult.rawText,
        };
    }

    /** Constructs a failed AIProviderResponse with an empty plan */
    private errorResponse(
        userRequest: string,
        error: string,
        rawResponse?: string
    ): AIProviderResponse {
        return {
            success: false,
            providerId: this.id,
            plan: {
                userRequest,
                toolCalls: [],
                explanation: `Ollama provider error: ${error}`,
            },
            rawResponse,
            error,
        };
    }
}

export const ollamaAIProvider = new OllamaAIProvider();
