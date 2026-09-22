/**
 * Tool System Architecture Types (Phase 3.3 - Step 1)
 *
 * Defines the core types and interfaces for ALFRED's Tool System.
 * Tools act as controlled boundaries between future AI reasoning and operating system/service execution.
 */

export type ToolCategory =
    | "application"
    | "navigation"
    | "system"
    | "workspace"
    | "tasks"
    | "goals"
    | "projects"
    | "utility";

export interface ToolResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface ToolExecutionOptions {
    isMock?: boolean;
    [key: string]: unknown;
}

export interface ToolDefinition<TInput = any, TOutput = any> {
    /** Unique identifier for the tool (e.g. "launch_application") */
    name: string;
    /** Human and LLM readable description of tool capability */
    description: string;
    /** Logical grouping category for the tool */
    category: ToolCategory;
    /** Optional input validation function before execution */
    validateInput?: (input: unknown) => { valid: boolean; error?: string };
    /**
     * Executes the tool capability using underlying ALFRED services/tools.
     * MUST NOT directly call child_process, spawn, exec, or arbitrary shell commands.
     */
    execute(input: TInput, options?: ToolExecutionOptions): Promise<ToolResult<TOutput>> | ToolResult<TOutput>;
}
