import { BrowserWindow, shell } from "electron";
import { APP_CONFIG } from "../config/app.config";
import { isDev, getPreloadPath } from "../utils/env";
import { startStaticServer } from "../services/static-server.service";
import { logger } from "../utils/logger";

let mainWindow: BrowserWindow | null = null;

export async function createMainWindow(): Promise<BrowserWindow> {
    logger.info("Creating Main BrowserWindow instance...");

    const preloadPath = getPreloadPath();
    logger.info(`Resolved Preload Script Path: ${preloadPath}`);

    mainWindow = new BrowserWindow({
        width: APP_CONFIG.window.width,
        height: APP_CONFIG.window.height,
        minWidth: APP_CONFIG.window.minWidth,
        minHeight: APP_CONFIG.window.minHeight,
        title: APP_CONFIG.title,
        autoHideMenuBar: true,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    // Security Guard: Restrict external link navigation
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("http:") || url.startsWith("https:")) {
            shell.openExternal(url);
        }
        return { action: "deny" };
    });

    if (isDev) {
        logger.info(`Dev Mode: Loading Dev Server -> ${APP_CONFIG.devServerUrl}`);
        await mainWindow.loadURL(APP_CONFIG.devServerUrl);
        mainWindow.webContents.openDevTools();
    } else {
        try {
            const serverUrl = await startStaticServer();
            logger.info(`Production Mode: Loading Local Server -> ${serverUrl}`);
            await mainWindow.loadURL(serverUrl);
        } catch (err: unknown) {
            const error = err as Error;
            logger.error(`Failed to start production server: ${error.message}`);
        }
    }

    mainWindow.on("closed", () => {
        logger.info("Main BrowserWindow closed.");
        mainWindow = null;
    });

    return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}
