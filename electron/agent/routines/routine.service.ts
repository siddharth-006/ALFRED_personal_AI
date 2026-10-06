/**
 * ALFRED Phase 5.8A — Daily Routine Engine Service
 *
 * Reusable, deterministic Daily Routine Engine.
 * Orchestration layer only: converts resolved routines into validated AgentPlans
 * executed through the existing Agentic Planning, ConfirmationStore, and ToolRegistry pipeline.
 *
 * SECURITY GUARANTEES:
 * 1. Routine definitions never directly call child_process, spawn, exec, shell, or arbitrary JS/eval.
 * 2. Routine execution strictly routes through ToolRegistry.
 * 3. Every routine step must use an explicitly registered tool.
 * 4. Routine parameters are validated.
 * 5. Multi-step dependency ordering is enforced; failed steps stop dependent execution.
 * 6. Routines require confirmation before execution.
 */

import { Routine, RoutineResolutionResult, RoutineStep } from "./routine.types";
import { BUILTIN_ROUTINES } from "./routine-catalog";
import { toolRegistry } from "../tools/tool-registry";
import { AgentPlan } from "../orchestrator/types";
import { logger } from "../../utils/logger";

/** Shell metacharacters regex for parameter security validation */
const DANGEROUS_SHELL_REGEX = /[;&|`$()<>{}\\\n\r]/;

/** Conversational prefixes to strip from queries */
const CONVERSATIONAL_PREFIXES = [
    /^hey\s+alfred[,\s]*/i,
    /^alfred[,\s]*/i,
    /^can\s+you\s+(?:please\s+)?/i,
    /^could\s+you\s+(?:please\s+)?/i,
    /^would\s+you\s+(?:please\s+)?/i,
    /^please\s+/i,
    /^i\s+want\s+to\s+/i,
    /^i'd\s+like\s+to\s+/i,
    /^kindly\s+/i,
];

/** Routine listing query patterns */
const ROUTINE_LIST_PATTERNS = [
    /^(?:what|which)\s+routines\s+(?:do\s+you\s+have|are\s+available|exist|can\s+i\s+run)$/i,
    /^(?:what|which)\s+are\s+(?:the|your|available)\s+routines$/i,
    /^(?:list|show|display|get)\s+(?:all\s+)?(?:available\s+)?routines$/i,
    /^tell\s+me\s+(?:about\s+)?(?:your|the|available)\s+routines$/i,
    /^available\s+routines$/i,
    /^routines$/i,
];

/** Explicit single-step commands that must never be treated as routines */
const EXCLUDED_COMMAND_PATTERNS = [
    // Single application launches: "open VS Code", "launch Chrome"
    /^(?:open|launch|run|start)\s+(?:vs\s*code|chrome|spotify|discord|terminal|power\s*bi|notepad|calculator)$/i,
    // Single workspace commands: "open DSA workspace", "launch Data Science workspace"
    /^(?:open|launch)\s+(?:the\s+|my\s+)?[a-z0-9_\-\s]+?\s+workspace$/i,
    // Single queries / recommendations / memory
    /^(?:what\s+should\s+i\s+work\s+on|what\s+should\s+i\s+focus\s+on|recommend\s+something|how\s+many\s+tasks)/i,
    /^(?:remember\s+that|forget\s+that|update\s+memory)/i,
    // System status
    /^system\s+(?:status|vitals)$/i,
    // Simple single mutations
    /^(?:create|add)\s+(?:a\s+)?task\b/i,
    /^(?:create|add)\s+(?:a\s+)?goal\b/i,
];

/** Ambiguous / overly generic routine requests that require clarification */
const AMBIGUOUS_ROUTINE_PATTERNS = [
    /^(?:start|launch|run|activate|execute|prepare)\s+(?:a\s+|the\s+|my\s+)?(?:mode|routine)$/i,
    /^(?:prepare)\s+(?:the\s+|my\s+)?(?:workspace|environment|setup)$/i,
    /^(?:mode|routine)$/i,
];

export class RoutineService {
    private routines: Routine[] = [];

    constructor(initialRoutines?: Routine[]) {
        this.routines = initialRoutines
            ? initialRoutines.map((r) => this.cloneRoutine(r))
            : BUILTIN_ROUTINES.map((r) => this.cloneRoutine(r));
    }

    /**
     * Resets routines to initial catalog or custom list (used in tests).
     */
    public reset(routines?: Routine[]): void {
        this.routines = routines
            ? routines.map((r) => this.cloneRoutine(r))
            : BUILTIN_ROUTINES.map((r) => this.cloneRoutine(r));
    }

    /**
     * Returns a read-only copy of all enabled routines.
     */
    public getRoutines(): Routine[] {
        return this.routines
            .filter((r) => r.enabled)
            .map((r) => this.cloneRoutine(r));
    }

    /**
     * Retrieves a routine by ID.
     */
    public getRoutineById(id: string): Routine | undefined {
        const found = this.routines.find((r) => r.id === id);
        return found ? this.cloneRoutine(found) : undefined;
    }

    /**
     * Evaluates whether a prompt is a read-only routine listing query.
     */
    public isRoutineListQuery(prompt: string): boolean {
        if (!prompt || typeof prompt !== "string") return false;
        const clean = this.cleanPrompt(prompt);
        return ROUTINE_LIST_PATTERNS.some((pat) => pat.test(clean));
    }

    /**
     * Formats available routines for display in the terminal.
     */
    public formatRoutinesList(routines: Routine[]): string {
        const lines: string[] = ["Here are the available routines:"];
        for (const r of routines) {
            lines.push(`- ${r.name}`);
        }
        return lines.join("\n");
    }

    /**
     * Formats natural speech summary for TTS without exposing paths, IDs, or raw JSON.
     */
    public formatRoutinesSpoken(routines: Routine[]): string {
        if (!routines || routines.length === 0) {
            return "No daily routines are currently configured.";
        }
        const names = routines.map((r) => r.name);
        if (names.length === 1) {
            return `The available routine is ${names[0]}.`;
        }
        const last = names.pop();
        return `Available routines are ${names.join(", ")}, and ${last}.`;
    }

    /**
     * Deterministically resolves a user prompt to a matching Routine.
     * Prevents arbitrary guessing and returns clarification if ambiguous.
     */
    public resolveRoutine(prompt: string): RoutineResolutionResult {
        if (!prompt || typeof prompt !== "string") {
            return { matched: false };
        }

        if (this.isRoutineListQuery(prompt)) {
            return {
                matched: false,
                isListRequest: true,
                explanation: this.formatRoutinesList(this.getRoutines()),
            };
        }

        const clean = this.cleanPrompt(prompt);
        const lower = clean.toLowerCase();

        // 1. Guard against simple commands that must never be treated as routines
        for (const pattern of EXCLUDED_COMMAND_PATTERNS) {
            if (pattern.test(clean)) {
                return { matched: false };
            }
        }

        const activeRoutines = this.routines.filter((r) => r.enabled);

        // 2. Ambiguity check for overly generic queries ("start mode", "start routine", "prepare workspace")
        for (const ambigPat of AMBIGUOUS_ROUTINE_PATTERNS) {
            if (ambigPat.test(clean)) {
                return this.buildAmbiguousResult(activeRoutines, prompt);
            }
        }

        // 3. Direct Alias Match
        const exactAliasMatches = activeRoutines.filter((r) =>
            r.aliases.some((alias) => alias.toLowerCase() === lower)
        );
        if (exactAliasMatches.length === 1) {
            return { matched: true, routine: this.cloneRoutine(exactAliasMatches[0]) };
        }
        if (exactAliasMatches.length > 1) {
            return this.buildAmbiguousResult(exactAliasMatches, prompt);
        }

        // 4. Direct Name Match (e.g. "Coding Mode", "Data Science Mode")
        const exactNameMatches = activeRoutines.filter(
            (r) => r.name.toLowerCase() === lower
        );
        if (exactNameMatches.length === 1) {
            return { matched: true, routine: this.cloneRoutine(exactNameMatches[0]) };
        }

        // 5. Normalized Directive Matching
        // E.g. "start coding mode", "start coding", "prepare my coding workspace", "start dsa mode", "start coding for 45 minutes", "start coding again"
        let stripped = lower
            .replace(/\bfor\s+\d+\s*(?:minutes?|mins?)\b/i, "")
            .replace(/\b\d+[- ]*(?:minutes?|mins?)\s+coding\b/i, "coding")
            .replace(/\b\d+[- ]*(?:minutes?|mins?)\s+session\b/i, "session")
            .replace(/\s+again\b/i, "");

        const normalized = stripped
            .replace(/^(?:start|launch|run|activate|execute|initiate|open|prepare|get\s+ready|begin)\s+(?:a\s+|my\s+|the\s+)?/i, "")
            .replace(/\s+(?:routine|mode|workspace|session|environment|setup)$/i, "")
            .trim();

        if (normalized) {
            const isVagueToken = /^(?:mode|routine|workspace|session|setup|environment|everything)$/i.test(normalized);
            if (isVagueToken) {
                return this.buildAmbiguousResult(activeRoutines, prompt);
            }

            const normalizedMatches = activeRoutines.filter((r) => {
                return r.aliases.some((a) => {
                    const cleanAlias = a
                        .replace(/^(?:start|launch|run|activate|execute|initiate|open|prepare|get\s+ready)\s+(?:my\s+|the\s+)?/i, "")
                        .replace(/\s+(?:routine|mode|workspace|session|environment|setup)$/i, "")
                        .trim()
                        .toLowerCase();
                    return cleanAlias === normalized;
                });
            });

            if (normalizedMatches.length === 1) {
                return { matched: true, routine: this.cloneRoutine(normalizedMatches[0]) };
            }
            if (normalizedMatches.length > 1) {
                return this.buildAmbiguousResult(normalizedMatches, prompt);
            }
        }

        return { matched: false };
    }

    /**
     * Validates a routine definition against strict security and ToolRegistry requirements.
     */
    public validateRoutine(routine: Routine): { valid: boolean; error?: string } {
        if (!routine || typeof routine !== "object") {
            return { valid: false, error: "Routine definition must be an object." };
        }

        if (!routine.id || typeof routine.id !== "string" || !routine.id.trim()) {
            return { valid: false, error: "Routine id is required." };
        }
        if (DANGEROUS_SHELL_REGEX.test(routine.id) || /[/\\]/.test(routine.id)) {
            return { valid: false, error: "Routine id contains invalid characters." };
        }

        if (!routine.name || typeof routine.name !== "string" || !routine.name.trim()) {
            return { valid: false, error: "Routine name is required." };
        }

        if (!Array.isArray(routine.steps) || routine.steps.length === 0) {
            return { valid: false, error: "Routine must contain at least one step." };
        }

        if (routine.steps.length > 5) {
            return { valid: false, error: "Routine exceeds maximum allowed steps (5)." };
        }

        // Validate each step
        for (let i = 0; i < routine.steps.length; i++) {
            const step = routine.steps[i];
            const stepErr = this.validateStep(step, i, routine.steps.length);
            if (stepErr) {
                return { valid: false, error: stepErr };
            }
        }

        return { valid: true };
    }

    /**
     * Validates a single routine step.
     */
    private validateStep(step: RoutineStep, index: number, totalSteps: number): string | null {
        if (!step || typeof step !== "object") {
            return `Step ${index + 1} must be an object.`;
        }

        if (!step.id || typeof step.id !== "string" || !step.id.trim()) {
            return `Step ${index + 1} id is required.`;
        }

        if (!step.toolName || typeof step.toolName !== "string" || !step.toolName.trim()) {
            return `Step ${index + 1} toolName is required.`;
        }

        // Enforce ToolRegistry tool whitelist
        if (!toolRegistry.has(step.toolName)) {
            return `Step ${index + 1} specifies unregistered tool: '${step.toolName}'.`;
        }

        const toolDef = toolRegistry.get(step.toolName);
        if (!toolDef) {
            return `Step ${index + 1} tool '${step.toolName}' definition not found.`;
        }

        // Validate step arguments
        const args = step.args || {};
        if (typeof args !== "object") {
            return `Step ${index + 1} arguments must be an object.`;
        }

        // Parameter security: Reject shell metacharacters in string arguments
        for (const [key, val] of Object.entries(args)) {
            if (typeof val === "string" && DANGEROUS_SHELL_REGEX.test(val)) {
                return `Step ${index + 1} argument '${key}' contains prohibited shell characters.`;
            }
        }

        // Tool-level argument validation if available
        if (toolDef.validateInput) {
            const inputVal = toolDef.validateInput(args);
            if (!inputVal.valid) {
                return `Step ${index + 1} (${step.toolName}) argument validation failed: ${inputVal.error}`;
            }
        }

        // Dependency validation
        if (step.dependsOn !== undefined) {
            if (!Array.isArray(step.dependsOn)) {
                return `Step ${index + 1} dependsOn must be an array of prior step indices.`;
            }

            for (const dep of step.dependsOn) {
                if (typeof dep !== "number" || !Number.isInteger(dep)) {
                    return `Step ${index + 1} dependency index must be an integer.`;
                }
                if (dep < 0 || dep >= totalSteps) {
                    return `Step ${index + 1} dependency index ${dep} out of range [0, ${totalSteps - 1}].`;
                }
                if (dep === index) {
                    return `Step ${index + 1} cannot depend on itself (cycle detected).`;
                }
                if (dep > index) {
                    return `Step ${index + 1} cannot depend on future step ${dep + 1} (forward reference).`;
                }
            }
        }

        return null;
    }

    /**
     * Converts a Routine into a strongly typed AgentPlan for AgenticPlannerService.
     */
    public routineToAgentPlan(routine: Routine, userRequest: string): AgentPlan {
        return {
            userRequest,
            type: "action",
            explanation: `Routine: ${routine.name} — ${routine.description}`,
            toolCalls: routine.steps.map((step, idx) => ({
                tool: step.toolName,
                arguments: { ...(step.args || {}) },
                dependsOn: step.dependsOn ? [...step.dependsOn] : (idx > 0 ? [idx - 1] : undefined),
            })),
        };
    }

    private buildAmbiguousResult(candidates: Routine[], prompt: string): RoutineResolutionResult {
        const names = candidates.map((c) => c.name);
        const last = names.length > 1 ? names.pop() : undefined;
        const formattedNames = last ? `${names.join(", ")}, and ${last}` : names[0];
        const clarificationPrompt = `I found multiple matching routines: ${formattedNames}. Which routine would you like me to start?`;

        logger.info(`RoutineService: Ambiguous routine query '${prompt}' matched: ${candidates.map((c) => c.name).join(", ")}`);

        return {
            matched: false,
            ambiguous: true,
            candidates: candidates.map((c) => this.cloneRoutine(c)),
            clarificationPrompt,
            explanation: clarificationPrompt,
        };
    }

    private cleanPrompt(prompt: string): string {
        let clean = prompt.trim();
        for (const prefix of CONVERSATIONAL_PREFIXES) {
            clean = clean.replace(prefix, "");
        }
        return clean.replace(/[.!?]+$/, "").trim();
    }

    private cloneRoutine(routine: Routine): Routine {
        return {
            ...routine,
            aliases: [...routine.aliases],
            steps: routine.steps.map((s) => ({
                ...s,
                args: { ...(s.args || {}) },
                dependsOn: s.dependsOn ? [...s.dependsOn] : undefined,
            })),
        };
    }
}

export const routineService = new RoutineService();
