import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../config/constants";
import { logger } from "../../utils/logger";
import { WhisperService, VoiceEngineStatus, TranscribeResult } from "../../voice/whisper-service";

/**
 * Register voice IPC handlers.
 * Exposes local speech-to-text status and audio transcription safely
 * without exposing internal processes, filesystem, or shell execution to the renderer.
 */
export function registerVoiceIpcHandlers(): void {
    logger.info("Registering Voice IPC Handlers...");
    const whisperService = WhisperService.getInstance();

    // 1. Get status of local STT engine
    ipcMain.handle(IPC_CHANNELS.VOICE.GET_STATUS, async (): Promise<VoiceEngineStatus> => {
        try {
            return await whisperService.getStatus();
        } catch (err: any) {
            logger.error("Failed to query voice engine status:", err);
            return {
                available: false,
                engine: "none",
                status: "ERROR",
                detail: err?.message || "Failed to inspect local voice engine",
            };
        }
    });

    // 2. Transcribe recorded audio buffer
    ipcMain.handle(
        IPC_CHANNELS.VOICE.TRANSCRIBE,
        async (_event, audioData: Uint8Array | ArrayBuffer): Promise<TranscribeResult> => {
            try {
                if (!audioData) {
                    logger.warn("[ALFRED:VoiceIPC] Rejected empty audio input.");
                    return {
                        success: false,
                        transcript: "",
                        error: "No audio data provided.",
                    };
                }

                // Strict boundary validation: Ensure input is binary and within reasonable bounds (50B - 50MB)
                let buffer: Buffer;
                if (Buffer.isBuffer(audioData)) {
                    buffer = audioData;
                } else if (audioData instanceof Uint8Array) {
                    buffer = Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength);
                } else if (audioData instanceof ArrayBuffer) {
                    buffer = Buffer.from(audioData);
                } else {
                    logger.warn("[ALFRED:VoiceIPC] Invalid audio buffer type received.");
                    return {
                        success: false,
                        transcript: "",
                        error: "Invalid audio buffer type.",
                    };
                }

                logger.info(`[ALFRED:VoiceIPC] Received audio buffer for transcription: ${buffer.length} bytes`);

                if (buffer.length < 50) {
                    logger.warn("[ALFRED:VoiceIPC] Audio data too small (< 50 bytes).");
                    return {
                        success: false,
                        transcript: "",
                        error: "NO SPEECH DETECTED",
                    };
                }

                if (buffer.length > 50 * 1024 * 1024) {
                    logger.warn("[ALFRED:VoiceIPC] Audio buffer exceeds 50MB limit.");
                    return {
                        success: false,
                        transcript: "",
                        error: "Audio recording exceeds maximum allowed size (50MB).",
                    };
                }

                const result = await whisperService.transcribeAudio(buffer);
                logger.info(`[ALFRED:VoiceIPC] Transcription finished: success=${result.success}, text="${result.transcript}"`);
                return result;

            } catch (err: any) {
                logger.error("[ALFRED:VoiceIPC] Error during voice transcription:", err);
                return {
                    success: false,
                    transcript: "",
                    error: err?.message || "Voice transcription failed.",
                };
            }
        }
    );

    // 3. Wake Word: Get status of local detector
    const { WakeWordService } = require("../../voice/wake-word-service");
    const wakeWordService = WakeWordService.getInstance();

    ipcMain.handle(IPC_CHANNELS.WAKE_WORD.GET_STATUS, async () => {
        try {
            return await wakeWordService.getStatus();
        } catch (err: any) {
            logger.error("[ALFRED:WakeWordIPC] Error getting wake word status:", err);
            return {
                available: false,
                engine: "none",
                status: "ERROR",
                phrase: "Hey Alfred",
                detail: err?.message || "Failed to inspect local wake word engine.",
            };
        }
    });

    // 4. Wake Word: Predict on live 16kHz PCM audio frame
    ipcMain.handle(
        IPC_CHANNELS.WAKE_WORD.PREDICT,
        async (_event, payload: { audio: string; threshold?: number }) => {
            try {
                if (!payload || !payload.audio) {
                    return { detected: false, error: "No audio frame provided." };
                }
                const threshold = typeof payload.threshold === "number" ? payload.threshold : 0.5;
                return await wakeWordService.predictFrame(payload.audio, threshold);
            } catch (err: any) {
                logger.error("[ALFRED:WakeWordIPC] Error predicting wake word frame:", err);
                return {
                    detected: false,
                    error: err?.message || "Wake word prediction failed.",
                };
            }
        }
    );

    // 5. Wake Word: Set custom wake phrase
    ipcMain.handle(
        IPC_CHANNELS.WAKE_WORD.SET_PHRASE,
        async (_event, phrase: string) => {
            try {
                if (!phrase || typeof phrase !== "string") {
                    return { success: false, error: "Invalid wake phrase." };
                }
                const success = await wakeWordService.setPhrase(phrase.trim());
                return { success, phrase: phrase.trim() };
            } catch (err: any) {
                return { success: false, error: err?.message || "Failed to set wake phrase." };
            }
        }
    );
}

