import { logger } from "../utils/logger";

export interface WorkspaceStatus {
    active: boolean;
    workspaceName: string;
}

export class WorkspaceService {
    public getWorkspaceStatus(): WorkspaceStatus {
        return {
            active: true,
            workspaceName: "ALFRED Primary Workspace",
        };
    }

    public async launchWorkspace(workspaceId: string): Promise<boolean> {
        logger.info(`Launching workspace session: ${workspaceId}`);
        return true;
    }
}

export const workspaceService = new WorkspaceService();
