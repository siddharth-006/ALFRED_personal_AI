import { BrowserWindow, shell, app } from "electron";
import * as path from "path";
import * as fs from "fs";
import { APP_CONFIG } from "../config/app.config";
import { isDev, getPreloadPath } from "../utils/env";
import { startStaticServer } from "../services/static-server.service";
import { trayManager, getIsQuitting } from "../tray/tray-manager";
import { backgroundLifecycleService } from "../services/background-lifecycle.service";
import { logger } from "../utils/logger";

let mainWindow: BrowserWindow | null = null;

export async function createMainWindow(): Promise<BrowserWindow> {
    logger.info("Creating Main BrowserWindow instance...");

    const preloadPath = getPreloadPath();
    logger.info(`Resolved Preload Script Path: ${preloadPath}`);

    const iconCandidates = [
        path.join(app.getAppPath(), "public", "favicon.ico"),
        path.join(app.getAppPath(), "build", "icon.ico"),
        path.join(__dirname, "..", "..", "public", "favicon.ico"),
    ];
    let iconPath: string | undefined;
    for (const c of iconCandidates) {
        if (fs.existsSync(c)) {
            iconPath = c;
            break;
        }
    }

    mainWindow = new BrowserWindow({
        width: APP_CONFIG.window.width,
        height: APP_CONFIG.window.height,
        minWidth: APP_CONFIG.window.minWidth,
        minHeight: APP_CONFIG.window.minHeight,
        title: APP_CONFIG.title,
        icon: iconPath,
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

    // Intercept close event: hide window to tray instead of quitting unless explicitly quitting
    mainWindow.on("close", (event) => {
        if (!getIsQuitting()) {
            event.preventDefault();
            mainWindow?.hide();
            backgroundLifecycleService.setWindowVisible(false);
            logger.info("Main BrowserWindow hidden to tray (prevented termination).");
        } else {
            logger.info("Main BrowserWindow closing due to explicit application shutdown.");
        }
    });

    mainWindow.on("show", () => {
        backgroundLifecycleService.setWindowVisible(true);
    });

    mainWindow.on("hide", () => {
        backgroundLifecycleService.setWindowVisible(false);
    });

    // Initialize System Tray
    trayManager.createTray(mainWindow);
    backgroundLifecycleService.setWindowVisible(true);

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
        backgroundLifecycleService.setWindowVisible(false);
        mainWindow = null;
    });

    return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
    return mainWindow;
}

