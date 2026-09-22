import { ToolDefinition, ToolResult } from "../types";
import { logger } from "../../../utils/logger";

export interface StartDeepWorkInput {
    sessionName?: string;
}

export interface StartDeepWorkOutput {
    session: string;
    active: boolean;
}

/**
 * start_deep_work tool adapter (Phase 3.3 - Step 1)
 *
 * Triggers ALFRED focus mode / Deep Work sequence.
 */
export const startDeepWorkTool: ToolDefinition<StartDeepWorkInput, StartDeepWorkOutput> = {
    name: "start_deep_work",
    description: "Initiate Deep Work / Focus session mode in ALFRED",
    category: "utility",
    execute: (input?: StartDeepWorkInput): ToolResult<StartDeepWorkOutput> => {
        const session = input?.sessionName || "dsa";
        logger.info(`start_deep_work tool: Initiating Deep Work focus session '${session}'...`);

        return {
            success: true,
            data: {
                session,
                active: true,
            },
        };
    },
};
