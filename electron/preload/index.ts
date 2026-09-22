import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../config/constants";

const electronAPI = {
    system: {
        ping: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.PING),
        getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_INFO),
        openUrl: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.OPEN_URL, url),
        openPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.OPEN_PATH, path),
        showNotification: (title: string, body: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.SHOW_NOTIFICATION, { title, body }),
        executeCommand: (command: string, cwd?: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.EXECUTE_COMMAND, { command, cwd }),
    },
    workspace: {
        getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE.GET_STATUS),
        launch: (payload: any) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE.LAUNCH, payload),
    },
    commandAgent: {
        execute: (prompt: string, options?: any) =>
            ipcRenderer.invoke(IPC_CHANNELS.COMMAND_AGENT.EXECUTE, prompt, options),
        confirm: (confirmationId: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.COMMAND_AGENT.CONFIRM, confirmationId),
        cancel: (confirmationId: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.COMMAND_AGENT.CANCEL, confirmationId),
    },
    tasks: {
        getTasks: () => ipcRenderer.invoke(IPC_CHANNELS.TASKS.GET),
        syncTasks: (tasks: any[]) => ipcRenderer.invoke(IPC_CHANNELS.TASKS.SYNC, tasks),
        onTasksChanged: (callback: (tasks: any[]) => void) => {
            const listener = (_event: any, tasks: any[]) => callback(tasks);
            ipcRenderer.on(IPC_CHANNELS.TASKS.CHANGED, listener);
            return () => {
                ipcRenderer.removeListener(IPC_CHANNELS.TASKS.CHANGED, listener);
            };
        },
    },
    goals: {
        getGoals: () => ipcRenderer.invoke(IPC_CHANNELS.GOALS.GET),
        syncGoals: (goals: any[]) => ipcRenderer.invoke(IPC_CHANNELS.GOALS.SYNC, goals),
        onGoalsChanged: (callback: (goals: any[]) => void) => {
            const listener = (_event: any, goals: any[]) => callback(goals);
            ipcRenderer.on(IPC_CHANNELS.GOALS.CHANGED, listener);
            return () => {
                ipcRenderer.removeListener(IPC_CHANNELS.GOALS.CHANGED, listener);
            };
        },
    },
    projects: {
        getProjects: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.GET),
        syncProjects: (projects: any[]) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS.SYNC, projects),
        onProjectsChanged: (callback: (projects: any[]) => void) => {
            const listener = (_event: any, projects: any[]) => callback(projects);
            ipcRenderer.on(IPC_CHANNELS.PROJECTS.CHANGED, listener);
            return () => {
                ipcRenderer.removeListener(IPC_CHANNELS.PROJECTS.CHANGED, listener);
            };
        },
    },
    aiProvider: {
        getStatuses: () => ipcRenderer.invoke(IPC_CHANNELS.AI_PROVIDER.GET_STATUSES),
        getActive: () => ipcRenderer.invoke(IPC_CHANNELS.AI_PROVIDER.GET_ACTIVE),
        setActive: (providerId: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.AI_PROVIDER.SET_ACTIVE, providerId),
        getConfigStatus: (providerId: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.AI_PROVIDER.GET_CONFIG_STATUS, providerId),
        checkAvailability: (providerId: string) =>
            ipcRenderer.invoke(IPC_CHANNELS.AI_PROVIDER.CHECK_AVAILABILITY, providerId),
    },
};

contextBridge.exposeInMainWorld("electron", electronAPI);
