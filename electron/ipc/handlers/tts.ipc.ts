import { ipcMain, BrowserWindow } from "electron";
import { IPC_CHANNELS } from "../../config/constants";
import { logger } from "../../utils/logger";
import { TtsService, SpeakResult } from "../../voice/tts-service";
import { TtsStatus, TtsSpeakOptions } from "../../voice/tts-provider.interface";

/**
 * Register TTS IPC handlers.
 * Exposes local text-to-speech status, playback, and interruption safely
 * without exposing child_process, shell, or arbitrary code execution to the renderer.
 */
export function registerTtsIpcHandlers(getMainWindow?: () => BrowserWindow | null): void {
    logger.info("Registering TTS IPC Handlers...");
    const ttsService = TtsService.getInstance();

    // Broadcast TTS events to renderer windows
    ttsService.onEvent((event) => {
        try {
            const windows = BrowserWindow.getAllWindows();
            for (const win of windows) {
                if (!win.isDestroyed() && win.webContents) {
                    win.webContents.send(IPC_CHANNELS.TTS.EVENT, event);
                }
            }
        } catch {}
    });

    // 1. Get status of local TTS engine
    ipcMain.handle(IPC_CHANNELS.TTS.GET_STATUS, async (): Promise<TtsStatus> => {
        try {
            return await ttsService.getStatus();
        } catch (err: any) {
            logger.error("Failed to query TTS status:", err);
            return {
                available: false,
                engine: "none",
                status: "ERROR",
                detail: err?.message || "Failed to inspect local TTS engine",
            };
        }
    });

    // 2. Synthesize and speak text
    ipcMain.handle(
        IPC_CHANNELS.TTS.SPEAK,
        async (_event, text: string, options?: TtsSpeakOptions): Promise<SpeakResult> => {
            try {
                if (!text || typeof text !== "string") {
                    return {
                        success: false,
                        id: "",
                        error: "Invalid or empty text parameter",
                    };
                }

                // Strict boundary validation: Cap max text length at 2000 chars to prevent memory abuse
                const clean = text.trim().slice(0, 2000);
                if (!clean) {
                    return {
                        success: false,
                        id: "",
                        error: "Empty speech text",
                    };
                }

                logger.info(`[ALFRED:TtsIPC] Received speak request: "${clean.length > 50 ? clean.slice(0, 47) + "..." : clean}"`);
                return await ttsService.speak(clean, options);
            } catch (err: any) {
                logger.error("[ALFRED:TtsIPC] Error during speech synthesis:", err);
                return {
                    success: false,
                    id: "",
                    error: err?.message || "TTS synthesis failed",
                };
            }
        }
    );

    // 3. Immediately stop ongoing speech
    ipcMain.handle(IPC_CHANNELS.TTS.STOP, async (): Promise<{ success: boolean }> => {
        try {
            await ttsService.stop();
            return { success: true };
        } catch {
            return { success: false };
        }
    });

    // 4. Update speech parameters (voice, volume, rate)
    ipcMain.handle(
        IPC_CHANNELS.TTS.SET_OPTIONS,
        async (_event, options: TtsSpeakOptions): Promise<{ success: boolean }> => {
            try {
                if (options && typeof options === "object") {
                    await ttsService.setOptions(options);
                    return { success: true };
                }
                return { success: false };
            } catch {
                return { success: false };
            }
        }
    );
}
