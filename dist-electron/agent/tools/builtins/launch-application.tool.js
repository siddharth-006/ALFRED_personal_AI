"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchApplicationTool = void 0;
const app_resolver_tool_1 = require("../../../tools/app-resolver.tool");
const app_executor_tool_1 = require("../../../tools/app-executor.tool");
const logger_1 = require("../../../utils/logger");
/**
 * launch_application tool adapter (Phase 3.3 - Step 1)
 *
 * Safely resolves human-readable app names against strict AppResolverTool whitelist
 * and launches via AppExecutorTool. Strictly prevents dynamic process spawning or path execution.
 */
exports.launchApplicationTool = {
    name: "launch_application",
    description: "Launch a whitelisted desktop application (e.g. VS Code, Chrome, Spotify, Windows Terminal, Power BI)",
    category: "application",
    validateInput: (input) => {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Input must be an object with an 'appName' string property." };
        }
        const { appName } = input;
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
    execute: async (input, options) => {
        logger_1.logger.info(`launch_application tool: Resolving target app '${input.appName}'...`);
        // Step 1: Pass through strict AppResolverTool whitelist check
        const resolution = app_resolver_tool_1.appResolverTool.resolveApplication(input.appName);
        if (!resolution.success) {
            logger_1.logger.warn(`launch_application tool rejected target '${input.appName}': ${resolution.error}`);
            return {
                success: false,
                error: resolution.error || "Unsupported or invalid application name.",
            };
        }
        // Step 2: Execute via AppExecutorTool
        const execOptions = { isMock: options?.isMock ?? false };
        const execResult = await app_executor_tool_1.appExecutorTool.execute(resolution.executable, execOptions);
        if (execResult.success) {
            return {
                success: true,
                data: {
                    appName: resolution.appName,
                    executable: resolution.executable,
                    executed: execResult.executed,
                },
            };
        }
        else {
            return {
                success: false,
                error: execResult.error || `Failed to execute ${resolution.appName}`,
            };
        }
    },
};
