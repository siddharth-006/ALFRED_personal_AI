import type { SystemInfo } from "../../electron/services/system.service";
import type {
    WorkspaceStatus,
    WorkspaceLaunchResult,
    WorkspaceLaunchPayload,
} from "../../electron/services/workspace.service";
import type { ExecutionResult } from "../../electron/tools/exec.tool";
import type { CommandExecutionResult } from "../../electron/agent/types";
import type { AIProviderId } from "../../electron/agent/providers/types";
import type { ProviderConfigStatus } from "../../electron/agent/providers/config/types";

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
        launch: (payload: string | WorkspaceLaunchPayload) => Promise<WorkspaceLaunchResult>;
    };
    commandAgent: {
        execute: (prompt: string, options?: any) => Promise<CommandExecutionResult>;
        confirm: (confirmationId: string) => Promise<CommandExecutionResult>;
        cancel: (confirmationId: string) => Promise<CommandExecutionResult>;
    };
    tasks?: {
        getTasks: () => Promise<any[]>;
        syncTasks: (tasks: any[]) => Promise<any>;
        onTasksChanged: (callback: (tasks: any[]) => void) => () => void;
    };
    goals?: {
        getGoals: () => Promise<any[]>;
        syncGoals: (goals: any[]) => Promise<any>;
        onGoalsChanged: (callback: (goals: any[]) => void) => () => void;
    };
    projects?: {
        getProjects: () => Promise<any[]>;
        syncProjects: (projects: any[]) => Promise<any>;
        onProjectsChanged: (callback: (projects: any[]) => void) => () => void;
    };
    aiProvider: {
        getStatuses: () => Promise<ProviderConfigStatus[]>;
        getActive: () => Promise<AIProviderId>;
        setActive: (providerId: string) => Promise<{ requestedId: string; effectiveId: AIProviderId; status?: ProviderConfigStatus; error?: string }>;
        getConfigStatus: (providerId: string) => Promise<ProviderConfigStatus>;
        checkAvailability: (providerId: string) => Promise<{ available: boolean; error?: string }>;
    };
}

declare global {
    interface Window {
        electron?: ElectronAPI;
    }
}
