import { ToolDefinition, ToolResult, ToolExecutionOptions } from "../types";
import { appResolverTool } from "../../../tools/app-resolver.tool";
import { appExecutorTool } from "../../../tools/app-executor.tool";
import { logger } from "../../../utils/logger";

export interface LaunchApplicationInput {
    appName: string;
}

export interface LaunchApplicationOutput {
    appName: string;
    executable: string;
    executed: boolean;
}

/**
 * launch_application tool adapter (Phase 3.3 - Step 1)
 *
 * Safely resolves human-readable app names against strict AppResolverTool whitelist
 * and launches via AppExecutorTool. Strictly prevents dynamic process spawning or path execution.
 */
export const launchApplicationTool: ToolDefinition<LaunchApplicationInput, LaunchApplicationOutput> = {
    name: "launch_application",
    description: "Launch a whitelisted desktop application (e.g. VS Code, Chrome, Spotify, Windows Terminal, Power BI)",
    category: "application",
    validateInput: (input: unknown) => {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Input must be an object with an 'appName' string property." };
        }
        const { appName } = input as Record<string, unknown>;
        if (typeof appName !== "string" || !appName.trim()) {
            return { valid: false, error: "Application name ('appName') must be a non-empty string." };
        }
        // Security check: reject explicit path separators or shell metacharacters
        if (/[/\\]/.test(appName)) {
            return { valid: false, error: "Application name cannot contain file paths or path separators." };
        }
        if (/[;&|`$()<>{}\n\r]/.test(appName)) {
            return { valid: false, error: "Application name contains invalid shell characters." };
        }
        return { valid: true };
    },
    execute: async (input: LaunchApplicationInput, options?: ToolExecutionOptions): Promise<ToolResult<LaunchApplicationOutput>> => {
        logger.info(`launch_application tool: Resolving target app '${input.appName}'...`);

        // Step 1: Pass through strict AppResolverTool whitelist check
        const resolution = appResolverTool.resolveApplication(input.appName);
        if (!resolution.success) {
            logger.warn(`launch_application tool rejected target '${input.appName}': ${resolution.error}`);
            return {
                success: false,
                error: resolution.error || "Unsupported or invalid application name.",
            };
        }

        // Step 2: Execute via AppExecutorTool
        const execOptions = { isMock: options?.isMock ?? false };
        const execResult = await appExecutorTool.execute(resolution.executable, execOptions);

        if (execResult.success) {
            return {
                success: true,
                data: {
                    appName: resolution.appName,
                    executable: resolution.executable,
                    executed: execResult.executed,
                },
            };
        } else {
            return {
                success: false,
                error: execResult.error || `Failed to execute ${resolution.appName}`,
            };
        }
    },
};
