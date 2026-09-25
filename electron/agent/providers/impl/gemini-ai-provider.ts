import {
    IAIProvider,
    AIProviderId,
    AIProviderCapabilities,
    AIProviderRequest,
    AIProviderResponse,
} from "../types";
import { geminiGenerate, geminiPing, GeminiClientConfig } from "./gemini-client";
import { parseGeminiResponse } from "./gemini-response-parser";
import { buildAgentSystemPrompt } from "./planning-prompt";
import { providerConfigService } from "../config/provider-config.service";
import { logger } from "../../../utils/logger";

/**
 * Google Gemini AI Provider (Phase 3.3 - Step 4.5)
 *
 * Implements IAIProvider for Google Gemini API inference.
 *
 * SECURITY GUARANTEES:
 * - Does NOT import child_process, spawn, exec, shell, or filesystem primitives.
 * - Does NOT execute ToolRegistry actions directly.
 * - Communicates ONLY via configured Gemini REST API endpoint.
 * - All model responses are parsed and validated by GeminiResponseParser.
 * - Unknown tool names in model responses are silently rejected before returning a plan.
 *
 * DATA FLOW:
 * UserRequest → buildPrompt() → geminiGenerate() → parseGeminiResponse() → AgentPlan
 */
export class GeminiAIProvider implements IAIProvider {
    public readonly id: AIProviderId = "gemini";
    public readonly name: string = "Google Gemini";
    public readonly capabilities: AIProviderCapabilities = {
        supportsTools: true,
        supportsStreaming: false,
        isLocal: false,
        maxContextTokens: 1048576,
    };

    private clientConfig: Partial<GeminiClientConfig> = {};

    constructor(config?: Partial<GeminiClientConfig>) {
        if (config) {
            this.clientConfig = { ...config };
        }
    }

    /**
     * Resolves active client configuration merging explicit overrides and ProviderConfigService.
     */
    public getEffectiveClientConfig(): GeminiClientConfig {
        let envConfig: Partial<GeminiClientConfig> = {};
        try {
            const conf = providerConfigService.getProviderConfig("gemini");
            envConfig = {
                modelName: conf.modelName,
                apiKey: conf.apiKey || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined),
            };
        } catch {
            // Fall back if service is unavailable
        }

        return {
            apiKey:    this.clientConfig.apiKey    || envConfig.apiKey,
            modelName: this.clientConfig.modelName || envConfig.modelName || "gemini-3.5-flash-lite",
            timeoutMs: this.clientConfig.timeoutMs ?? 60_000,
        };
    }

    /**
     * Allows updating config at runtime.
     */
    public updateConfig(updates: Partial<GeminiClientConfig>): void {
        this.clientConfig = { ...this.clientConfig, ...updates };
        const effective = this.getEffectiveClientConfig();
        logger.info(
            `GeminiAIProvider: Config updated — model: ${effective.modelName}, apiKeyConfigured: ${Boolean(effective.apiKey)}`
        );
    }

    /**
     * Checks Gemini availability via API key ping check.
     * Non-throwing — returns false if unconfigured or unreachable.
     */
    public async isAvailable(): Promise<boolean> {
        const config = this.getEffectiveClientConfig();
        if (!config.apiKey || !config.apiKey.trim()) return false;
        try {
            return await geminiPing(config.apiKey, config.timeoutMs);
        } catch {
            return false;
        }
    }

    /**
     * Builds the structured prompt string for the Gemini model.
     * Instructs the model to return strictly valid JSON conforming to ALFRED's tool schema.
     */
    private buildPrompt(request: AIProviderRequest): string {
        return buildAgentSystemPrompt(request);
    }

    /**
     * Generates a structured AgentPlan by calling Google Gemini REST API.
     * Handles: missing API key, timeout, malformed response, unknown tools.
     */
    public async generatePlan(request: AIProviderRequest): Promise<AIProviderResponse> {
        const config = this.getEffectiveClientConfig();
        logger.info(`GeminiAIProvider: Processing request for -> "${request.userRequest}"`);

        // 1. Availability / Config check
        if (!config.apiKey || !config.apiKey.trim()) {
            const errMsg = "Gemini API key missing. Configure GEMINI_API_KEY environment variable or provider configuration.";
            logger.warn(`GeminiAIProvider: ${errMsg}`);
            return this.errorResponse(request.userRequest, errMsg);
        }

        // 2. Build prompt
        const prompt = this.buildPrompt(request);

        // 3. Call Gemini REST API
        const clientResult = await geminiGenerate(
            config,
            prompt,
            request.context?.temperature as number | undefined,
            request.context?.maxTokens as number | undefined
        );

        if (!clientResult.success) {
            logger.error(`GeminiAIProvider: API error -> ${clientResult.error}`);
            return this.errorResponse(request.userRequest, clientResult.error ?? "Unknown Gemini API error");
        }

        // 4. Parse and validate response
        const parsed = parseGeminiResponse(clientResult.rawText, request.userRequest);

        if (!parsed.success || !parsed.plan) {
            logger.warn(`GeminiAIProvider: Parse error -> ${parsed.error}`);
            return this.errorResponse(
                request.userRequest,
                parsed.error ?? "Failed to parse Gemini response into a valid plan.",
                clientResult.rawText
            );
        }

        logger.info(
            `GeminiAIProvider: Plan produced with ${parsed.plan.toolCalls.length} tool call(s) for -> "${request.userRequest}"`
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
                explanation: `Gemini provider error: ${error}`,
            },
            rawResponse,
            error,
        };
    }
}

export const geminiAIProvider = new GeminiAIProvider();
