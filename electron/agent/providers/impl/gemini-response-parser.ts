import { AgentPlan } from "../../orchestrator/types";
import { parseAndValidateAgentPlan } from "./plan-validator";

/**
 * Gemini Response Parser (Phase 3.3 - Step 4.8)
 *
 * Converts raw text returned by the Google Gemini model into a validated, structured AgentPlan
 * using the shared plan validator.
 */

export interface ParsedGeminiResponse {
    success: boolean;
    plan?: AgentPlan;
    rawText: string;
    error?: string;
}

/**
 * Parses and validates a raw Gemini model response string into a structured AgentPlan.
 *
 * @param rawText   Raw text returned by the Gemini model
 * @param userRequest  Original user prompt (for plan metadata)
 */
export function parseGeminiResponse(rawText: string, userRequest: string): ParsedGeminiResponse {
    const result = parseAndValidateAgentPlan(rawText, userRequest);

    if (!result.valid || !result.plan) {
        return {
            success: false,
            rawText,
            error: result.error || "Failed to parse Gemini response.",
        };
    }

    return {
        success: true,
        plan: result.plan,
        rawText,
    };
}
