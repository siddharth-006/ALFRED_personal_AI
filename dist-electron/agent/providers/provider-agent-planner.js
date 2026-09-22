"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerAgentPlanner = exports.ProviderAgentPlanner = void 0;
const provider_registry_1 = require("./provider-registry");
const tool_registry_1 = require("../tools/tool-registry");
const logger_1 = require("../../utils/logger");
/**
 * Provider-Agent Planner Adapter (Phase 3.3 - Step 3)
 *
 * Implements IAgentPlanner interface to bridge AI Providers with AgentOrchestrator.
 * Delegates plan generation to the currently active IAIProvider in ProviderRegistry,
 * forwarding available tool definitions from ToolRegistry.
 */
class ProviderAgentPlanner {
    providerRegistry;
    toolRegistry;
    constructor(providerRegistry, toolRegistry) {
        this.providerRegistry = providerRegistry || provider_registry_1.providerRegistry;
        this.toolRegistry = toolRegistry || tool_registry_1.toolRegistry;
    }
    /**
     * Translates natural language request into AgentPlan using active AI Provider.
     * @param userRequest Raw user prompt string
     */
    async plan(userRequest, context) {
        logger_1.logger.info(`ProviderAgentPlanner: Delegating plan generation for -> "${userRequest}"`);
        try {
            const provider = this.providerRegistry.getActiveProvider();
            logger_1.logger.info(`ProviderAgentPlanner: Using active provider '${provider.id}' (${provider.name})`);
            const availableTools = this.toolRegistry.list().map((t) => ({
                name: t.name,
                description: t.description,
                category: t.category,
            }));
            const response = await provider.generatePlan({
                userRequest,
                availableTools,
                context,
            });
            if (response.success && response.plan) {
                return response.plan;
            }
            logger_1.logger.warn(`ProviderAgentPlanner: Provider '${provider.id}' returned failed response -> ${response.error}`);
            return {
                userRequest,
                toolCalls: [],
                explanation: response.error || `Provider '${provider.id}' failed to generate plan.`,
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Provider planning exception";
            logger_1.logger.error(`ProviderAgentPlanner: Exception during plan generation -> ${message}`);
            return {
                userRequest,
                toolCalls: [],
                explanation: message,
            };
        }
    }
}
exports.ProviderAgentPlanner = ProviderAgentPlanner;
exports.providerAgentPlanner = new ProviderAgentPlanner();
