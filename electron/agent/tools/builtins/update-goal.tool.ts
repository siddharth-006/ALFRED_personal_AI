import { ToolDefinition, ToolResult } from "../types";
import { goalService, Goal } from "../../../services/goal.service";
import { logger } from "../../../utils/logger";

export interface UpdateGoalInput {
    goalId: string;
    id?: string;
    title?: string;
    target?: number;
    current?: number;
    completed?: boolean;
}

export interface UpdateGoalOutput {
    goal: Goal;
}

const DANGEROUS_SHELL_REGEX = /[;&|`$()<>{}\n\r]/;

/**
 * update_goal tool adapter (Phase 4.12)
 *
 * Safely updates an existing ALFRED goal using its goal ID.
 */
export const updateGoalTool: ToolDefinition<UpdateGoalInput, UpdateGoalOutput> = {
    name: "update_goal",
    description: "Update an existing ALFRED goal using its goal ID",
    category: "goals",
    validateInput: (input: unknown) => {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return { valid: false, error: "Input must be an object containing a 'goalId' property." };
        }

        const obj = input as Record<string, unknown>;

        // Only allowed fields
        const allowedFields = new Set(["goalId", "id", "title", "target", "current", "completed"]);
        for (const key of Object.keys(obj)) {
            if (!allowedFields.has(key)) {
                return { valid: false, error: `Disallowed or unsupported field '${key}' in update_goal input.` };
            }
        }

        const rawId = obj.goalId ?? obj.id;
        if (typeof rawId !== "string" && typeof rawId !== "number") {
            return { valid: false, error: "Goal 'goalId' property is required." };
        }

        const idStr = String(rawId).trim();
        if (!idStr) {
            return { valid: false, error: "Goal 'goalId' cannot be empty." };
        }

        if (DANGEROUS_SHELL_REGEX.test(idStr)) {
            return { valid: false, error: "Goal ID contains disallowed special characters." };
        }

        if (obj.title !== undefined) {
            if (typeof obj.title !== "string" || !obj.title.trim()) {
                return { valid: false, error: "Goal 'title' must be a non-empty string." };
            }
            if (DANGEROUS_SHELL_REGEX.test(obj.title)) {
                return { valid: false, error: "Goal title contains disallowed special characters." };
            }
        }

        if (obj.target !== undefined) {
            if (typeof obj.target !== "number" || isNaN(obj.target) || !isFinite(obj.target) || obj.target <= 0) {
                return { valid: false, error: "Goal 'target' must be a positive finite number." };
            }
        }

        if (obj.current !== undefined) {
            if (typeof obj.current !== "number" || isNaN(obj.current) || !isFinite(obj.current) || obj.current < 0) {
                return { valid: false, error: "Goal 'current' must be a non-negative finite number." };
            }
        }

        if (obj.completed !== undefined) {
            if (typeof obj.completed !== "boolean") {
                return { valid: false, error: "Goal 'completed' must be a boolean." };
            }
        }

        return { valid: true };
    },
    execute: (input: UpdateGoalInput): ToolResult<UpdateGoalOutput> => {
        const goalId = String(input.goalId || input.id || "").trim();
        logger.info(`update_goal tool: Updating goal ID "${goalId}"...`);

        const updates: { title?: string; target?: number; current?: number; completed?: boolean } = {};
        if (input.title !== undefined) updates.title = input.title;
        if (input.target !== undefined) updates.target = input.target;
        if (input.current !== undefined) updates.current = input.current;
        if (input.completed !== undefined) updates.completed = input.completed;

        const result = goalService.updateGoal(goalId, updates);

        if (!result.success || !result.goal) {
            return {
                success: false,
                error: result.error || `Goal with ID '${goalId}' not found.`,
            };
        }

        return {
            success: true,
            data: { goal: result.goal },
        };
    },
};
