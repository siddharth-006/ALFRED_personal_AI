import { ToolDefinition, ToolResult } from "../types";
import { taskService, Task } from "../../../services/task.service";
import { logger } from "../../../utils/logger";

export interface CompleteTaskInput {
    taskId: string;
    id?: string;
}

export interface CompleteTaskOutput {
    task: Task;
}

const DANGEROUS_SHELL_REGEX = /[;&|`$()<>{}\n\r]/;

/**
 * complete_task tool adapter (Phase 4.11)
 *
 * Safely marks an existing task as completed in ALFRED.
 */
export const completeTaskTool: ToolDefinition<CompleteTaskInput, CompleteTaskOutput> = {
    name: "complete_task",
    description: "Mark an existing ALFRED task as completed using its task ID",
    category: "tasks",
    validateInput: (input: unknown) => {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return { valid: false, error: "Input must be an object containing a 'taskId' property." };
        }

        const obj = input as Record<string, unknown>;
        const rawTaskId = obj.taskId ?? obj.id;

        if (typeof rawTaskId !== "string" && typeof rawTaskId !== "number") {
            return { valid: false, error: "Task 'taskId' property is required." };
        }

        const taskIdStr = String(rawTaskId).trim();
        if (!taskIdStr) {
            return { valid: false, error: "Task 'taskId' cannot be empty." };
        }

        if (DANGEROUS_SHELL_REGEX.test(taskIdStr)) {
            return { valid: false, error: "Task ID contains disallowed special characters." };
        }

        return { valid: true };
    },
    execute: (input: CompleteTaskInput): ToolResult<CompleteTaskOutput> => {
        const taskId = String(input.taskId || input.id || "").trim();
        logger.info(`complete_task tool: Marking task ID "${taskId}" as completed...`);

        const result = taskService.completeTask(taskId);

        if (!result.success || !result.task) {
            return {
                success: false,
                error: result.error || `Task with ID '${taskId}' not found.`,
            };
        }

        return {
            success: true,
            data: { task: result.task },
        };
    },
};
