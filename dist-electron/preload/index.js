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
        launch: (id) => electron_1.ipcRenderer.invoke(constants_1.IPC_CHANNELS.WORKSPACE.LAUNCH, id),
    },
};
electron_1.contextBridge.exposeInMainWorld("electron", electronAPI);
