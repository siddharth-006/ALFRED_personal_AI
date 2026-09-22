"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const constants_1 = require("../config/constants");
const electronAPI = {
    system: {
        ping: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.SYSTEM.PING),
        getInfo: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.SYSTEM.GET_INFO),
        openUrl: (url) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.SYSTEM.OPEN_URL, url),
        openPath: (path) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.SYSTEM.OPEN_PATH, path),
        showNotification: (title, body) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.SYSTEM.SHOW_NOTIFICATION, { title, body }),
        executeCommand: (command, cwd) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.SYSTEM.EXECUTE_COMMAND, { command, cwd }),
    },
    workspace: {
        getStatus: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.WORKSPACE.GET_STATUS),
        launch: (payload) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.WORKSPACE.LAUNCH, payload),
    },
    commandAgent: {
        execute: (prompt, options) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.COMMAND_AGENT.EXECUTE, prompt, options),
        confirm: (confirmationId) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.COMMAND_AGENT.CONFIRM, confirmationId),
        cancel: (confirmationId) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.COMMAND_AGENT.CANCEL, confirmationId),
    },
    tasks: {
        getTasks: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.TASKS.GET),
        syncTasks: (tasks) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.TASKS.SYNC, tasks),
        onTasksChanged: (callback) => {
            const listener = (_event, tasks) => callback(tasks);
            electron_1.ipcRenderer.on(constants_1.IPC_CHANNELS.TASKS.CHANGED, listener);
            return () => {
                electron_1.ipcRenderer.removeListener(constants_1.IPC_CHANNELS.TASKS.CHANGED, listener);
            };
        },
    },
    goals: {
        getGoals: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.GOALS.GET),
        syncGoals: (goals) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.GOALS.SYNC, goals),
        onGoalsChanged: (callback) => {
            const listener = (_event, goals) => callback(goals);
            electron_1.ipcRenderer.on(constants_1.IPC_CHANNELS.GOALS.CHANGED, listener);
            return () => {
                electron_1.ipcRenderer.removeListener(constants_1.IPC_CHANNELS.GOALS.CHANGED, listener);
            };
        },
    },
    projects: {
        getProjects: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.PROJECTS.GET),
        syncProjects: (projects) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.PROJECTS.SYNC, projects),
        onProjectsChanged: (callback) => {
            const listener = (_event, projects) => callback(projects);
            electron_1.ipcRenderer.on(constants_1.IPC_CHANNELS.PROJECTS.CHANGED, listener);
            return () => {
                electron_1.ipcRenderer.removeListener(constants_1.IPC_CHANNELS.PROJECTS.CHANGED, listener);
            };
        },
    },
    aiProvider: {
        getStatuses: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.AI_PROVIDER.GET_STATUSES),
        getActive: () => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.AI_PROVIDER.GET_ACTIVE),
        setActive: (providerId) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.AI_PROVIDER.SET_ACTIVE, providerId),
        getConfigStatus: (providerId) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.AI_PROVIDER.GET_CONFIG_STATUS, providerId),
        checkAvailability: (providerId) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.AI_PROVIDER.CHECK_AVAILABILITY, providerId),
    },
};
electron_1.contextBridge.exposeInMainWorld("electron", electronAPI);
