"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOllamaResponse = parseOllamaResponse;
const plan_validator_1 = require("./plan-validator");
/**
 * Parses and validates a raw Ollama model response string into a structured AgentPlan.
 *
 * @param rawText   Raw text returned by the Ollama model
 * @param userRequest  Original user prompt (for plan metadata)
 */
function parseOllamaResponse(rawText, userRequest) {
    const result = (0, plan_validator_1.parseAndValidateAgentPlan)(rawText, userRequest);
    if (!result.valid || !result.plan) {
        return {
            success: false,
            rawText,
            error: result.error || "Failed to parse Ollama response.",
        };
    }
    return {
        success: true,
        plan: result.plan,
        rawText,
    };
}
