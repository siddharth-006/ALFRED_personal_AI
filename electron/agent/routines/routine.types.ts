/**
 * ALFRED Phase 5.8A — Daily Routine Engine Types
 *
 * Defines strongly typed models for reusable, deterministic daily routines,
 * routine steps, dependency ordering, and natural language resolution.
 */

export interface RoutineStep {
    /** Unique step identifier within the routine (e.g. "step-1") */
    id: string;
    /** Registered tool name in ToolRegistry (e.g. "launch_workspace", "launch_application", "start_deep_work") */
    toolName: string;
    /** Strongly-typed arguments passed to the tool */
    args: Record<string, unknown>;
    /** Optional 0-indexed indices of prerequisite steps that must succeed first */
    dependsOn?: number[];
}

export interface Routine {
    /** Unique routine ID (e.g. "routine_coding_mode") */
    id: string;
    /** Human-readable routine display name */
    name: string;
    /** Human-readable description of what this routine configures */
    description: string;
    /** Natural language phrases and synonyms that trigger this routine */
    aliases: string[];
    /** Sequential sequence of steps forming the routine */
    steps: RoutineStep[];
    /** Whether this routine is active and available */
    enabled: boolean;
}

export interface RoutineResolutionResult {
    /** Whether a single routine was successfully resolved */
    matched: boolean;
    /** The resolved routine, if matched */
    routine?: Routine;
    /** Whether the request matched multiple routines and requires clarification */
    ambiguous?: boolean;
    /** Candidate routines when ambiguous */
    candidates?: Routine[];
    /** Clarification prompt to return to the user if ambiguous */
    clarificationPrompt?: string;
    /** Whether the user asked to list available routines */
    isListRequest?: boolean;
    /** Human-readable explanation */
    explanation?: string;
}
