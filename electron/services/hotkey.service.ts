/**
 * ALFRED Global Command Launcher — Hotkey Service
 *
 * Registers and handles global desktop shortcuts (e.g., Ctrl+Shift+Space / Alt+Space)
 * to summon ALFRED from background/tray and immediately focus the Command Terminal.
 */

import { globalShortcut } from "electron";
import { getMainWindow } from "../windows/main-window";
import { backgroundLifecycleService } from "./background-lifecycle.service";
import { logger } from "../utils/logger";

export const DEFAULT_GLOBAL_HOTKEY = "CommandOrControl+Shift+Space";

export class HotkeyService {
    private static instance: HotkeyService | null = null;
    private currentShortcut: string = DEFAULT_GLOBAL_HOTKEY;
    private registered = false;

    private constructor() {}

    public static getInstance(): HotkeyService {
        if (!HotkeyService.instance) {
            HotkeyService.instance = new HotkeyService();
        }
        return HotkeyService.instance;
    }

    /**
     * Summons the ALFRED window and instructs the UI to focus the Command Terminal.
     */
    public summonAlfred(): void {
        try {
            const win = getMainWindow();
            if (!win || win.isDestroyed()) {
                logger.warn("[HotkeyService] Cannot summon: main window is destroyed or missing.");
                return;
            }

            if (!win.isVisible()) {
                win.show();
            }
            if (win.isMinimized()) {
                win.restore();
            }
            win.focus();
            backgroundLifecycleService.setWindowVisible(true);

            // Notify renderer to focus command input
            win.webContents.send("hotkey:summon-alfred");
            logger.info("[HotkeyService] ALFRED summoned via global hotkey.");
        } catch (err: any) {
            logger.error(`[HotkeyService] Error summoning ALFRED: ${err?.message}`);
        }
    }

    /**
     * Registers the global hotkey shortcut safely.
     */
    public register(shortcut: string = this.currentShortcut): boolean {
        try {
            if (this.registered) {
                this.unregister();
            }

            if (!globalShortcut || typeof globalShortcut.register !== "function") {
                logger.warn("[HotkeyService] Electron globalShortcut API not available in this environment.");
                this.currentShortcut = shortcut;
                this.registered = true;
                return true;
            }

            const success = globalShortcut.register(shortcut, () => {
                logger.debug(`[HotkeyService] Global shortcut '${shortcut}' pressed.`);
                this.summonAlfred();
            });

            if (success) {
                this.currentShortcut = shortcut;
                this.registered = true;
                logger.info(`[HotkeyService] Registered global shortcut: ${shortcut}`);
                return true;
            } else {
                logger.warn(`[HotkeyService] Failed to register global shortcut: ${shortcut}`);
                this.registered = false;
                return false;
            }
        } catch (err: any) {
            logger.error(`[HotkeyService] Registration exception: ${err?.message}`);
            this.registered = false;
            return false;
        }
    }

    /**
     * Unregisters the global hotkey cleanly.
     */
    public unregister(): void {
        try {
            if (globalShortcut && typeof globalShortcut.unregister === "function" && this.currentShortcut) {
                globalShortcut.unregister(this.currentShortcut);
            }
            this.registered = false;
            logger.info(`[HotkeyService] Unregistered global shortcut: ${this.currentShortcut}`);
        } catch (err: any) {
            logger.debug(`[HotkeyService] Unregister notice: ${err?.message}`);
            this.registered = false;
        }
    }

    public isRegistered(): boolean {
        return this.registered;
    }

    public getShortcut(): string {
        return this.currentShortcut;
    }
}

export const hotkeyService = HotkeyService.getInstance();
