import { app, BrowserWindow, session } from "electron";
import { createMainWindow, getMainWindow } from "../windows/main-window";
import { registerAllIpcHandlers } from "../ipc";
import { registerDefaultProviders } from "../agent/providers";
import { registerDefaultTools } from "../agent/tools";
import { trayManager, setIsQuitting, getIsQuitting } from "../tray/tray-manager";
import { backgroundLifecycleService } from "../services/background-lifecycle.service";
import { getUserDataDirectory } from "../utils/paths";
import { logger } from "../utils/logger";

app.setName("ALFRED");
try {
    const userDataDir = getUserDataDirectory();
    app.setPath("userData", userDataDir);
    logger.info(`[Main] Application userData path locked to: ${userDataDir}`);
} catch (err: any) {
    logger.warn(`[Main] Notice setting custom userData path: ${err?.message}`);
}

logger.info("Initializing ALFRED Electron Main Process...");

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    logger.warn("Another instance of ALFRED is already running. Quitting...");
    app.quit();
} else {
    app.on("second-instance", () => {
        logger.info("Second instance detected; focusing existing ALFRED window.");
        const win = getMainWindow();
        if (win && !win.isDestroyed()) {
            if (!win.isVisible()) {
                win.show();
            }
            if (win.isMinimized()) {
                win.restore();
            }
            win.focus();
            backgroundLifecycleService.setWindowVisible(true);
        }
    });

    app.whenReady().then(async () => {
        logger.info("Electron app fully ready.");

        // Configure Session Media Permissions for Microphone & Audio Capture
        session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
            const p = permission as string;
            if (p === "media" || p === "audioCapture" || p === "notifications") {
                logger.info(`[Session] Granting permission request for: ${permission}`);
                return callback(true);
            }
            callback(false);
        });

        session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
            const p = permission as string;
            if (p === "media" || p === "audioCapture" || p === "notifications") {
                return true;
            }
            return false;
        });

        // Register default tools and AI providers
        registerDefaultTools();
        registerDefaultProviders();

        // Register IPC modules
        registerAllIpcHandlers();

        // Create main application window
        await createMainWindow();

        // Register global hotkey from settings
        try {
            const { hotkeyService } = require("../services/hotkey.service");
            const { settingsService } = require("../services/settings.service");
            const settings = settingsService.getSettings();
            if (settings.hotkey.enabled) {
                hotkeyService.register(settings.hotkey.shortcut);
            }
        } catch (err: any) {
            logger.warn(`[Main] Hotkey initialization notice: ${err?.message}`);
        }

        // Asynchronously pre-warm local voice STT engine to prevent first-time transcribe race
        setTimeout(() => {
            try {
                const { WhisperService } = require("../voice/whisper-service");
                WhisperService.getInstance().initialize().catch((err: any) => {
                    logger.debug(`[ALFRED:Voice] Background Whisper pre-warm notice: ${err?.message}`);
                });
            } catch {}
            try {
                const { WakeWordService } = require("../voice/wake-word-service");
                WakeWordService.getInstance().initialize().catch((err: any) => {
                    logger.debug(`[ALFRED:WakeWord] Background WakeWord pre-warm notice: ${err?.message}`);
                });
            } catch {}
            try {
                const { appDiscoveryService } = require("../services/app-discovery.service");
                appDiscoveryService.discoverApplications().catch((err: any) => {
                    logger.debug(`[ALFRED:AppDiscovery] Background discovery notice: ${err?.message}`);
                });
            } catch {}
        }, 1200);

        app.on("activate", async () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                logger.info("Re-creating main window upon activation.");
                await createMainWindow();
            } else {
                const win = getMainWindow();
                if (win && !win.isDestroyed()) {
                    if (!win.isVisible()) win.show();
                    win.focus();
                }
            }
        });
    });

    app.on("window-all-closed", () => {
        logger.info("All application windows closed.");
        // Only quit if explicit shutdown was triggered; otherwise keep ALFRED running in background/tray
        if (process.platform !== "darwin" && getIsQuitting()) {
            logger.info("Quitting Electron application.");
            app.quit();
        }
    });

    app.on("before-quit", () => {
        setIsQuitting(true);
        backgroundLifecycleService.setShuttingDown();
        trayManager.destroyTray();
        try {
            const { WhisperService } = require("../voice/whisper-service");
            WhisperService.getInstance().dispose();
        } catch {
            // ignore
        }
        try {
            const { WakeWordService } = require("../voice/wake-word-service");
            WakeWordService.getInstance().dispose();
        } catch {
            // ignore
        }
        try {
            const { hotkeyService } = require("../services/hotkey.service");
            hotkeyService.unregister();
        } catch {
            // ignore
        }
    });

    app.on("will-quit", () => {
        backgroundLifecycleService.setStopped();
    });
}


