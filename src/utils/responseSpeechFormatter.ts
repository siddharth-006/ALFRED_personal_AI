/**
 * ALFRED Phase 5.4C: Response Speech Formatter
 * Sanitizes and converts command execution outcomes, conversational answers, and
 * tool results into safe, human-friendly, concise spoken responses.
 *
 * Strictly prevents speaking:
 * - raw internal tool arguments
 * - raw JSON plans
 * - internal debugging output
 * - stack traces
 * - security validation details
 * - sensitive internal metadata
 */

export interface SpokenFormatOptions {
    maxSentences?: number;
    maxLength?: number;
}

/**
 * Clean markdown symbols, bullets, URLs, code fences, and symbols into clean natural speech text.
 */
export function sanitizeTextForSpeech(raw: string): string {
    if (!raw) return "";

    let text = raw;

    // 1. Remove fenced code blocks completely
    text = text.replace(/```[\s\S]*?```/g, "");

    // 2. Remove inline code ticks
    text = text.replace(/`([^`]+)`/g, "$1");

    // 3. Remove raw JSON structures: { ... }
    text = text.replace(/\{[\s\S]*?\}/g, "");

    // 4. Remove secret tokens like sk-..., apiKey, passwords, tokens
    text = text.replace(/(?:sk-[a-zA-Z0-9_\-]+|[a-zA-Z0-9_\-]{24,})/g, "");

    // 5. Remove URLs
    text = text.replace(/https?:\/\/[^\s]+/gi, "");

    // 6. Remove file path prefixes like file:/// or D:\...
    text = text.replace(/[a-zA-Z]:\\[^\s]+/g, "");

    // 7. Clean markdown headers, bold, italics, bullets
    text = text.replace(/^#+\s+/gm, "");
    text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
    text = text.replace(/\*([^*]+)\*/g, "$1");
    text = text.replace(/__([^_]+)__/g, "$1");
    text = text.replace(/_([^_]+)_/g, "$1");
    text = text.replace(/^[•\*\-\+]\s+/gm, "");

    // 8. Remove any remaining raw braces or brackets
    text = text.replace(/[{}[\]"]/g, " ");

    // 9. Replace multiple whitespace / newlines with single space
    text = text.replace(/\r?\n+/g, ". ");
    text = text.replace(/\s+/g, " ");

    // 10. Clean up double periods or punctuation artifacts
    text = text.replace(/\.{2,}/g, ".");
    text = text.replace(/\s*([.,?!])\s*/g, "$1 ");

    return text.trim();
}

/**
 * Format a CommandExecutionResult into a safe, concise, conversational spoken string.
 */
export function formatSpokenResponse(result: any, _rawPrompt?: string): string | null {
    void _rawPrompt;
    if (!result) return null;

    // Phase 5.7: Memory Proposal & Confirmation Speech (Section 20)
    // Must be checked BEFORE the generic confirmation gate since memory proposals also set requiresConfirmation
    if (result.intent === "memory_proposal" || result.memoryProposal) {
        if (result.spokenPrompt) {
            return sanitizeTextForSpeech(result.spokenPrompt);
        }
        if (result.memoryProposal?.spokenPrompt) {
            return sanitizeTextForSpeech(result.memoryProposal.spokenPrompt);
        }
        if (result.answerText) {
            return sanitizeTextForSpeech(result.answerText);
        }
        return "I can save this preference. Would you like me to proceed?";
    }

    // 1. Confirmation Required Gate (Do NOT speak a false success before user confirmation!)
    if (result.requiresConfirmation) {
        if (result.agenticPlan?.spokenPrompt) {
            return result.agenticPlan.spokenPrompt;
        }
        if (result.explanation && typeof result.explanation === "string" && !result.explanation.includes("{")) {
            const cleanSummary = sanitizeTextForSpeech(result.explanation);
            return `I need your confirmation before proceeding. ${cleanSummary}`;
        }
        return "I need your confirmation before making those changes.";
    }

    if (result.intent === "memory_confirmed") {
        if (result.spokenPrompt) {
            return sanitizeTextForSpeech(result.spokenPrompt);
        }
        if (result.answerText) {
            return sanitizeTextForSpeech(result.answerText);
        }
        return "Saved.";
    }

    // 2. Explicit Cancellation
    if (result.cancelled) {
        if (result.answerText) {
            return sanitizeTextForSpeech(result.answerText);
        }
        return "Action execution cancelled.";
    }

    // Phase 5.8B: Morning Briefing Spoken Summary
    if (result.intent === "briefing" || result.briefing) {
        if (result.spokenPrompt) {
            return sanitizeTextForSpeech(result.spokenPrompt);
        }
        if (result.briefing?.spokenSummary) {
            return sanitizeTextForSpeech(result.briefing.spokenSummary);
        }
        if (result.answerText) {
            const clean = sanitizeTextForSpeech(result.answerText);
            const sentences = clean.split(/(?<=[.?!])\s+/);
            return sentences.slice(0, 3).join(" ");
        }
        return "Good morning. Here is your operational briefing.";
    }

    // 3. Recommendation Advisory Mode (Phase 5.5B)
    if (result.intent === "recommendation" || (result.recommendations && result.recommendations.length > 0)) {
        if (result.recommendations && result.recommendations.length > 0) {
            const top = result.recommendations[0];
            const cleanRationale = sanitizeTextForSpeech(top.rationale);
            const cleanTitle = sanitizeTextForSpeech(top.title.replace(/^(prioritize|work on|review|continue|advance)\s+/i, ""));
            if (result.recommendations.length === 1) {
                return `You could ${cleanTitle}. ${cleanRationale}`;
            }
            const second = result.recommendations[1];
            const cleanTitle2 = sanitizeTextForSpeech(second.title.replace(/^(prioritize|work on|review|continue|advance)\s+/i, ""));
            return `You could ${cleanTitle} because ${cleanRationale.charAt(0).toLowerCase() + cleanRationale.slice(1)} Alternatively, you could ${cleanTitle2}.`;
        }
        if (result.answerText) {
            const clean = sanitizeTextForSpeech(result.answerText);
            const sentences = clean.split(/(?<=[.?!])\s+/);
            return sentences.slice(0, 2).join(" ");
        }
        return "You have no urgent tasks or deadlines right now. All caught up!";
    }

    // 4. Conversational AI Answer Mode
    if (result.answerText || result.responseType === "answer" || result.intent === "answer") {
        const raw = result.answerText || result.explanation || "";
        const clean = sanitizeTextForSpeech(raw);
        if (clean) {
            // Keep first 2-3 sentences for natural speech brevity
            const sentences = clean.split(/(?<=[.?!])\s+/);
            const truncated = sentences.slice(0, 3).join(" ");
            return truncated.length > 250 ? truncated.slice(0, 247) + "..." : truncated;
        }
        return "I have processed your query.";
    }

    // 4. Application Launch
    if (result.intent === "launch_application") {
        const app = result.appName || result.target || "application";
        if (result.success && !result.error) {
            return `Opening ${app}.`;
        } else {
            return `I could not launch ${app}.`;
        }
    }

    // 5. Workspace Launch
    if (result.intent === "launch_workspace") {
        const wsName = result.appName || result.target || "workspace";
        if (result.success && !result.error) {
            return `Launching workspace: ${wsName}.`;
        } else {
            return `Workspace ${wsName} was not found.`;
        }
    }

    // 6. Navigation
    if (result.intent === "navigate") {
        const target = result.appName || result.target || "destination";
        return `Navigating to ${target}.`;
    }

    // 7. System Status
    if (result.intent === "system_status") {
        return "All systems nominal. CPU and memory are running optimally.";
    }

    // 8. Deep Work / Focus Mode
    if (result.intent === "start_deep_work") {
        return "Deep Work session initiated. Focus mode engaged.";
    }

    // 9. Task Management
    if (result.intent === "show_tasks") {
        return "Displaying your active tasks.";
    }
    if (result.intent === "create_task") {
        const taskObj = result.task || result.data?.task;
        const taskName = taskObj?.text || result.appName || "task";
        return `Task created: ${taskName}.`;
    }
    if (result.intent === "complete_task") {
        const taskObj = result.task || result.data?.task;
        const taskName = taskObj?.text || result.appName || "task";
        return `Task completed: ${taskName}.`;
    }

    // 10. Goals & Projects
    if (result.intent === "create_goal") {
        const goalObj = result.goal || result.data?.goal;
        const title = goalObj?.title || result.appName || "goal";
        return `Goal initialized: ${title}.`;
    }
    if (result.intent === "update_goal") {
        const goalObj = result.goal || result.data?.goal;
        const title = goalObj?.title || result.appName || "goal";
        return `Goal updated: ${title}.`;
    }
    if (result.intent === "update_project") {
        const projObj = result.project || result.data?.project;
        const name = projObj?.name || result.appName || "project";
        return `Project updated: ${name}.`;
    }

    // 11. Multi-step Execution Summary
    if (result.steps && result.steps.length > 1) {
        if (result.success) {
            return `Completed ${result.steps.length} actions successfully.`;
        } else {
            return "Some actions in the planned sequence could not be completed.";
        }
    }

    // 12. Safe Failure or Error Message
    if (!result.success || result.error) {
        if (result.intent === "unknown") {
            return "Command not recognized.";
        }
        const err = result.explanation || result.error;
        if (err && typeof err === "string" && !err.includes("Error:") && !err.includes("at ")) {
            return sanitizeTextForSpeech(err);
        }
        return "The requested directive could not be completed.";
    }

    // 13. General explanation fallback
    if (result.explanation && typeof result.explanation === "string") {
        return sanitizeTextForSpeech(result.explanation);
    }

    return "Directive executed.";
}
