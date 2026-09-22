import { AgentPlan } from "../../orchestrator/types";
import { parseAndValidateAgentPlan } from "./plan-validator";

/**
 * Claude Response Parser (Phase 3.3 - Step 4.8)
 *
 * Converts raw text returned by the Anthropic Claude model into a validated, structured AgentPlan
 * using the shared plan validator.
 */

export interface ParsedClaudeResponse {
    success: boolean;
    plan?: AgentPlan;
    rawText: string;
    error?: string;
}

/**
 * Parses and validates a raw Claude model response string into a structured AgentPlan.
 *
 * @param rawText   Raw text returned by the Claude model
 * @param userRequest  Original user prompt (for plan metadata)
 */
export function parseClaudeResponse(rawText: string, userRequest: string): ParsedClaudeResponse {
    const result = parseAndValidateAgentPlan(rawText, userRequest);

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
