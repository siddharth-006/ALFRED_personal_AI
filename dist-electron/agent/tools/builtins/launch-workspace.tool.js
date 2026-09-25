"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchWorkspaceTool = void 0;
const workspace_service_1 = require("../../../services/workspace.service");
const logger_1 = require("../../../utils/logger");
/**
 * launch_workspace tool adapter (Phase 3.3 - Step 1)
 *
 * Uses existing WorkspaceService to launch workspace sessions (apps, folders, websites).
 */
exports.launchWorkspaceTool = {
    name: "launch_workspace",
    description: "Launch an ALFRED workspace session containing apps, local folders, or websites",
    category: "workspace",
    validateInput: (input) => {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Input must be an object containing a 'workspace' or 'workspaceName' property." };
        }
        const obj = input;
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
    execute: async (input, options) => {
        const rawTarget = input.workspace || input.workspaceName;
        const wsTarget = typeof rawTarget === "string" ? rawTarget.trim() : rawTarget;
        logger_1.logger.info(`launch_workspace tool: Launching workspace via WorkspaceService...`);
        try {
            const result = await workspace_service_1.workspaceService.launchWorkspace(wsTarget, options);
            return {
                success: result.success,
                data: result,
                error: result.success ? undefined : (result.error || "One or more workspace items failed to launch."),
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Workspace launch exception";
            logger_1.logger.error(`launch_workspace tool error: ${message}`);
            return {
                success: false,
                error: message,
            };
        }
    },
};
