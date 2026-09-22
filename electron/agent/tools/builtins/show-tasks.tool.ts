import { ToolDefinition, ToolResult } from "../types";
import { logger } from "../../../utils/logger";

export interface ShowTasksInput {
    filter?: string;
}

export interface ShowTasksOutput {
    filter: string;
    targetPath: string;
}

/**
 * show_tasks tool adapter (Phase 3.3 - Step 1)
 *
 * Query task routing and view metadata for pending/today's tasks.
 */
export const showTasksTool: ToolDefinition<ShowTasksInput, ShowTasksOutput> = {
    name: "show_tasks",
    description: "Query and view pending or today's ALFRED missions and tasks",
    category: "tasks",
    execute: (input?: ShowTasksInput): ToolResult<ShowTasksOutput> => {
        const filter = input?.filter || "pending";
        logger.info(`show_tasks tool: Querying tasks with filter '${filter}'...`);

        return {
            success: true,
            data: {
                filter,
                targetPath: "/tasks",
            },
        };
    },
};
