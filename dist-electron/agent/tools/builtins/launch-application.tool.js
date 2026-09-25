"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchApplicationTool = void 0;
const app_resolver_tool_1 = require("../../../tools/app-resolver.tool");
const app_executor_tool_1 = require("../../../tools/app-executor.tool");
const logger_1 = require("../../../utils/logger");
/**
 * launch_application tool adapter (Phase 5.1 - Native Desktop Application Control)
 *
 * Safely resolves human-readable app names or identifiers against strict AppResolverTool whitelist
 * and launches via AppExecutorTool. Strictly prevents dynamic process spawning, shell execution, or path execution.
 */
exports.launchApplicationTool = {
    name: "launch_application",
    description: "Launch a whitelisted desktop application (e.g. VS Code, Chrome, Spotify, Discord, Windows Terminal, Power BI)",
    category: "application",
    validateInput: (input) => {
        if (!input || typeof input !== "object") {
            return { valid: false, error: "Input must be an object with an application identifier property ('appName' or 'application')." };
        }
        const record = input;
        const rawName = record.appName ?? record.application ?? record.target;
        if (typeof rawName !== "string" || !rawName.trim()) {
            return { valid: false, error: "Application name ('appName') must be a non-empty string." };
        }
        const appName = rawName.trim();
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
        const rawName = input.appName ?? input.application ?? input.target ?? "";
        const appName = rawName.trim();
        logger_1.logger.info(`launch_application tool: Resolving target app '${appName}'...`);
        // Step 1: Pass through strict AppResolverTool whitelist check
        const resolution = app_resolver_tool_1.appResolverTool.resolveApplication(appName);
        if (!resolution.success) {
            logger_1.logger.warn(`launch_application tool rejected target '${appName}': ${resolution.error}`);
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
                error: execResult.error || `${resolution.appName} could not be found on this system.`,
            };
        }
    },
};
