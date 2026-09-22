"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeTaskTool = void 0;
const task_service_1 = require("../../../services/task.service");
const logger_1 = require("../../../utils/logger");
const DANGEROUS_SHELL_REGEX = /[;&|`$()<>{}\n\r]/;
/**
 * complete_task tool adapter (Phase 4.11)
 *
 * Safely marks an existing task as completed in ALFRED.
 */
exports.completeTaskTool = {
    name: "complete_task",
    description: "Mark an existing ALFRED task as completed using its task ID",
    category: "tasks",
    validateInput: (input) => {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return { valid: false, error: "Input must be an object containing a 'taskId' property." };
        }
        const obj = input;
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
    execute: (input) => {
        const taskId = String(input.taskId || input.id || "").trim();
        logger_1.logger.info(`complete_task tool: Marking task ID "${taskId}" as completed...`);
        const result = task_service_1.taskService.completeTask(taskId);
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
