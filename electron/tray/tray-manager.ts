import { Tray, Menu, BrowserWindow, nativeImage, app } from "electron";
import path from "path";
import fs from "fs";
import { backgroundLifecycleService } from "../services/background-lifecycle.service";
import { logger } from "../utils/logger";

let isQuittingApp = false;

export function getIsQuitting(): boolean {
    return isQuittingApp;
}

export function setIsQuitting(quitting: boolean): void {
    isQuittingApp = quitting;
}

export class TrayManager {
    private static instance: TrayManager | null = null;
    private tray: Tray | null = null;
    private mainWindow: BrowserWindow | null = null;

    public static getInstance(): TrayManager {
        if (!TrayManager.instance) {
            TrayManager.instance = new TrayManager();
        }
        return TrayManager.instance;
    }

    public getTray(): Tray | null {
        return this.tray;
    }

    public createTray(window: BrowserWindow): Tray {
        this.mainWindow = window;

        if (this.tray && !this.tray.isDestroyed()) {
            return this.tray;
        }

        const icon = this.resolveTrayIcon();
        this.tray = new Tray(icon);
        this.tray.setToolTip("ALFRED — Personal AI Assistant");

        this.updateContextMenu();

        // On Windows, clicking the tray icon toggles window visibility
        this.tray.on("click", () => {
            this.toggleWindow();
        });

        this.tray.on("double-click", () => {
            this.toggleWindow();
        });

        logger.info("[TrayManager] System tray initialized successfully.");
        return this.tray;
    }

    public updateContextMenu(): void {
        if (!this.tray || this.tray.isDestroyed()) {
            return;
        }

        const contextMenu = Menu.buildFromTemplate([
            {
                label: "Show ALFRED",
                click: () => {
                    this.showWindow();
                },
            },
            {
                label: "Hide ALFRED",
                click: () => {
                    this.hideWindow();
                },
            },
            {
                label: "Open Command Center",
                click: () => {
                    this.showWindow();
                    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                        this.mainWindow.webContents.send("system:command-center-requested");
                    }
                },
            },
            { type: "separator" },
            {
                label: "Quit ALFRED",
                click: () => {
                    this.quit();
                },
            },
        ]);

        this.tray.setContextMenu(contextMenu);
    }

    public showWindow(): void {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            return;
        }

        if (this.mainWindow.isMinimized()) {
            this.mainWindow.restore();
        }
        this.mainWindow.show();
        this.mainWindow.focus();
        backgroundLifecycleService.setWindowVisible(true);
    }

    public hideWindow(): void {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            return;
        }

        this.mainWindow.hide();
        backgroundLifecycleService.setWindowVisible(false);
    }

    public toggleWindow(): void {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            return;
        }

        if (this.mainWindow.isVisible() && !this.mainWindow.isMinimized()) {
            this.hideWindow();
        } else {
            this.showWindow();
        }
    }

    public quit(): void {
        logger.info("[TrayManager] Quit requested from system tray.");
        setIsQuitting(true);
        backgroundLifecycleService.setShuttingDown();
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.destroy();
        }
        this.destroyTray();
        app.quit();
    }

    public destroyTray(): void {
        if (this.tray && !this.tray.isDestroyed()) {
            this.tray.destroy();
            this.tray = null;
            logger.info("[TrayManager] System tray destroyed.");
        }
    }

    private resolveTrayIcon(): Electron.NativeImage {
        // Search potential icon paths
        const searchPaths = [
            path.join(__dirname, "..", "assets", "tray-icon.png"),
            path.join(app.getAppPath(), "electron", "assets", "tray-icon.png"),
            path.join(app.getAppPath(), "public", "tray-icon.png"),
            path.join(app.getAppPath(), "public", "favicon.ico"),
        ];

        for (const candidate of searchPaths) {
            try {
                if (fs.existsSync(candidate)) {
                    const img = nativeImage.createFromPath(candidate);
                    if (!img.isEmpty()) {
                        return img;
                    }
                }
            } catch {
                // Continue checking fallback
            }
        }

        // Resilient fallback: 16x16 RGBA cyan icon via nativeImage buffer
        const buffer = Buffer.alloc(16 * 16 * 4);
        for (let i = 0; i < 16 * 16; i++) {
            buffer[i * 4] = 0; // R
            buffer[i * 4 + 1] = 229; // G
            buffer[i * 4 + 2] = 255; // B
            buffer[i * 4 + 3] = 255; // A
        }
        return nativeImage.createFromBuffer(buffer, { width: 16, height: 16 });
    }
}

export const trayManager = TrayManager.getInstance();
