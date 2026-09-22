"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mockAIProvider = exports.MockAIProvider = void 0;
const mock_planner_1 = require("../../orchestrator/mock-planner");
const logger_1 = require("../../../utils/logger");
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
class MockAIProvider {
    id = "mock";
    name = "Mock AI Provider";
    capabilities = {
        supportsTools: true,
        supportsStreaming: false,
        isLocal: true,
        maxContextTokens: 4096,
    };
    isAvailable() {
        return true;
    }
    async generatePlan(request) {
        logger_1.logger.info(`MockAIProvider: Processing request for -> "${request.userRequest}"`);
        try {
            const plan = mock_planner_1.mockAgentPlanner.plan(request.userRequest, request.context);
            return {
                success: true,
                providerId: this.id,
                plan,
                rawResponse: JSON.stringify(plan),
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Plan generation error";
            logger_1.logger.error(`MockAIProvider: Error generating plan -> ${message}`);
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
exports.MockAIProvider = MockAIProvider;
exports.mockAIProvider = new MockAIProvider();
