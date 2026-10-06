/**
 * ALFRED Phase 5.7: Explicit Memory Intent Detector
 *
 * Detects explicit user intent to remember, forget, or update long-term preferences.
 * Strict principle: Ordinary conversation statements MUST NOT create memories.
 */

import { MemoryCategory, MemoryProposal } from "./memory.types";
import { memoryService } from "./memory.service";
import { detectSensitiveData } from "./sensitive-filter";

export type DetectedMemoryIntent =
    | { isMemoryIntent: false }
    | {
          isMemoryIntent: true;
          isRejectedSensitive: true;
          explanation: string;
      }
    | {
          isMemoryIntent: true;
          isRejectedSensitive: false;
          proposal: MemoryProposal;
      };

export function detectMemoryIntent(prompt: string): DetectedMemoryIntent {
    const raw = (prompt || "").trim();
    const lower = raw.toLowerCase();

    // 1. Detect explicit FORGET / REMOVE requests
    const forgetMatch = raw.match(
        /^(?:hey\s+alfred[,\s]*)?(?:please\s+)?(?:forget\s+(?:that\s+|my\s+|everything\s+(?:you\s+remember\s+)?about\s+|all\s+memories\s*|this\s+preference\s*|the\s+preference\s*|that\s+preference\s*)?|remove\s+(?:that|the)?\s*memory|delete\s+(?:that|the)?\s*memory)\s*(.*)$/i
    );

    if (forgetMatch && isExplicitForget(lower)) {
        return handleForgetIntent(raw, lower);
    }

    // 2. Detect explicit EDIT / UPDATE requests
    const updateMatch = raw.match(
        /^(?:hey\s+alfred[,\s]*)?(?:please\s+)?(?:change|update)\s+(?:that|my)\s+preference\s+(?:to\s+)?(.*)$/i
    );
    if (updateMatch && updateMatch[1]) {
        return handleUpdateIntent(updateMatch[1].trim(), raw);
    }

    // 3. Detect explicit REMEMBER requests
    // Must contain explicit command words: "remember that", "remember this:", "remember", "don't forget that", "save this preference"
    if (!isExplicitRemember(lower)) {
        return { isMemoryIntent: false };
    }

    return handleRememberIntent(raw);
}

function isExplicitRemember(lower: string): boolean {
    if (lower.startsWith("remember that ") || lower.startsWith("remember this:") || lower.startsWith("remember this :")) {
        return true;
    }
    if (
        lower.startsWith("don't forget that ") ||
        lower.startsWith("dont forget that ") ||
        lower.startsWith("don't forget :") ||
        lower.startsWith("don't forget my ") ||
        lower.startsWith("dont forget my ") ||
        lower.startsWith("don't forget ") ||
        lower.startsWith("dont forget ")
    ) {
        return true;
    }
    if (lower.startsWith("save this preference") || lower.startsWith("save preference")) {
        return true;
    }
    if (/^hey\s+alfred[,\s]+remember\b/i.test(lower)) {
        return true;
    }
    if (/^remember\s+i\s+prefer\b/i.test(lower) || /^remember\s+that\s+i\b/i.test(lower) || /^remember\s+my\b/i.test(lower)) {
        return true;
    }
    return false;
}

function isExplicitForget(lower: string): boolean {
    return (
        lower.startsWith("forget that ") ||
        lower.startsWith("forget my ") ||
        lower.startsWith("forget everything") ||
        lower.startsWith("forget all") ||
        lower.startsWith("forget this preference") ||
        lower.startsWith("remove that memory") ||
        lower.startsWith("delete that memory") ||
        /^hey\s+alfred[,\s]+forget\b/i.test(lower)
    );
}

function handleRememberIntent(raw: string): DetectedMemoryIntent {
    // Strip prefix
    let content = raw
        .replace(/^(?:hey\s+alfred[,\s]*)?(?:please\s+)?(?:remember\s+that\s+|remember\s+this\s*:\s*|remember\s+|don't\s+forget\s+that\s+|dont\s+forget\s+that\s+|don't\s+forget\s*:\s*|save\s+this\s+preference\s*:\s*|save\s+this\s+preference\s+|save\s+preference\s*:\s*)/i, "")
        .trim();

    // Check sensitive data (Section 17)
    const sensitive = detectSensitiveData(content);
    if (sensitive.isSensitive) {
        return {
            isMemoryIntent: true,
            isRejectedSensitive: true,
            explanation: sensitive.safeExplanation || "I can't save passwords or API keys as ALFRED memory.",
        };
    }

    // Determine category
    const category = categorizeMemoryContent(content);

    // Clean up content phrasing if needed
    content = formatMemoryContent(content);

    // Check for duplicate / existing memory (Section 12)
    const existing = memoryService.findSimilarOrDuplicate(content, category);
    if (existing) {
        return {
            isMemoryIntent: true,
            isRejectedSensitive: false,
            proposal: {
                type: "update",
                memory: {
                    category,
                    content,
                },
                existingMemory: existing,
                promptPreview: `You already have this preference saved:\n"${existing.content}"\n\nWould you like to update it to:\n"${content}"?`,
                spokenPrompt: `You already have this preference saved. Would you like me to update it to ${toSecondPerson(content)}?`,
            },
        };
    }

    return {
        isMemoryIntent: true,
        isRejectedSensitive: false,
        proposal: {
            type: "create",
            memory: {
                category,
                content,
            },
            promptPreview: `Remember this preference?\n\n${content}`,
            spokenPrompt: `I can remember that ${toSecondPerson(content)}. Should I save it?`,
        },
    };
}

function handleForgetIntent(raw: string, lower: string): DetectedMemoryIntent {
    const memories = memoryService.getAll({ enabledOnly: true });
    if (memories.length === 0) {
        return {
            isMemoryIntent: true,
            isRejectedSensitive: false,
            proposal: {
                type: "delete",
                memory: { category: "GENERAL_FACT", content: "" },
                promptPreview: "You have no saved memories to forget.",
                spokenPrompt: "You don't have any saved memories to forget.",
            },
        };
    }

    // Broad forget requests: "forget everything", "forget all memories"
    if (lower.includes("everything") || lower.includes("all memories") || lower.includes("all my memories")) {
        let targetMemories = memories;
        let queryTerm = "";
        const aboutMatch = raw.match(/(?:everything|all\s+memories|all\s+my\s+memories)\s+(?:you\s+remember\s+)?about\s+(.+)$/i);
        if (aboutMatch && aboutMatch[1]) {
            queryTerm = aboutMatch[1].trim();
            if (queryTerm.length > 2) {
                targetMemories = memoryService.findRelevantMemories(queryTerm).map((m) => memoryService.getById(m.id)!).filter(Boolean);
            }
        }

        if (targetMemories.length === 0) {
            return {
                isMemoryIntent: true,
                isRejectedSensitive: false,
                proposal: {
                    type: "delete",
                    memory: { category: "GENERAL_FACT", content: "" },
                    promptPreview: `No saved memories found matching "${queryTerm}".`,
                    spokenPrompt: `I couldn't find any saved memories matching that description.`,
                },
            };
        }

        return {
            isMemoryIntent: true,
            isRejectedSensitive: false,
            proposal: {
                type: "delete_all",
                memory: { category: "GENERAL_FACT", content: `All (${targetMemories.length}) matching memories` },
                targetMemories,
                promptPreview: `Forget ${targetMemories.length} saved memory item(s)?\n\n${targetMemories.map((m, i) => `${i + 1}. ${m.content}`).join("\n")}`,
                spokenPrompt: `Would you like me to forget ${targetMemories.length} saved memories?`,
            },
        };
    }

    // Specific forget request: extract search query
    const targetQuery = raw
        .replace(/^(?:hey\s+alfred[,\s]*)?(?:please\s+)?(?:forget\s+(?:that\s+|my\s+|this\s+|the\s+)?|remove\s+(?:that|the)?\s*memory\s*about\s*|delete\s+(?:that|the)?\s*memory\s*about\s*)/i, "")
        .replace(/\s+preference\s*$/i, "")
        .trim();

    const matches = memoryService.findRelevantMemories(targetQuery);
    const target = matches.length > 0 ? memoryService.getById(matches[0].id) : memories[0];

    if (!target) {
        return {
            isMemoryIntent: true,
            isRejectedSensitive: false,
            proposal: {
                type: "delete",
                memory: { category: "GENERAL_FACT", content: "" },
                promptPreview: `No saved memory found matching "${targetQuery}".`,
                spokenPrompt: `I couldn't find any saved memory matching that.`,
            },
        };
    }

    return {
        isMemoryIntent: true,
        isRejectedSensitive: false,
        proposal: {
            type: "delete",
            memory: { category: target.category, content: target.content },
            existingMemory: target,
            targetMemories: [target],
            promptPreview: `Forget this memory?\n\n${target.content}`,
            spokenPrompt: `Would you like me to forget that ${toSecondPerson(target.content)}?`,
        },
    };
}

function handleUpdateIntent(newTarget: string, raw: string): DetectedMemoryIntent {
    const sensitive = detectSensitiveData(newTarget);
    if (sensitive.isSensitive) {
        return {
            isMemoryIntent: true,
            isRejectedSensitive: true,
            explanation: sensitive.safeExplanation || "I can't save passwords or API keys as ALFRED memory.",
        };
    }

    const matches = memoryService.findRelevantMemories(newTarget);
    const existing = matches.length > 0 ? memoryService.getById(matches[0].id) : undefined;
    const category = categorizeMemoryContent(newTarget);
    const formatted = formatMemoryContent(newTarget);

    if (existing) {
        return {
            isMemoryIntent: true,
            isRejectedSensitive: false,
            proposal: {
                type: "update",
                memory: { category, content: formatted },
                existingMemory: existing,
                promptPreview: `Update your saved preference to:\n\n${formatted}`,
                spokenPrompt: `Would you like me to update your saved preference to ${toSecondPerson(formatted)}?`,
            },
        };
    }

    return {
        isMemoryIntent: true,
        isRejectedSensitive: false,
        proposal: {
            type: "create",
            memory: { category, content: formatted },
            promptPreview: `Save this preference?\n\n${formatted}`,
            spokenPrompt: `Would you like me to save that ${toSecondPerson(formatted)}?`,
        },
    };
}

function categorizeMemoryContent(content: string): MemoryCategory {
    const lower = content.toLowerCase();
    if (lower.includes("workspace") || lower.includes("desktop") || lower.includes("environment")) {
        return "WORKSPACE_PREFERENCE";
    }
    if (lower.includes("project") || lower.includes("repo") || lower.includes("codebase")) {
        return "PROJECT_PREFERENCE";
    }
    if (lower.includes("focus") || lower.includes("session") || lower.includes("minute") || lower.includes("break") || lower.includes("routine")) {
        return "WORKFLOW_PREFERENCE";
    }
    if (lower.includes("vs code") || lower.includes("browser") || lower.includes("terminal") || lower.includes("app") || lower.includes("editor")) {
        return "USER_PREFERENCE";
    }
    return "GENERAL_FACT";
}

function formatMemoryContent(text: string): string {
    let cleaned = text.trim();
    // Capitalize first character
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    // Ensure terminal period
    if (!/[.!?]$/.test(cleaned)) {
        cleaned += ".";
    }
    return cleaned;
}

function toSecondPerson(text: string): string {
    return text
        .replace(/^i\s+prefer\b/i, "you prefer")
        .replace(/^i\s+use\b/i, "you use")
        .replace(/^my\s+/i, "your ")
        .replace(/\bmy\b/gi, "your")
        .replace(/\bme\b/gi, "you")
        .replace(/\.$/, "");
}
