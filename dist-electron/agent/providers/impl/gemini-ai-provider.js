"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.geminiAIProvider = exports.GeminiAIProvider = void 0;
const gemini_client_1 = require("./gemini-client");
const gemini_response_parser_1 = require("./gemini-response-parser");
const planning_prompt_1 = require("./planning-prompt");
const provider_config_service_1 = require("../config/provider-config.service");
const logger_1 = require("../../../utils/logger");
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
class GeminiAIProvider {
    id = "gemini";
    name = "Google Gemini";
    capabilities = {
        supportsTools: true,
        supportsStreaming: false,
        isLocal: false,
        maxContextTokens: 1048576,
    };
    clientConfig = {};
    constructor(config) {
        if (config) {
            this.clientConfig = { ...config };
        }
    }
    /**
     * Resolves active client configuration merging explicit overrides and ProviderConfigService.
     */
    getEffectiveClientConfig() {
        let envConfig = {};
        try {
            const conf = provider_config_service_1.providerConfigService.getProviderConfig("gemini");
            envConfig = {
                modelName: conf.modelName,
                apiKey: conf.apiKey || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined),
            };
        }
        catch {
            // Fall back if service is unavailable
        }
        return {
            apiKey: this.clientConfig.apiKey || envConfig.apiKey,
            modelName: this.clientConfig.modelName || envConfig.modelName || "gemini-1.5-pro",
            timeoutMs: this.clientConfig.timeoutMs ?? 15_000,
        };
    }
    /**
     * Allows updating config at runtime.
     */
    updateConfig(updates) {
        this.clientConfig = { ...this.clientConfig, ...updates };
        const effective = this.getEffectiveClientConfig();
        logger_1.logger.info(`GeminiAIProvider: Config updated — model: ${effective.modelName}, apiKeyConfigured: ${Boolean(effective.apiKey)}`);
    }
    /**
     * Checks Gemini availability via API key ping check.
     * Non-throwing — returns false if unconfigured or unreachable.
     */
    async isAvailable() {
        const config = this.getEffectiveClientConfig();
        if (!config.apiKey || !config.apiKey.trim())
            return false;
        try {
            return await (0, gemini_client_1.geminiPing)(config.apiKey, config.timeoutMs);
        }
        catch {
            return false;
        }
    }
    /**
     * Builds the structured prompt string for the Gemini model.
     * Instructs the model to return strictly valid JSON conforming to ALFRED's tool schema.
     */
    buildPrompt(request) {
        return (0, planning_prompt_1.buildAgentSystemPrompt)(request);
    }
    /**
     * Generates a structured AgentPlan by calling Google Gemini REST API.
     * Handles: missing API key, timeout, malformed response, unknown tools.
     */
    async generatePlan(request) {
        const config = this.getEffectiveClientConfig();
        logger_1.logger.info(`GeminiAIProvider: Processing request for -> "${request.userRequest}"`);
        // 1. Availability / Config check
        if (!config.apiKey || !config.apiKey.trim()) {
            const errMsg = "Gemini API key missing. Configure GEMINI_API_KEY environment variable or provider configuration.";
            logger_1.logger.warn(`GeminiAIProvider: ${errMsg}`);
            return this.errorResponse(request.userRequest, errMsg);
        }
        // 2. Build prompt
        const prompt = this.buildPrompt(request);
        // 3. Call Gemini REST API
        const clientResult = await (0, gemini_client_1.geminiGenerate)(config, prompt, request.context?.temperature, request.context?.maxTokens);
        if (!clientResult.success) {
            logger_1.logger.error(`GeminiAIProvider: API error -> ${clientResult.error}`);
            return this.errorResponse(request.userRequest, clientResult.error ?? "Unknown Gemini API error");
        }
        // 4. Parse and validate response
        const parsed = (0, gemini_response_parser_1.parseGeminiResponse)(clientResult.rawText, request.userRequest);
        if (!parsed.success || !parsed.plan) {
            logger_1.logger.warn(`GeminiAIProvider: Parse error -> ${parsed.error}`);
            return this.errorResponse(request.userRequest, parsed.error ?? "Failed to parse Gemini response into a valid plan.", clientResult.rawText);
        }
        logger_1.logger.info(`GeminiAIProvider: Plan produced with ${parsed.plan.toolCalls.length} tool call(s) for -> "${request.userRequest}"`);
        return {
            success: true,
            providerId: this.id,
            plan: parsed.plan,
            rawResponse: clientResult.rawText,
        };
    }
    /** Constructs a failed AIProviderResponse with an empty plan */
    errorResponse(userRequest, error, rawResponse) {
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
exports.GeminiAIProvider = GeminiAIProvider;
exports.geminiAIProvider = new GeminiAIProvider();
