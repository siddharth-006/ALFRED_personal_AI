import { ToolDefinition, ToolResult, ToolExecutionOptions } from "./types";
import { logger } from "../../utils/logger";

/**
 * Tool Registry (Phase 3.3 - Step 1)
 *
 * Centralized registry for ALFRED tools. Ensures tools are explicitly registered,
 * prevents duplicate registrations, rejects unknown tools, and validates tool arguments
 * before execution.
 *
 * Serves as the controlled security boundary between future AI reasoning and system execution.
 */
export class ToolRegistry {
    private tools: Map<string, ToolDefinition> = new Map();

    /**
     * Registers a new tool into the Tool Registry.
     * Throws an error if a tool with the same name is already registered or invalid.
     *
     * @param tool ToolDefinition object
     */
    public register(tool: ToolDefinition): void {
        if (!tool || typeof tool !== "object") {
            throw new Error("Tool Registry Error: Tool definition must be an object.");
        }
        if (!tool.name || typeof tool.name !== "string" || !tool.name.trim()) {
            throw new Error("Tool Registry Error: Tool must have a non-empty string name.");
        }

        const name = tool.name.trim();

        if (this.tools.has(name)) {
            throw new Error(`Tool Registry Error: A tool with the name '${name}' is already registered.`);
        }

        if (typeof tool.execute !== "function") {
            throw new Error(`Tool Registry Error: Tool '${name}' must provide an execute function.`);
        }

        this.tools.set(name, tool);
        logger.info(`ToolRegistry: Registered tool '${name}' (${tool.category})`);
    }

    /**
     * Retrieves a registered tool definition by name.
     * @param name Tool name
     */
    public get(name: string): ToolDefinition | undefined {
        return this.tools.get(name);
    }

    /**
     * Returns a list of all registered tools.
     */
    public list(): ToolDefinition[] {
        return Array.from(this.tools.values());
    }

    /**
     * Checks if a tool with the specified name is registered.
     * @param name Tool name
     */
    public has(name: string): boolean {
        return this.tools.has(name);
    }

    /**
     * Unregisters a tool by name (primarily for testing and reset purposes).
     * @param name Tool name
     */
    public unregister(name: string): boolean {
        return this.tools.delete(name);
    }

    /**
     * Clears all registered tools (for test suite resets).
     */
    public clear(): void {
        this.tools.clear();
    }

    /**
     * Safely executes a registered tool by name with input validation.
     * Enforces explicit registration, rejects unknown tools, and validates arguments.
     *
     * @param name Tool name
     * @param input Arguments for the tool
     * @param options Execution options (e.g. { isMock: true })
     */
    public async execute<TOutput = unknown>(
        name: string,
        input?: unknown,
        options?: ToolExecutionOptions
    ): Promise<ToolResult<TOutput>> {
        if (typeof name !== "string" || !name.trim()) {
            return {
                success: false,
                error: "Tool Execution Error: Tool name must be a non-empty string.",
            };
        }

        const toolName = name.trim();
        const tool = this.get(toolName);

        if (!tool) {
            logger.warn(`ToolRegistry: Attempted execution of unknown tool '${toolName}'.`);
            return {
                success: false,
                error: `Tool Execution Error: Unknown tool '${toolName}'. Tool is not registered in ALFRED Tool Registry.`,
            };
        }

        // Validate input if validator function provided
        if (typeof tool.validateInput === "function") {
            const validation = tool.validateInput(input);
            if (!validation.valid) {
                logger.warn(`ToolRegistry: Input validation failed for tool '${toolName}': ${validation.error}`);
                return {
                    success: false,
                    error: `Tool Validation Error (${toolName}): ${validation.error || "Invalid arguments provided."}`,
                };
            }
        }

        try {
            logger.info(`ToolRegistry: Executing tool '${toolName}'...`);
            const result = await tool.execute(input, options);
            return result as ToolResult<TOutput>;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unhandled execution error";
            logger.error(`ToolRegistry: Unhandled error executing tool '${toolName}': ${message}`);
            return {
                success: false,
                error: `Tool Runtime Error (${toolName}): ${message}`,
            };
        }
    }
}

export const toolRegistry = new ToolRegistry();
