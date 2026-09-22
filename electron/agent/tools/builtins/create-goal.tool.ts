import { ToolDefinition, ToolResult } from "../types";
import { goalService, Goal, GoalType } from "../../../services/goal.service";
import { logger } from "../../../utils/logger";

export interface CreateGoalInput {
    title: string;
    type?: GoalType;
    target?: number;
}

export interface CreateGoalOutput {
    goal: Goal;
}

const DANGEROUS_SHELL_REGEX = /[;&|`$()<>{}\n\r]/;

/**
 * create_goal tool adapter (Phase 4.12)
 *
 * Safely creates a single goal in ALFRED with validated title, type, and target.
 */
export const createGoalTool: ToolDefinition<CreateGoalInput, CreateGoalOutput> = {
    name: "create_goal",
    description: "Create a new goal in ALFRED Mission Control",
    category: "goals",
    validateInput: (input: unknown) => {
        if (!input || typeof input !== "object" || Array.isArray(input)) {
            return { valid: false, error: "Input must be an object containing a 'title' property." };
        }

        const obj = input as Record<string, unknown>;

        // Reject unknown / invented fields (like deadline, priority, description)
        const allowedFields = new Set(["title", "type", "target"]);
        for (const key of Object.keys(obj)) {
            if (!allowedFields.has(key)) {
                return { valid: false, error: `Disallowed or invented field '${key}' in create_goal input.` };
            }
        }

        if (typeof obj.title !== "string" || !obj.title.trim()) {
            return { valid: false, error: "Goal 'title' property is required and cannot be empty." };
        }

        if (DANGEROUS_SHELL_REGEX.test(obj.title)) {
            return { valid: false, error: "Goal title contains disallowed special characters." };
        }

        if (obj.type !== undefined) {
            if (typeof obj.type !== "string" || (obj.type !== "Weekly" && obj.type !== "Monthly")) {
                return { valid: false, error: "Goal 'type' must be 'Weekly' or 'Monthly'." };
            }
        }

        if (obj.target !== undefined) {
            if (typeof obj.target !== "number" || isNaN(obj.target) || !isFinite(obj.target) || obj.target <= 0) {
                return { valid: false, error: "Goal 'target' must be a positive finite number." };
            }
        }

        return { valid: true };
    },
    execute: (input: CreateGoalInput): ToolResult<CreateGoalOutput> => {
        const title = input.title.trim();
        const type = input.type === "Monthly" ? "Monthly" : "Weekly";
        const target = typeof input.target === "number" ? Math.floor(input.target) : 10;

        logger.info(`create_goal tool: Creating goal "${title}" (type: ${type}, target: ${target})...`);

        try {
            const goal = goalService.createGoal({ title, type, target });
            return {
                success: true,
                data: { goal },
            };
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error(`create_goal tool failed: ${msg}`);
            return {
                success: false,
                error: `Failed to create goal: ${msg}`,
            };
        }
    },
};
