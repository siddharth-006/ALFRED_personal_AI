import { ToolDefinition, ToolResult, ToolExecutionOptions } from "../types";
import { appResolverTool } from "../../../tools/app-resolver.tool";
import { appExecutorTool } from "../../../tools/app-executor.tool";
import { logger } from "../../../utils/logger";

export interface LaunchApplicationInput {
    appName?: string;
    application?: string;
    target?: string;
}

export interface LaunchApplicationOutput {
    appName: string;
    executable: string;
    executed: boolean;
}

/**
 * launch_application tool adapter (Phase 5.1 - Native Desktop Application Control)
 *
 * Safely resolves human-readable app names or identifiers against strict AppResolverTool whitelist
 * and launches via AppExecutorTool. Strictly prevents dynamic process spawning, shell execution, or path execution.
 */
export const launchApplicationTool: ToolDefinition<LaunchApplicationInput, LaunchApplicationOutput> = {
    name: "launch_application",
    description: "Launch a whitelisted desktop application (e.g. VS Code, Chrome, Spotify, Discord, Windows Terminal, Power BI)",
    category: "application",
    validateInput: (input: unknown) => {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Input must be an object with an application identifier property ('appName' or 'application')." };
        }
        const record = input as Record<string, unknown>;
        const rawName = record.appName ?? record.application ?? record.target;
        if (typeof rawName !== "string" || !rawName.trim()) {
            return { valid: false, error: "Application name ('appName') must be a non-empty string." };
        }
        const appName = rawName.trim();
        // Security check: reject explicit path separators or shell metacharacters
        if (/[/\\]/.test(appName)) {
            return { valid: false, error: "Application name cannot contain file paths or path separators." };
        }
        if (/[;&|`$<>{}\n\r]/.test(appName)) {
            return { valid: false, error: "Application name contains invalid shell characters." };
        }
        return { valid: true };
    },
    execute: async (input: LaunchApplicationInput, options?: ToolExecutionOptions): Promise<ToolResult<LaunchApplicationOutput>> => {
        const rawName = input.appName ?? input.application ?? input.target ?? "";
        const appName = rawName.trim();
        logger.info(`launch_application tool: Resolving target app '${appName}'...`);

        // Step 1: Pass through strict AppResolverTool whitelist check
        const resolution = appResolverTool.resolveApplication(appName);
        if (!resolution.success) {
            logger.warn(`launch_application tool rejected target '${appName}': ${resolution.error}`);
            return {
                success: false,
                error: resolution.error || "Unsupported or invalid application name.",
            };
        }

        // Step 2: Execute via AppExecutorTool
        const execOptions = {
            isMock: options?.isMock ?? false,
            appId: resolution.appId,
            arguments: resolution.arguments,
            workingDirectory: resolution.workingDirectory,
        };
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
                error: execResult.error || `${resolution.appName} could not be found on this system.`,
            };
        }
    },
};
