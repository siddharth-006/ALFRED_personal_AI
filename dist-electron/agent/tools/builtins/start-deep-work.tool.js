"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDeepWorkTool = void 0;
const logger_1 = require("../../../utils/logger");
/**
 * start_deep_work tool adapter (Phase 3.3 - Step 1)
 *
 * Triggers ALFRED focus mode / Deep Work sequence.
 */
exports.startDeepWorkTool = {
    name: "start_deep_work",
    description: "Initiate Deep Work / Focus session mode in ALFRED",
    category: "utility",
    execute: (input) => {
        const session = input?.sessionName || "dsa";
        logger_1.logger.info(`start_deep_work tool: Initiating Deep Work focus session '${session}'...`);
        return {
            success: true,
            data: {
                session,
                active: true,
            },
        };
    },
};
