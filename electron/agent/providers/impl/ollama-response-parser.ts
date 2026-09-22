import { AgentPlan } from "../../orchestrator/types";
import { parseAndValidateAgentPlan } from "./plan-validator";

/**
 * Ollama Response Parser (Phase 3.3 - Step 4.8)
 *
 * Converts the raw Ollama model text response into a validated, structured AgentPlan
 * using the shared plan validator.
 */

export interface ParsedOllamaResponse {
    success: boolean;
    plan?: AgentPlan;
    rawText: string;
    error?: string;
}

/**
 * Parses and validates a raw Ollama model response string into a structured AgentPlan.
 *
 * @param rawText   Raw text returned by the Ollama model
 * @param userRequest  Original user prompt (for plan metadata)
 */
export function parseOllamaResponse(rawText: string, userRequest: string): ParsedOllamaResponse {
    const result = parseAndValidateAgentPlan(rawText, userRequest);

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
