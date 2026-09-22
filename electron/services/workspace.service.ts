import { appResolverTool } from "../tools/app-resolver.tool";
import { execTool } from "../tools/exec.tool";
import { systemService } from "./system.service";
import { logger } from "../utils/logger";

export interface WorkspaceStatus {
    active: boolean;
    workspaceName: string;
}

export interface WorkspaceLaunchPayload {
    id: string;
    name?: string;
    applications?: string[];
    websites?: string[];
    localFolders?: string[];
}

export interface WorkspaceItemLaunchResult {
    success: boolean;
    type: "application" | "folder" | "url";
    target: string;
    executable?: string;
    error?: string;
}

export interface WorkspaceLaunchResult {
    success: boolean;
    workspaceId: string;
    results: WorkspaceItemLaunchResult[];
}

export class WorkspaceService {
    public getWorkspaceStatus(): WorkspaceStatus {
        return {
            active: true,
            workspaceName: "ALFRED Primary Workspace",
        };
    }

    public async launchWorkspace(
        payload: string | WorkspaceLaunchPayload
    ): Promise<WorkspaceLaunchResult> {
        const workspaceId = typeof payload === "string" ? payload : payload.id || "unknown";
        logger.info(`Launching workspace session for ID: ${workspaceId}`);

        const results: WorkspaceItemLaunchResult[] = [];

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
                const resolution = appResolverTool.resolveApplication(appName);

                if (!resolution.success) {
                    logger.warn(
                        `Application resolution rejected for '${appName}': ${resolution.error}`
                    );
                    results.push({
                        success: false,
                        type: "application",
                        target: appName,
                        error: resolution.error || "Unsupported application.",
                    });
                    continue;
                }

                const approvedExecutable = resolution.executable;
                logger.info(
                    `Executing whitelisted application command: '${approvedExecutable}' for '${appName}'`
                );

                try {
                    const execResult = await execTool.runCommand(approvedExecutable);
                    if (execResult.exitCode === 0) {
                        results.push({
                            success: true,
                            type: "application",
                            target: appName,
                            executable: approvedExecutable,
                        });
                    } else {
                        logger.error(
                            `Failed executing app '${appName}' (${approvedExecutable}): ${execResult.stderr}`
                        );
                        results.push({
                            success: false,
                            type: "application",
                            target: appName,
                            executable: approvedExecutable,
                            error: execResult.stderr || "Failed to execute application command.",
                        });
                    }
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : "Execution error";
                    logger.error(`Exception executing app '${appName}': ${errorMessage}`);
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
                logger.info(`Opening local folder: ${folderPath}`);
                try {
                    const openErr = await systemService.openPath(folderPath);
                    if (openErr) {
                        logger.error(`Error opening path '${folderPath}': ${openErr}`);
                        results.push({
                            success: false,
                            type: "folder",
                            target: folderPath,
                            error: openErr,
                        });
                    } else {
                        results.push({
                            success: true,
                            type: "folder",
                            target: folderPath,
                        });
                    }
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : "Folder open error";
                    logger.error(`Exception opening folder '${folderPath}': ${errorMessage}`);
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
                logger.info(`Opening website URL: ${url}`);
                try {
                    await systemService.openExternalUrl(url);
                    results.push({
                        success: true,
                        type: "url",
                        target: url,
                    });
                } catch (err: unknown) {
                    const errorMessage = err instanceof Error ? err.message : "URL open error";
                    logger.error(`Exception opening URL '${url}': ${errorMessage}`);
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

export const workspaceService = new WorkspaceService();
