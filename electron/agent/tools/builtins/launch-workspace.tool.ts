import { ToolDefinition, ToolResult } from "../types";
import { workspaceService, WorkspaceLaunchPayload, WorkspaceLaunchResult } from "../../../services/workspace.service";
import { logger } from "../../../utils/logger";

export interface LaunchWorkspaceInput {
    workspace: string | WorkspaceLaunchPayload;
}

/**
 * launch_workspace tool adapter (Phase 3.3 - Step 1)
 *
 * Uses existing WorkspaceService to launch workspace sessions (apps, folders, websites).
 */
export const launchWorkspaceTool: ToolDefinition<LaunchWorkspaceInput, WorkspaceLaunchResult> = {
    name: "launch_workspace",
    description: "Launch an ALFRED workspace session containing apps, local folders, or websites",
    category: "workspace",
    validateInput: (input: unknown) => {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Input must be an object containing a 'workspace' or 'workspaceName' property." };
        }
        const obj = input as Record<string, unknown>;
        const workspace = obj.workspace || obj.workspaceName;
        if (!workspace) {
            return { valid: false, error: "'workspace' property is required." };
        }
        if (typeof workspace !== "string" && typeof workspace !== "object") {
            return { valid: false, error: "'workspace' must be a workspace ID string or launch payload object." };
        }
        if (typeof workspace === "string" && !workspace.trim()) {
            return { valid: false, error: "Workspace ID string cannot be empty." };
        }
        return { valid: true };
    },
    execute: async (input: LaunchWorkspaceInput | any): Promise<ToolResult<WorkspaceLaunchResult>> => {
        const rawTarget = input.workspace || input.workspaceName;
        const wsTarget = typeof rawTarget === "string" ? rawTarget.trim() : rawTarget;
        logger.info(`launch_workspace tool: Launching workspace via WorkspaceService...`);

        try {
            const result = await workspaceService.launchWorkspace(wsTarget);
            return {
                success: result.success,
                data: result,
                error: result.success ? undefined : "One or more workspace items failed to launch.",
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Workspace launch exception";
            logger.error(`launch_workspace tool error: ${message}`);
            return {
                success: false,
                error: message,
            };
        }
    },
};
