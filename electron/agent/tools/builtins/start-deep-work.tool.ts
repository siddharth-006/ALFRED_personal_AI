import { ToolDefinition, ToolResult } from "../types";
import { logger } from "../../../utils/logger";
import { focusService } from "../../../services/focus.service";

export interface StartDeepWorkInput {
    sessionName?: string;
    durationMinutes?: number;
    workspace?: string;
    application?: string;
}

export interface StartDeepWorkOutput {
    session: string;
    active: boolean;
    durationMinutes?: number;
    workspace?: string;
    application?: string;
    startedAt?: string;
}

/**
 * start_deep_work tool adapter (Phase 3.3 - Step 1, Phase 5.8C)
 *
 * Triggers ALFRED focus mode / Deep Work sequence through the canonical FocusService.
 */
export const startDeepWorkTool: ToolDefinition<StartDeepWorkInput, StartDeepWorkOutput> = {
    name: "start_deep_work",
    description: "Initiate Deep Work / Focus session mode in ALFRED",
    category: "utility",
    validateInput: (rawInput: unknown) => {
        if (!rawInput) return { valid: true };
        const input = rawInput as StartDeepWorkInput;
        if (input.durationMinutes !== undefined) {
            const check = focusService.validateDuration(input.durationMinutes);
            if (!check.valid) {
                return { valid: false, error: check.error };
            }
        }
        return { valid: true };
    },
    execute: (input?: StartDeepWorkInput): ToolResult<StartDeepWorkOutput> => {
        const session = input?.sessionName || "dsa";
        const durationMinutes = input?.durationMinutes;
        const workspace = input?.workspace;
        const application = input?.application || "VS Code";

        logger.info(
            `start_deep_work tool: Initiating Deep Work focus session '${session}' (${durationMinutes || 45}m, ws: ${workspace || "none"})...`
        );

        const res = focusService.startSession({
            sessionName: session,
            durationMinutes,
            workspace,
            application,
        });

        if (!res.success) {
            return {
                success: false,
                error: res.error || "Failed to start focus session.",
            };
        }

        return {
            success: true,
            data: {
                session,
                active: true,
                durationMinutes: res.session?.plannedDurationMinutes,
                workspace: res.session?.workspace,
                application: res.session?.application,
                startedAt: res.session?.startedAt,
            },
        };
    },
};

