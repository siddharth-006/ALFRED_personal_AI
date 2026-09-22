"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claudeAIProvider = exports.ClaudeAIProvider = void 0;
const claude_client_1 = require("./claude-client");
const claude_response_parser_1 = require("./claude-response-parser");
const planning_prompt_1 = require("./planning-prompt");
const provider_config_service_1 = require("../config/provider-config.service");
const logger_1 = require("../../../utils/logger");
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
class ClaudeAIProvider {
    id = "claude";
    name = "Anthropic Claude";
    capabilities = {
        supportsTools: true,
        supportsStreaming: false,
        isLocal: false,
        maxContextTokens: 200000,
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
            const conf = provider_config_service_1.providerConfigService.getProviderConfig("claude");
            envConfig = {
                modelName: conf.modelName,
                apiKey: conf.apiKey || (typeof process !== "undefined" ? process.env?.ANTHROPIC_API_KEY : undefined),
            };
        }
        catch {
            // Fall back if service is unavailable
        }
        return {
            apiKey: this.clientConfig.apiKey || envConfig.apiKey,
            modelName: this.clientConfig.modelName || envConfig.modelName || "claude-3-5-sonnet-20241022",
            timeoutMs: this.clientConfig.timeoutMs ?? 15_000,
        };
    }
    /**
     * Allows updating config at runtime.
     */
    updateConfig(updates) {
        this.clientConfig = { ...this.clientConfig, ...updates };
        const effective = this.getEffectiveClientConfig();
        logger_1.logger.info(`ClaudeAIProvider: Config updated — model: ${effective.modelName}, apiKeyConfigured: ${Boolean(effective.apiKey)}`);
    }
    /**
     * Checks Claude availability via API key ping check.
     * Non-throwing — returns false if unconfigured or unreachable.
     */
    async isAvailable() {
        const config = this.getEffectiveClientConfig();
        if (!config.apiKey || !config.apiKey.trim())
            return false;
        try {
            return await (0, claude_client_1.claudePing)(config.apiKey, config.timeoutMs);
        }
        catch {
            return false;
        }
    }
    /**
     * Builds the structured prompt string for the Claude model.
     * Instructs the model to return strictly valid JSON conforming to ALFRED's tool schema.
     */
    buildPrompt(request) {
        return (0, planning_prompt_1.buildAgentSystemPrompt)(request);
    }
    /**
     * Generates a structured AgentPlan by calling Anthropic Claude REST API.
     * Handles: missing API key, timeout, malformed response, unknown tools.
     */
    async generatePlan(request) {
        const config = this.getEffectiveClientConfig();
        logger_1.logger.info(`ClaudeAIProvider: Processing request for -> "${request.userRequest}"`);
        // 1. Availability / Config check
        if (!config.apiKey || !config.apiKey.trim()) {
            const errMsg = "Claude API key missing. Configure ANTHROPIC_API_KEY environment variable or provider configuration.";
            logger_1.logger.warn(`ClaudeAIProvider: ${errMsg}`);
            return this.errorResponse(request.userRequest, errMsg);
        }
        // 2. Build prompt
        const prompt = this.buildPrompt(request);
        // 3. Call Claude REST API
        const clientResult = await (0, claude_client_1.claudeGenerate)(config, prompt, request.context?.temperature, request.context?.maxTokens);
        if (!clientResult.success) {
            logger_1.logger.error(`ClaudeAIProvider: API error -> ${clientResult.error}`);
            return this.errorResponse(request.userRequest, clientResult.error ?? "Unknown Claude API error");
        }
        // 4. Parse and validate response
        const parsed = (0, claude_response_parser_1.parseClaudeResponse)(clientResult.rawText, request.userRequest);
        if (!parsed.success || !parsed.plan) {
            logger_1.logger.warn(`ClaudeAIProvider: Parse error -> ${parsed.error}`);
            return this.errorResponse(request.userRequest, parsed.error ?? "Failed to parse Claude response into a valid plan.", clientResult.rawText);
        }
        logger_1.logger.info(`ClaudeAIProvider: Plan produced with ${parsed.plan.toolCalls.length} tool call(s) for -> "${request.userRequest}"`);
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
                explanation: `Claude provider error: ${error}`,
            },
            rawResponse,
            error,
        };
    }
}
exports.ClaudeAIProvider = ClaudeAIProvider;
exports.claudeAIProvider = new ClaudeAIProvider();
