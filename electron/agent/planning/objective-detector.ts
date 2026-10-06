/**
 * ALFRED Phase 5.6: Large Objective & Multi-Step Intent Detector
 *
 * Distinguishes between:
 * A. Simple command (e.g. "Open VS Code", "Start deep work", "Show tasks")
 * B. Simple productivity mutation (e.g. "Create a task to study SQL")
 * C. Multi-step objective / Planning request (e.g. "Prepare my workspace for machine learning",
 *    "Help me organize my tasks for today", "Set me up for a coding session")
 *
 * CRITICAL RULE:
 * Does NOT convert simple single commands into agentic plans.
 * Simple commands remain fast and use the standard execution path.
 */

export interface ObjectiveDetectionResult {
    isObjective: boolean;
    category?: "coding_session" | "ml_session" | "hackathon" | "task_organization" | "study_session" | "recommendation_followup" | "generic_planning";
    detectedTarget?: string;
    originalPrompt: string;
}

/** Regex patterns that indicate large multi-step planning directives */
const MULTI_STEP_OBJECTIVE_PATTERNS = [
    // Prepare workspace / sessions
    /^(?:hey\s+alfred[,\s]*)?(?:prepare|set\s+up|get\s+ready)\s+(?:me\s+for|everything\s+for|my\s+workspace\s+for|my\s+environment\s+for)\s+(.+)$/i,
    /^(?:hey\s+alfred[,\s]*)?(?:prepare|set\s+up)\s+(?:a|an|my|the)?\s*([a-z0-9_\-\s]+?)\s+(?:workspace|session|mode|environment|setup)$/i,
    /^(?:hey\s+alfred[,\s]*)?set\s+me\s+up\s+for\s+(.+)$/i,
    /^(?:hey\s+alfred[,\s]*)?help\s+me\s+(?:get\s+ready\s+for|prepare\s+for|start\s+studying|organize\s+my\s+tasks|organize\s+my\s+work)(?:\s+(?:for|today|tonight))?/i,
    /^(?:hey\s+alfred[,\s]*)?organize\s+my\s+(?:work|tasks)\s+(?:for\s+today|today|tonight)$/i,
    /^(?:hey\s+alfred[,\s]*)?plan\s+(?:my\s+study\s+session|my\s+work|my\s+day|my\s+tasks|this\s+for\s+me|everything)(?:\s+(?:for\s+tonight|for\s+today|today|tonight))?$/i,
    /^(?:hey\s+alfred[,\s]*)?prepare\s+everything(?:\s+i\s+need)?\s+(?:for\s+my\s+hackathon|for\s+the\s+hackathon|for\s+coding|for\s+ml|for\s+that)$/i,
    // Follow-up from recommendation: "prepare everything for that", "set up for that", "plan for that"
    /^(?:hey\s+alfred[,\s]*)?(?:okay\s+|ok\s+)?(?:prepare|set\s+up|plan)\s+(?:everything\s+for\s+that|for\s+that)$/i,
];

/** Specific simple command patterns that must NEVER be treated as large objectives */
const SIMPLE_COMMAND_PATTERNS = [
    /^(?:open|launch|run|start)\s+(?:vs\s*code|chrome|spotify|discord|terminal|power\s*bi|notepad|calculator)$/i,
    /^(?:start|enable)\s+(?:deep\s*work|focus\s*mode)$/i,
    /^(?:show|list)\s+(?:tasks|my\s+tasks|workspaces|my\s+workspaces|goals|projects)$/i,
    /^system\s+(?:status|vitals)$/i,
    /^(?:what\s+should\s+i\s+work\s+on|what\s+to\s+do\s+next|recommend\s+something)/i,
    /^(?:create|add)\s+(?:a\s+)?task\s+(?:called|named|to|for)?\s*.+$/i, // Single mutation
    /^(?:create|add)\s+(?:a\s+)?goal\s+(?:called|named|to|for)?\s*.+$/i, // Single mutation
];

/**
 * Evaluates whether a prompt is a large multi-step objective or planning request.
 */
export function detectObjective(
    prompt: string,
    context?: Record<string, unknown>
): ObjectiveDetectionResult {
    if (!prompt || typeof prompt !== "string") {
        return { isObjective: false, originalPrompt: "" };
    }

    const trimmed = prompt.trim();
    const clean = trimmed
        .replace(/^(?:hey\s+alfred|alfred|please)[,\s]*/i, "")
        .replace(/[.!?]+$/, "")
        .trim();
    const lower = clean.toLowerCase();

    // Check simple command exclusions first (strict fast-path guard)
    for (const pat of SIMPLE_COMMAND_PATTERNS) {
        if (pat.test(clean)) {
            // Exceptions: If prompt explicitly chains multiple distinct actions with "and", it may be multi-step
            const hasAndChaining = /\b(?:and\s+then|and\s+also|and\s+start|and\s+launch|and\s+show|and\s+open)\b/i.test(clean);
            if (!hasAndChaining) {
                return { isObjective: false, originalPrompt: trimmed };
            }
        }
    }

    // Check multi-step patterns
    for (const pat of MULTI_STEP_OBJECTIVE_PATTERNS) {
        const match = clean.match(pat);
        if (match) {
            const rawTarget = match[1] ? match[1].trim() : "";
            let category: ObjectiveDetectionResult["category"] = "generic_planning";

            if (/code|coding|dsa|programming|developer/i.test(clean)) {
                category = "coding_session";
            } else if (/ml|machine\s*learning|data\s*science|ai/i.test(clean)) {
                category = "ml_session";
            } else if (/hackathon/i.test(clean)) {
                category = "hackathon";
            } else if (/organize|tasks|today|work/i.test(clean)) {
                category = "task_organization";
            } else if (/study|studying|tonight/i.test(clean)) {
                category = "study_session";
            } else if (/for\s+that/i.test(clean)) {
                category = "recommendation_followup";
            }

            return {
                isObjective: true,
                category,
                detectedTarget: rawTarget || undefined,
                originalPrompt: trimmed,
            };
        }
    }

    // Check follow-up recommendation reference: "prepare everything for that", "set me up for that"
    if (
        (lower.includes("prepare everything for that") || lower.includes("set me up for that") || lower === "prepare for that") &&
        context?.recentConversation
    ) {
        return {
            isObjective: true,
            category: "recommendation_followup",
            originalPrompt: trimmed,
        };
    }

    // Multi-action chaining check: "Open ML workspace and start deep work and show tasks"
    const actionVerbs = ["open", "launch", "start", "show", "create"];
    let verbCount = 0;
    for (const verb of actionVerbs) {
        const regex = new RegExp(`\\b${verb}\\b`, "gi");
        const matches = clean.match(regex);
        if (matches) verbCount += matches.length;
    }

    if (verbCount >= 2 && /\band\b/i.test(clean)) {
        return {
            isObjective: true,
            category: "generic_planning",
            originalPrompt: trimmed,
        };
    }

    return { isObjective: false, originalPrompt: trimmed };
}
