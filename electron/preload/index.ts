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
        launch: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.WORKSPACE.LAUNCH, id),
    },
};

contextBridge.exposeInMainWorld("electron", electronAPI);
