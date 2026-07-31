import { app, BrowserWindow } from "electron";
import { createMainWindow, getMainWindow } from "../windows/main-window";
import { registerAllIpcHandlers } from "../ipc";
import { logger } from "../utils/logger";

logger.info("Initializing ALFRED Electron Main Process...");

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    logger.warn("Another instance of ALFRED is already running. Quitting...");
    app.quit();
} else {
    app.on("second-instance", () => {
        const win = getMainWindow();
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(async () => {
        logger.info("Electron app fully ready.");

        // Register IPC modules
        registerAllIpcHandlers();

        // Create main application window
        await createMainWindow();

        app.on("activate", async () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                logger.info("Re-creating main window upon activation.");
                await createMainWindow();
            }
        });
    });

    app.on("window-all-closed", () => {
        logger.info("All application windows closed.");
        if (process.platform !== "darwin") {
            logger.info("Quitting Electron application.");
            app.quit();
        }
    });
}
