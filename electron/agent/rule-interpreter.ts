import { ICommandInterpreter, StructuredAction } from "./types";

/**
 * Deterministic Rule-Based Command Interpreter (Phase 3.2 - Step 4 Expanded)
 *
 * Safely parses natural language user prompts into structured intents covering:
 * 1. Application Launching
 * 2. ALFRED Navigation
 * 3. System Status
 * 4. Deep Work / Focus Session
 * 5. Workspace Commands
 * 6. Task Information (Read-Only)
 */

/**
 * Shell metacharacters and dangerous tokens that immediately invalidate input.
 */
const SHELL_METACHARACTERS_REGEX = /[;&|`$()<>{}\\\n\r]/;

/**
 * Dangerous shell keywords to reject for security.
 */
const DANGEROUS_TOKENS_REGEX =
    /\b(rm|del|powershell|cmd|cmd\.exe|powershell\.exe|sudo|format|shutdown|drop|exec|eval)\b/i;

/**
 * Conversational prefix phrases to strip away before intent detection.
 */
const CONVERSATIONAL_PREFIXES = [
    /^hey\s+alfred,?\s*/i,
    /^alfred,?\s*/i,
    /^can\s+you\s+(please\s+)?/i,
    /^could\s+you\s+(please\s+)?/i,
    /^would\s+you\s+(please\s+)?/i,
    /^please\s+/i,
    /^i\s+want\s+to\s+/i,
    /^i'd\s+like\s+to\s+/i,
    /^kindly\s+/i,
];

/**
 * Known human-readable app target mappings for application launching.
 */
const HUMAN_APP_NAMES: Record<string, string> = {
    // Visual Studio Code
    "vs code": "VS Code",
    "vscode": "VS Code",
    "visual studio code": "VS Code",
    "vs_code": "VS Code",
    "vs-code": "VS Code",
    "code": "VS Code",

    // Google Chrome
    "chrome": "Chrome",
    "google chrome": "Chrome",
    "googlechrome": "Chrome",
    "google-chrome": "Chrome",
    "google_chrome": "Chrome",

    // Spotify
    "spotify": "Spotify",

    // Discord
    "discord": "Discord",

    // Windows Terminal
    "windows terminal": "Windows Terminal",
    "terminal": "Windows Terminal",
    "wt": "Windows Terminal",
    "windowsterminal": "Windows Terminal",
    "windows-terminal": "Windows Terminal",
    "windows_terminal": "Windows Terminal",

    // Power BI Desktop
    "power bi": "Power BI",
    "powerbi": "Power BI",
    "power bi desktop": "Power BI",
    "pbidesktop": "Power BI",
};

/**
 * Known workspace target mappings for launch_workspace intent.
 */
const WORKSPACE_TARGET_MAPPINGS: Record<string, string> = {
    "hackathon": "Hackathon",
    "hack": "Hackathon",
    "coding": "DSA",
    "dsa": "DSA",
    "code": "DSA",
    "problem solving": "DSA",
    "data science": "Data Science",
    "datascience": "Data Science",
    "data-science": "Data Science",
    "ds": "Data Science",
    "data science mode": "Data Science",
    "analytics": "Data Science",
    "machine learning": "Machine Learning",
    "machinelearning": "Machine Learning",
    "machine-learning": "Machine Learning",
    "ml": "Machine Learning",
    "college": "College",
    "personal": "Personal",
};

export class RuleCommandInterpreter implements ICommandInterpreter {
    public interpret(input: string): StructuredAction {
        const unknownResult: StructuredAction = { intent: "unknown", target: null };

        if (typeof input !== "string" || !input.trim()) {
            return unknownResult;
        }

        const rawInput = input.trim();

        // Security check 1: Reject shell metacharacters immediately
        if (SHELL_METACHARACTERS_REGEX.test(rawInput)) {
            return unknownResult;
        }

        // Security check 2: Reject dangerous shell tokens
        if (DANGEROUS_TOKENS_REGEX.test(rawInput)) {
            return unknownResult;
        }

        // Clean conversational prefixes and trailing punctuation
        let cleaned = rawInput;
        for (const prefix of CONVERSATIONAL_PREFIXES) {
            cleaned = cleaned.replace(prefix, "");
        }
        cleaned = cleaned.trim().replace(/[?.!,]+$/g, "").trim();
        const lowerCleaned = cleaned.toLowerCase();

        // 1. SYSTEM STATUS INTENT
        if (
            lowerCleaned === "system status" ||
            lowerCleaned === "show system status" ||
            lowerCleaned === "show my system status" ||
            lowerCleaned === "how is the system" ||
            lowerCleaned === "what's my system status" ||
            lowerCleaned === "whats my system status" ||
            lowerCleaned === "system vitals"
        ) {
            return { intent: "system_status", target: null };
        }

        // 2. DEEP WORK / FOCUS INTENT
        if (
            lowerCleaned === "start deep work" ||
            lowerCleaned === "start focus mode" ||
            lowerCleaned === "enable deep work" ||
            lowerCleaned === "i want to focus" ||
            lowerCleaned === "start my focus session" ||
            lowerCleaned === "deep work" ||
            lowerCleaned === "focus mode"
        ) {
            return { intent: "start_deep_work", target: null };
        }

        // 3. TASK INFORMATION INTENT (Read-Only Queries)
        if (
            lowerCleaned === "show today's tasks" ||
            lowerCleaned === "show todays tasks" ||
            lowerCleaned === "what are my pending tasks" ||
            lowerCleaned === "what do i need to do today" ||
            lowerCleaned === "pending tasks" ||
            lowerCleaned === "today's tasks" ||
            lowerCleaned === "show my tasks"
        ) {
            return { intent: "show_tasks", target: null };
        }

        // 4. WORKSPACE LAUNCH INTENT
        // e.g. "open my hackathon workspace", "start my coding workspace", "prepare my machine learning workspace", "start Data Science mode"
        const workspaceMatch = lowerCleaned.match(
            /^(?:open|start|launch|prepare|switch to|go to)\s+(?:my\s+|the\s+)?(.+?)(?:\s+(?:workspace|mode|environment|setup|session))?$/i
        );

        if (workspaceMatch && workspaceMatch[1]) {
            const rawWsCandidate = workspaceMatch[1]
                .trim()
                .toLowerCase()
                .replace(/\s+(?:workspace|mode|environment|setup|session)$/, "");
            if (WORKSPACE_TARGET_MAPPINGS[rawWsCandidate]) {
                return {
                    intent: "launch_workspace",
                    target: WORKSPACE_TARGET_MAPPINGS[rawWsCandidate],
                };
            }
        }

        // 5. NAVIGATION INTENT
        // Maps to Next.js routes: "missions" (/tasks), "goals" (/goals), "projects" (/projects), "workspaces" (/workspaces), "dashboard" (/)
        if (
            lowerCleaned === "open missions" ||
            lowerCleaned === "show missions" ||
            lowerCleaned === "go to missions" ||
            lowerCleaned === "open tasks" ||
            lowerCleaned === "go to tasks"
        ) {
            return { intent: "navigate", target: "missions" };
        }

        if (
            lowerCleaned === "open goals" ||
            lowerCleaned === "show my goals" ||
            lowerCleaned === "show goals" ||
            lowerCleaned === "go to goals"
        ) {
            return { intent: "navigate", target: "goals" };
        }

        if (
            lowerCleaned === "open projects" ||
            lowerCleaned === "show my projects" ||
            lowerCleaned === "show projects" ||
            lowerCleaned === "go to projects"
        ) {
            return { intent: "navigate", target: "projects" };
        }

        if (
            lowerCleaned === "open workspaces" ||
            lowerCleaned === "show my workspaces" ||
            lowerCleaned === "show workspaces" ||
            lowerCleaned === "go to workspaces"
        ) {
            return { intent: "navigate", target: "workspaces" };
        }

        if (
            lowerCleaned === "open dashboard" ||
            lowerCleaned === "show dashboard" ||
            lowerCleaned === "go home" ||
            lowerCleaned === "home"
        ) {
            return { intent: "navigate", target: "dashboard" };
        }

        // 6. APPLICATION LAUNCH INTENT
        // Launch verbs: "open", "launch", "start", "run", "fire up"
        const launchVerbs = ["open", "launch", "start", "run", "fire up"];
        let matchedVerb: string | null = null;

        for (const verb of launchVerbs) {
            if (lowerCleaned.startsWith(verb + " ")) {
                matchedVerb = verb;
                break;
            }
        }

        if (matchedVerb) {
            const rawTarget = cleaned.substring(matchedVerb.length).trim();
            if (rawTarget) {
                const lowerTarget = rawTarget.toLowerCase();
                if (HUMAN_APP_NAMES[lowerTarget]) {
                    return {
                        intent: "launch_application",
                        target: HUMAN_APP_NAMES[lowerTarget],
                    };
                }
            }
        }

        return unknownResult;
    }
}

export const ruleCommandInterpreter = new RuleCommandInterpreter();
