"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ollamaAIProvider = exports.OllamaAIProvider = void 0;
const ollama_client_1 = require("./ollama-client");
const ollama_response_parser_1 = require("./ollama-response-parser");
const planning_prompt_1 = require("./planning-prompt");
const logger_1 = require("../../../utils/logger");
const provider_config_service_1 = require("../config/provider-config.service");
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
class OllamaAIProvider {
    id = "ollama";
    name = "Ollama (Local AI)";
    capabilities = {
        supportsTools: true,
        supportsStreaming: false,
        isLocal: true,
        maxContextTokens: 8192,
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
            const conf = provider_config_service_1.providerConfigService.getProviderConfig("ollama");
            envConfig = {
                endpointUrl: conf.endpointUrl,
                modelName: conf.modelName,
            };
        }
        catch {
            // Fall back if service is unavailable
        }
        return {
            endpointUrl: this.clientConfig.endpointUrl || envConfig.endpointUrl || "http://localhost:11434",
            modelName: this.clientConfig.modelName || envConfig.modelName || "qwen3:latest",
            timeoutMs: this.clientConfig.timeoutMs ?? 60_000,
        };
    }
    /**
     * Allows updating endpoint/model/timeout at runtime (e.g. when user changes settings).
     */
    updateConfig(updates) {
        this.clientConfig = { ...this.clientConfig, ...updates };
        const effective = this.getEffectiveClientConfig();
        logger_1.logger.info(`OllamaAIProvider: Config updated — endpoint: ${effective.endpointUrl}, model: ${effective.modelName}`);
    }
    /**
     * Checks Ollama server availability via /api/tags ping.
     * Non-throwing — returns false if unreachable.
     */
    async isAvailable() {
        const config = this.getEffectiveClientConfig();
        try {
            return await (0, ollama_client_1.ollamaPing)(config.endpointUrl);
        }
        catch {
            return false;
        }
    }
    /**
     * Builds the structured prompt string for the Ollama model.
     * Instructs the model to return strictly valid JSON conforming to ALFRED's tool schema.
     */
    buildPrompt(request) {
        return (0, planning_prompt_1.buildAgentSystemPrompt)(request);
    }
    /**
     * Generates a structured AgentPlan by calling the local Ollama model.
     * Handles: unavailable endpoint, timeout, malformed response, unknown tools.
     */
    async generatePlan(request) {
        const config = this.getEffectiveClientConfig();
        logger_1.logger.info(`OllamaAIProvider: Processing request for -> "${request.userRequest}"`);
        // 1. Availability check
        const available = await this.isAvailable();
        if (!available) {
            const errMsg = `Ollama server is unreachable at '${config.endpointUrl}'. Ensure Ollama is running.`;
            logger_1.logger.warn(`OllamaAIProvider: ${errMsg}`);
            return this.errorResponse(request.userRequest, errMsg);
        }
        // 2. Build prompt
        const prompt = this.buildPrompt(request);
        // 3. Call Ollama HTTP endpoint
        const clientResult = await (0, ollama_client_1.ollamaGenerate)(config, prompt, request.context?.temperature, request.context?.maxTokens);
        if (!clientResult.success) {
            logger_1.logger.error(`OllamaAIProvider: HTTP error -> ${clientResult.error}`);
            return this.errorResponse(request.userRequest, clientResult.error ?? "Unknown Ollama HTTP error");
        }
        // 4. Parse and validate response
        const parsed = (0, ollama_response_parser_1.parseOllamaResponse)(clientResult.rawText, request.userRequest);
        if (!parsed.success || !parsed.plan) {
            logger_1.logger.warn(`OllamaAIProvider: Parse error -> ${parsed.error}`);
            return this.errorResponse(request.userRequest, parsed.error ?? "Failed to parse Ollama response into a valid plan.", clientResult.rawText);
        }
        logger_1.logger.info(`OllamaAIProvider: Plan produced with ${parsed.plan.toolCalls.length} tool call(s) for -> "${request.userRequest}"`);
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
                explanation: `Ollama provider error: ${error}`,
            },
            rawResponse,
            error,
        };
    }
}
exports.OllamaAIProvider = OllamaAIProvider;
exports.ollamaAIProvider = new OllamaAIProvider();
