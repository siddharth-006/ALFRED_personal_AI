import type { SystemInfo } from "../../electron/services/system.service";
import type { WorkspaceStatus } from "../../electron/services/workspace.service";
import type { ExecutionResult } from "../../electron/tools/exec.tool";

export interface ElectronAPI {
    system: {
        ping: () => Promise<{ status: "ok"; timestamp: number }>;
        getInfo: () => Promise<SystemInfo>;
        openUrl: (url: string) => Promise<boolean>;
        openPath: (path: string) => Promise<string>;
        showNotification: (title: string, body: string) => Promise<boolean>;
        executeCommand: (command: string, cwd?: string) => Promise<ExecutionResult>;
    };
    workspace: {
        getStatus: () => Promise<WorkspaceStatus>;
        launch: (id: string) => Promise<boolean>;
    };
}

declare global {
    interface Window {
        electron?: ElectronAPI;
    }
}
