"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMainWindow = createMainWindow;
exports.getMainWindow = getMainWindow;
const electron_1 = require("electron");
const app_config_1 = require("../config/app.config");
const env_1 = require("../utils/env");
const static_server_service_1 = require("../services/static-server.service");
const logger_1 = require("../utils/logger");
let mainWindow = null;
async function createMainWindow() {
    logger_1.logger.info("Creating Main BrowserWindow instance...");
    const preloadPath = (0, env_1.getPreloadPath)();
    logger_1.logger.info(`Resolved Preload Script Path: ${preloadPath}`);
    mainWindow = new electron_1.BrowserWindow({
        width: app_config_1.APP_CONFIG.window.width,
        height: app_config_1.APP_CONFIG.window.height,
        minWidth: app_config_1.APP_CONFIG.window.minWidth,
        minHeight: app_config_1.APP_CONFIG.window.minHeight,
        title: app_config_1.APP_CONFIG.title,
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
            electron_1.shell.openExternal(url);
        }
        return { action: "deny" };
    });
    if (env_1.isDev) {
        logger_1.logger.info(`Dev Mode: Loading Dev Server -> ${app_config_1.APP_CONFIG.devServerUrl}`);
        await mainWindow.loadURL(app_config_1.APP_CONFIG.devServerUrl);
        mainWindow.webContents.openDevTools();
    }
    else {
        try {
            const serverUrl = await (0, static_server_service_1.startStaticServer)();
            logger_1.logger.info(`Production Mode: Loading Local Server -> ${serverUrl}`);
            await mainWindow.loadURL(serverUrl);
        }
        catch (err) {
            const error = err;
            logger_1.logger.error(`Failed to start production server: ${error.message}`);
        }
    }
    mainWindow.on("closed", () => {
        logger_1.logger.info("Main BrowserWindow closed.");
        mainWindow = null;
    });
    return mainWindow;
}
function getMainWindow() {
    return mainWindow;
}
