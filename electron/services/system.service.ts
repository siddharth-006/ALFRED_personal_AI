import { app, shell, Notification } from "electron";
import os from "os";

export interface SystemInfo {
    platform: string;
    arch: string;
    osRelease: string;
    appVersion: string;
    electronVersion: string;
    nodeVersion: string;
    cpus: number;
    totalMemoryMB: number;
    freeMemoryMB: number;
}

export class SystemService {
    public getSystemInfo(): SystemInfo {
        return {
            platform: process.platform,
            arch: process.arch,
            osRelease: os.release(),
            appVersion: app?.getVersion ? app.getVersion() : "1.0.0",
            electronVersion: process.versions.electron || "",
            nodeVersion: process.versions.node || "",
            cpus: os.cpus().length,
            totalMemoryMB: Math.round(os.totalmem() / (1024 * 1024)),
            freeMemoryMB: Math.round(os.freemem() / (1024 * 1024)),
        };
    }

    public async openExternalUrl(url: string): Promise<boolean> {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new Error("Invalid protocol for external URL.");
        }
        if (shell && typeof shell.openExternal === "function") {
            await shell.openExternal(url);
        }
        return true;
    }

    public async openPath(targetPath: string): Promise<string> {
        if (shell && typeof shell.openPath === "function") {
            return await shell.openPath(targetPath);
        }
        return "";
    }

    public sendNotification(title: string, body: string): boolean {
        if (Notification.isSupported()) {
            new Notification({ title, body }).show();
            return true;
        }
        return false;
    }
}

export const systemService = new SystemService();
