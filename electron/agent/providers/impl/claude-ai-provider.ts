import {
    IAIProvider,
    AIProviderId,
    AIProviderCapabilities,
    AIProviderRequest,
    AIProviderResponse,
} from "../types";
import { claudeGenerate, claudePing, ClaudeClientConfig } from "./claude-client";
import { parseClaudeResponse } from "./claude-response-parser";
import { buildAgentSystemPrompt } from "./planning-prompt";
import { providerConfigService } from "../config/provider-config.service";
import { logger } from "../../../utils/logger";

/**
 * Anthropic Claude AI Provider (Phase 3.3 - Step 4.6)
 *
 * Implements IAIProvider for Anthropic Claude API inference.
 *
 * SECURITY GUARANTEES:
 * - Does NOT import child_process, spawn, exec, shell, or filesystem primitives.
 * - Does NOT execute ToolRegistry actions directly.
 * - Communicates ONLY via configured Claude REST API endpoint.
 * - All model responses are parsed and validated by ClaudeResponseParser.
 * - Unknown tool names in model responses are silently rejected before returning a plan.
 *
 * DATA FLOW:
 * UserRequest → buildPrompt() → claudeGenerate() → parseClaudeResponse() → AgentPlan
 */
export class ClaudeAIProvider implements IAIProvider {
    public readonly id: AIProviderId = "claude";
    public readonly name: string = "Anthropic Claude";
    public readonly capabilities: AIProviderCapabilities = {
        supportsTools: true,
        supportsStreaming: false,
        isLocal: false,
        maxContextTokens: 200000,
    };

    private clientConfig: Partial<ClaudeClientConfig> = {};

    constructor(config?: Partial<ClaudeClientConfig>) {
        if (config) {
            this.clientConfig = { ...config };
        }
    }

    /**
     * Resolves active client configuration merging explicit overrides and ProviderConfigService.
     */
    public getEffectiveClientConfig(): ClaudeClientConfig {
        let envConfig: Partial<ClaudeClientConfig> = {};
        try {
            const conf = providerConfigService.getProviderConfig("claude");
            envConfig = {
                modelName: conf.modelName,
                apiKey: conf.apiKey || (typeof process !== "undefined" ? process.env?.ANTHROPIC_API_KEY : undefined),
            };
        } catch {
            // Fall back if service is unavailable
        }

        return {
            apiKey:    this.clientConfig.apiKey    || envConfig.apiKey,
            modelName: this.clientConfig.modelName || envConfig.modelName || "claude-3-5-sonnet-20241022",
            timeoutMs: this.clientConfig.timeoutMs ?? 15_000,
        };
    }

    /**
     * Allows updating config at runtime.
     */
    public updateConfig(updates: Partial<ClaudeClientConfig>): void {
        this.clientConfig = { ...this.clientConfig, ...updates };
        const effective = this.getEffectiveClientConfig();
        logger.info(
            `ClaudeAIProvider: Config updated — model: ${effective.modelName}, apiKeyConfigured: ${Boolean(effective.apiKey)}`
        );
    }

    /**
     * Checks Claude availability via API key ping check.
     * Non-throwing — returns false if unconfigured or unreachable.
     */
    public async isAvailable(): Promise<boolean> {
        const config = this.getEffectiveClientConfig();
        if (!config.apiKey || !config.apiKey.trim()) return false;
        try {
            return await claudePing(config.apiKey, config.timeoutMs);
        } catch {
            return false;
        }
    }

    /**
     * Builds the structured prompt string for the Claude model.
     * Instructs the model to return strictly valid JSON conforming to ALFRED's tool schema.
     */
    private buildPrompt(request: AIProviderRequest): string {
        return buildAgentSystemPrompt(request);
    }

    /**
     * Generates a structured AgentPlan by calling Anthropic Claude REST API.
     * Handles: missing API key, timeout, malformed response, unknown tools.
     */
    public async generatePlan(request: AIProviderRequest): Promise<AIProviderResponse> {
        const config = this.getEffectiveClientConfig();
        logger.info(`ClaudeAIProvider: Processing request for -> "${request.userRequest}"`);

        // 1. Availability / Config check
        if (!config.apiKey || !config.apiKey.trim()) {
            const errMsg = "Claude API key missing. Configure ANTHROPIC_API_KEY environment variable or provider configuration.";
            logger.warn(`ClaudeAIProvider: ${errMsg}`);
            return this.errorResponse(request.userRequest, errMsg);
        }

        // 2. Build prompt
        const prompt = this.buildPrompt(request);

        // 3. Call Claude REST API
        const clientResult = await claudeGenerate(
            config,
            prompt,
            request.context?.temperature as number | undefined,
            request.context?.maxTokens as number | undefined
        );

        if (!clientResult.success) {
            logger.error(`ClaudeAIProvider: API error -> ${clientResult.error}`);
            return this.errorResponse(request.userRequest, clientResult.error ?? "Unknown Claude API error");
        }

        // 4. Parse and validate response
        const parsed = parseClaudeResponse(clientResult.rawText, request.userRequest);

        if (!parsed.success || !parsed.plan) {
            logger.warn(`ClaudeAIProvider: Parse error -> ${parsed.error}`);
            return this.errorResponse(
                request.userRequest,
                parsed.error ?? "Failed to parse Claude response into a valid plan.",
                clientResult.rawText
            );
        }

        logger.info(
            `ClaudeAIProvider: Plan produced with ${parsed.plan.toolCalls.length} tool call(s) for -> "${request.userRequest}"`
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
                explanation: `Claude provider error: ${error}`,
            },
            rawResponse,
            error,
        };
    }
}

export const claudeAIProvider = new ClaudeAIProvider();
