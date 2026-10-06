import { IAgentPlanner, AgentPlan } from "../orchestrator/types";
import { ProviderRegistry, providerRegistry as defaultProviderRegistry } from "./provider-registry";
import { toolRegistry as defaultToolRegistry, ToolRegistry } from "../tools/tool-registry";
import { logger } from "../../utils/logger";

/**
 * Provider-Agent Planner Adapter (Phase 3.3 - Step 3)
 *
 * Implements IAgentPlanner interface to bridge AI Providers with AgentOrchestrator.
 * Delegates plan generation to the currently active IAIProvider in ProviderRegistry,
 * forwarding available tool definitions from ToolRegistry.
 */
export class ProviderAgentPlanner implements IAgentPlanner {
    private providerRegistry: ProviderRegistry;
    private toolRegistry: ToolRegistry;

    constructor(
        providerRegistry?: ProviderRegistry,
        toolRegistry?: ToolRegistry
    ) {
        this.providerRegistry = providerRegistry || defaultProviderRegistry;
        this.toolRegistry = toolRegistry || defaultToolRegistry;
    }

    /**
     * Translates natural language request into AgentPlan using active AI Provider.
     * @param userRequest Raw user prompt string
     */
    public async plan(
        userRequest: string,
        context?: Record<string, unknown>
    ): Promise<AgentPlan> {
        logger.info(`ProviderAgentPlanner: Delegating plan generation for -> "${userRequest}"`);

        try {
            const provider =
                (context?.isMock ? this.providerRegistry.getProvider("mock") : null) ||
                this.providerRegistry.getActiveProvider();
            logger.info(`ProviderAgentPlanner: Using active provider '${provider.id}' (${provider.name})`);

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

            logger.warn(
                `ProviderAgentPlanner: Provider '${provider.id}' returned failed response -> ${response.error}`
            );

            return {
                userRequest,
                toolCalls: [],
                explanation: response.error || `Provider '${provider.id}' failed to generate plan.`,
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Provider planning exception";
            logger.error(`ProviderAgentPlanner: Exception during plan generation -> ${message}`);

            return {
                userRequest,
                toolCalls: [],
                explanation: message,
            };
        }
    }
}

export const providerAgentPlanner = new ProviderAgentPlanner();
