"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceService = exports.WorkspaceService = void 0;
const app_resolver_tool_1 = require("../tools/app-resolver.tool");
const exec_tool_1 = require("../tools/exec.tool");
const system_service_1 = require("./system.service");
const logger_1 = require("../utils/logger");
class WorkspaceService {
    getWorkspaceStatus() {
        return {
            active: true,
            workspaceName: "ALFRED Primary Workspace",
        };
    }
    async launchWorkspace(payload) {
        const workspaceId = typeof payload === "string" ? payload : payload.id || "unknown";
        logger_1.logger.info(`Launching workspace session for ID: ${workspaceId}`);
        const results = [];
        if (typeof payload === "string") {
            return {
                success: true,
                workspaceId,
                results: [],
            };
        }
        // 1. Applications: Secure resolution -> Exec Tool
        if (Array.isArray(payload.applications)) {
            for (const appName of payload.applications) {
                const resolution = app_resolver_tool_1.appResolverTool.resolveApplication(appName);
                if (!resolution.success) {
                    logger_1.logger.warn(`Application resolution rejected for '${appName}': ${resolution.error}`);
                    results.push({
                        success: false,
                        type: "application",
                        target: appName,
                        error: resolution.error || "Unsupported application.",
                    });
                    continue;
                }
                const approvedExecutable = resolution.executable;
                logger_1.logger.info(`Executing whitelisted application command: '${approvedExecutable}' for '${appName}'`);
                try {
                    const execResult = await exec_tool_1.execTool.runCommand(approvedExecutable);
                    if (execResult.exitCode === 0) {
                        results.push({
                            success: true,
                            type: "application",
                            target: appName,
                            executable: approvedExecutable,
                        });
                    }
                    else {
                        logger_1.logger.error(`Failed executing app '${appName}' (${approvedExecutable}): ${execResult.stderr}`);
                        results.push({
                            success: false,
                            type: "application",
                            target: appName,
                            executable: approvedExecutable,
                            error: execResult.stderr || "Failed to execute application command.",
                        });
                    }
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Execution error";
                    logger_1.logger.error(`Exception executing app '${appName}': ${errorMessage}`);
                    results.push({
                        success: false,
                        type: "application",
                        target: appName,
                        executable: approvedExecutable,
                        error: errorMessage,
                    });
                }
            }
        }
        // 2. Local Folders: systemService.openPath
        if (Array.isArray(payload.localFolders)) {
            for (const folderPath of payload.localFolders) {
                logger_1.logger.info(`Opening local folder: ${folderPath}`);
                try {
                    const openErr = await system_service_1.systemService.openPath(folderPath);
                    if (openErr) {
                        logger_1.logger.error(`Error opening path '${folderPath}': ${openErr}`);
                        results.push({
                            success: false,
                            type: "folder",
                            target: folderPath,
                            error: openErr,
                        });
                    }
                    else {
                        results.push({
                            success: true,
                            type: "folder",
                            target: folderPath,
                        });
                    }
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "Folder open error";
                    logger_1.logger.error(`Exception opening folder '${folderPath}': ${errorMessage}`);
                    results.push({
                        success: false,
                        type: "folder",
                        target: folderPath,
                        error: errorMessage,
                    });
                }
            }
        }
        // 3. Websites: systemService.openExternalUrl
        if (Array.isArray(payload.websites)) {
            for (const url of payload.websites) {
                logger_1.logger.info(`Opening website URL: ${url}`);
                try {
                    await system_service_1.systemService.openExternalUrl(url);
                    results.push({
                        success: true,
                        type: "url",
                        target: url,
                    });
                }
                catch (err) {
                    const errorMessage = err instanceof Error ? err.message : "URL open error";
                    logger_1.logger.error(`Exception opening URL '${url}': ${errorMessage}`);
                    results.push({
                        success: false,
                        type: "url",
                        target: url,
                        error: errorMessage,
                    });
                }
            }
        }
        const overallSuccess = results.every((r) => r.success);
        return {
            success: overallSuccess,
            workspaceId,
            results,
        };
    }
}
exports.WorkspaceService = WorkspaceService;
exports.workspaceService = new WorkspaceService();
