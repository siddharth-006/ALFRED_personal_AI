"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseClaudeResponse = parseClaudeResponse;
const plan_validator_1 = require("./plan-validator");
/**
 * Parses and validates a raw Claude model response string into a structured AgentPlan.
 *
 * @param rawText   Raw text returned by the Claude model
 * @param userRequest  Original user prompt (for plan metadata)
 */
function parseClaudeResponse(rawText, userRequest) {
    const result = (0, plan_validator_1.parseAndValidateAgentPlan)(rawText, userRequest);
    if (!result.valid || !result.plan) {
        return {
            success: false,
            rawText,
            error: result.error || "Failed to parse Claude response.",
        };
    }
    return {
        success: true,
        plan: result.plan,
        rawText,
    };
}
