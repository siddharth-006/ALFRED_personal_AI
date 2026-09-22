"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const main_window_1 = require("../windows/main-window");
const ipc_1 = require("../ipc");
const providers_1 = require("../agent/providers");
const tools_1 = require("../agent/tools");
const logger_1 = require("../utils/logger");
logger_1.logger.info("Initializing ALFRED Electron Main Process...");
// Single Instance Lock
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    logger_1.logger.warn("Another instance of ALFRED is already running. Quitting...");
    electron_1.app.quit();
}
else {
    electron_1.app.on("second-instance", () => {
        const win = (0, main_window_1.getMainWindow)();
        if (win) {
            if (win.isMinimized())
                win.restore();
            win.focus();
        }
    });
    electron_1.app.whenReady().then(async () => {
        logger_1.logger.info("Electron app fully ready.");
        // Register default tools and AI providers
        (0, tools_1.registerDefaultTools)();
        (0, providers_1.registerDefaultProviders)();
        // Register IPC modules
        (0, ipc_1.registerAllIpcHandlers)();
        // Create main application window
        await (0, main_window_1.createMainWindow)();
        electron_1.app.on("activate", async () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                logger_1.logger.info("Re-creating main window upon activation.");
                await (0, main_window_1.createMainWindow)();
            }
        });
    });
    electron_1.app.on("window-all-closed", () => {
        logger_1.logger.info("All application windows closed.");
        if (process.platform !== "darwin") {
            logger_1.logger.info("Quitting Electron application.");
            electron_1.app.quit();
        }
    });
}
