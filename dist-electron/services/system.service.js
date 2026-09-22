"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemService = exports.SystemService = void 0;
const electron_1 = require("electron");
const os_1 = __importDefault(require("os"));
class SystemService {
    getSystemInfo() {
        return {
            platform: process.platform,
            arch: process.arch,
            osRelease: os_1.default.release(),
            appVersion: electron_1.app?.getVersion ? electron_1.app.getVersion() : "1.0.0",
            electronVersion: process.versions.electron || "",
            nodeVersion: process.versions.node || "",
            cpus: os_1.default.cpus().length,
            totalMemoryMB: Math.round(os_1.default.totalmem() / (1024 * 1024)),
            freeMemoryMB: Math.round(os_1.default.freemem() / (1024 * 1024)),
        };
    }
    async openExternalUrl(url) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new Error("Invalid protocol for external URL.");
        }
        await electron_1.shell.openExternal(url);
        return true;
    }
    async openPath(targetPath) {
        return await electron_1.shell.openPath(targetPath);
    }
    sendNotification(title, body) {
        if (electron_1.Notification.isSupported()) {
            new electron_1.Notification({ title, body }).show();
            return true;
        }
        return false;
    }
}
exports.SystemService = SystemService;
exports.systemService = new SystemService();
