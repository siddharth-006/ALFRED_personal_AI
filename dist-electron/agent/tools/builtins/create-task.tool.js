"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskTool = void 0;
const task_service_1 = require("../../../services/task.service");
const logger_1 = require("../../../utils/logger");
const DANGEROUS_SHELL_REGEX = /[;&|`$()<>{}\n\r]/;
/**
 * create_task tool adapter (Phase 4.11)
 *
 * Safely creates a single task in ALFRED with validated text and category.
 */
exports.createTaskTool = {
    name: "create_task",
    description: "Create a new task in ALFRED Mission Control",
    category: "tasks",
    validateInput: (input) => {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return { valid: false, error: "Input must be an object containing a 'text' property." };
        }
        const obj = input;
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
    execute: (input) => {
        const text = (input.text || input.title || "").trim();
        const category = input.category ? input.category.trim() : "Personal";
        logger_1.logger.info(`create_task tool: Creating task "${text}" in category "${category}"...`);
        try {
            const task = task_service_1.taskService.createTask(text, category);
            return {
                success: true,
                data: { task },
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create task";
            logger_1.logger.error(`create_task tool error: ${message}`);
            return {
                success: false,
                error: message,
            };
        }
    },
};
