import {
    IAIProvider,
    AIProviderId,
    AIProviderCapabilities,
    AIProviderRequest,
    AIProviderResponse,
} from "../types";
import { mockAgentPlanner } from "../../orchestrator/mock-planner";
import { logger } from "../../../utils/logger";

/**
 * Mock AI Provider (Phase 3.3 - Step 3)
 *
 * Implements IAIProvider for testing multi-provider architecture.
 * Uses deterministic MockAgentPlanner internally.
 *
 * DOES NOT make network requests.
 * DOES NOT require API keys.
 * DOES NOT load external SDKs.
 */
export class MockAIProvider implements IAIProvider {
    public readonly id: AIProviderId = "mock";
    public readonly name: string = "Mock AI Provider";
    public readonly capabilities: AIProviderCapabilities = {
        supportsTools: true,
        supportsStreaming: false,
        isLocal: true,
        maxContextTokens: 4096,
    };

    public isAvailable(): boolean {
        return true;
    }

    public async generatePlan(request: AIProviderRequest): Promise<AIProviderResponse> {
        logger.info(`MockAIProvider: Processing request for -> "${request.userRequest}"`);

        try {
            const plan = mockAgentPlanner.plan(request.userRequest, request.context);
            return {
                success: true,
                providerId: this.id,
                plan,
                rawResponse: JSON.stringify(plan),
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Plan generation error";
            logger.error(`MockAIProvider: Error generating plan -> ${message}`);
            return {
                success: false,
                providerId: this.id,
                plan: {
                    userRequest: request.userRequest,
                    toolCalls: [],
                    explanation: `Mock provider error: ${message}`,
                },
                error: message,
            };
        }
    }
}

export const mockAIProvider = new MockAIProvider();
