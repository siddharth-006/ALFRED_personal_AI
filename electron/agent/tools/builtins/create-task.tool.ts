import { ToolDefinition, ToolResult } from "../types";
import { taskService, Task } from "../../../services/task.service";
import { logger } from "../../../utils/logger";

export interface CreateTaskInput {
    text: string;
    category?: string;
    title?: string;
}

export interface CreateTaskOutput {
    task: Task;
}

const DANGEROUS_SHELL_REGEX = /[;&|`$()<>{}\n\r]/;

/**
 * create_task tool adapter (Phase 4.11)
 *
 * Safely creates a single task in ALFRED with validated text and category.
 */
export const createTaskTool: ToolDefinition<CreateTaskInput, CreateTaskOutput> = {
    name: "create_task",
    description: "Create a new task in ALFRED Mission Control",
    category: "tasks",
    validateInput: (input: unknown) => {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return { valid: false, error: "Input must be an object containing a 'text' property." };
        }

        const obj = input as Record<string, unknown>;
        const rawText = obj.text ?? obj.title;

        if (typeof rawText !== "string" || !rawText.trim()) {
            return { valid: false, error: "Task 'text' property is required and cannot be empty." };
        }

        if (DANGEROUS_SHELL_REGEX.test(rawText)) {
            return { valid: false, error: "Task text contains disallowed special characters." };
        }

        if (obj.category !== undefined && typeof obj.category !== "string") {
            return { valid: false, error: "Task 'category' must be a string." };
        }

        if (typeof obj.category === "string" && DANGEROUS_SHELL_REGEX.test(obj.category)) {
            return { valid: false, error: "Task category contains disallowed special characters." };
        }

        return { valid: true };
    },
    execute: (input: CreateTaskInput): ToolResult<CreateTaskOutput> => {
        const text = (input.text || input.title || "").trim();
        const category = input.category ? input.category.trim() : "Personal";

        logger.info(`create_task tool: Creating task "${text}" in category "${category}"...`);

        try {
            const task = taskService.createTask(text, category);
            return {
                success: true,
                data: { task },
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create task";
            logger.error(`create_task tool error: ${message}`);
            return {
                success: false,
                error: message,
            };
        }
    },
};
