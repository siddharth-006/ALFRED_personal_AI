"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.showTasksTool = void 0;
const logger_1 = require("../../../utils/logger");
/**
 * show_tasks tool adapter (Phase 3.3 - Step 1)
 *
 * Query task routing and view metadata for pending/today's tasks.
 */
exports.showTasksTool = {
    name: "show_tasks",
    description: "Query and view pending or today's ALFRED missions and tasks",
    category: "tasks",
    execute: (input) => {
        const filter = input?.filter || "pending";
        logger_1.logger.info(`show_tasks tool: Querying tasks with filter '${filter}'...`);
        return {
            success: true,
            data: {
                filter,
                targetPath: "/tasks",
            },
        };
    },
};
