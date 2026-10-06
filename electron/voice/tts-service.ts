import { app } from "electron";
import { logger } from "../utils/logger";
import {
    ITtsProvider,
    TtsStatus,
    TtsSpeakOptions,
    TtsEvent,
} from "./tts-provider.interface";
import { WindowsSapiTtsProvider } from "./windows-sapi-tts-provider";
import { MockTtsProvider } from "./mock-tts-provider";

export interface SpeakResult {
    success: boolean;
    id: string;
    error?: string;
}

/**
 * Text-to-Speech Master Service (Phase 5.4C)
 * Manages local provider lifecycle, single-playback queue, interruption, deduplication, and cleanup.
 */
export class TtsService {
    private static instance: TtsService | null = null;
    private provider: ITtsProvider;
    private initialized: boolean = false;
    private lastSpokenText: string = "";
    private lastSpokenTimestamp: number = 0;
    private speechCounter: number = 0;
    private eventListeners: Set<(event: TtsEvent) => void> = new Set();
    private currentSpeechId: string | null = null;
    private enabled: boolean = true;

    public constructor(provider?: ITtsProvider) {
        if (provider) {
            this.provider = provider;
        } else if (process.platform === "win32") {
            this.provider = new WindowsSapiTtsProvider();
        } else {
            this.provider = new MockTtsProvider();
        }

        if (this.provider && typeof this.provider.onEvent === "function") {
            this.provider.onEvent((event) => {
                if (event.type === "completed" || event.type === "stopped") {
                    if (this.currentSpeechId === event.id || !event.id) {
                        this.currentSpeechId = null;
                    }
                }
                this.emitEvent(event);
            });
        }

        // Ensure clean process termination when Electron quits
        if (typeof app !== "undefined" && app?.on) {
            app.on("before-quit", () => {
                this.dispose().catch(() => {});
            });
        }
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.stop().catch(() => {});
        }
    }

    public static getInstance(): TtsService {
        if (!TtsService.instance) {
            TtsService.instance = new TtsService();
        }
        return TtsService.instance;
    }

    /**
     * Swap active TTS provider implementation (useful for tests or alternate local neural engines).
     */
    public setProvider(provider: ITtsProvider): void {
        if (this.provider) {
            this.provider.dispose().catch(() => {});
        }
        this.provider = provider;
        this.initialized = false;
        this.provider.onEvent((event) => {
            if (event.type === "completed" || event.type === "stopped") {
                if (this.currentSpeechId === event.id || !event.id) {
                    this.currentSpeechId = null;
                }
            }
            this.emitEvent(event);
        });
    }

    /**
     * Initialize TTS service.
     */
    public async initialize(): Promise<TtsStatus> {
        if (this.initialized) {
            return await this.provider.getStatus();
        }
        logger.info("[ALFRED:TtsService] Initializing TTS provider...");
        const status = await this.provider.initialize();
        this.initialized = true;
        return status;
    }

    /**
     * Synthesize and speak text.
     * Enforces single playback, newer response supersession, and React re-render deduplication.
     */
    public async speak(text: string, options?: TtsSpeakOptions): Promise<SpeakResult> {
        if (!this.enabled) {
            return {
                success: false,
                id: "",
                error: "TTS disabled",
            };
        }

        const clean = text?.trim();
        if (!clean) {
            return {
                success: false,
                id: "",
                error: "Empty speech text",
            };
        }

        // Deduplication: prevent duplicate speech within 800ms of identical text (e.g. from React re-renders)
        const now = Date.now();
        if (clean === this.lastSpokenText && now - this.lastSpokenTimestamp < 800) {
            logger.info(`[ALFRED:TtsService] Deduplicated repeated speech request: "${clean}"`);
            return {
                success: true,
                id: this.currentSpeechId || "dedup",
            };
        }

        this.lastSpokenText = clean;
        this.lastSpokenTimestamp = now;
        this.speechCounter++;
        const id = `speech-${now}-${this.speechCounter}`;

        // Ensure provider initialized
        if (!this.initialized) {
            await this.initialize();
        }

        // Concurrency Guard: If active speech is playing, cancel/stop it immediately
        if (this.provider.isSpeaking() || this.currentSpeechId) {
            logger.info(`[ALFRED:TtsService] Superseding previous speech (id=${this.currentSpeechId}) with new request (id=${id})`);
            await this.provider.stop();
        }

        this.currentSpeechId = id;

        try {
            const started = await this.provider.speak(id, clean, options);
            if (!started) {
                this.currentSpeechId = null;
                return {
                    success: false,
                    id,
                    error: "Provider rejected speech request",
                };
            }
            return {
                success: true,
                id,
            };
        } catch (err: any) {
            this.currentSpeechId = null;
            logger.error("[ALFRED:TtsService] Speech failed:", err);
            return {
                success: false,
                id,
                error: err?.message || "Speech synthesis failed",
            };
        }
    }

    /**
     * Immediately stop/interrupt speech playback.
     */
    public async stop(): Promise<void> {
        this.currentSpeechId = null;
        try {
            await this.provider.stop();
        } catch {}
    }

    public isSpeaking(): boolean {
        return this.provider.isSpeaking();
    }

    public async getStatus(): Promise<TtsStatus> {
        if (!this.initialized) {
            return await this.initialize();
        }
        return await this.provider.getStatus();
    }

    public async setOptions(options: TtsSpeakOptions): Promise<void> {
        await this.provider.setOptions(options);
    }

    public onEvent(listener: (event: TtsEvent) => void): () => void {
        this.eventListeners.add(listener);
        return () => this.eventListeners.delete(listener);
    }

    private emitEvent(event: TtsEvent): void {
        this.eventListeners.forEach((fn) => {
            try {
                fn(event);
            } catch {}
        });
    }

    public async dispose(): Promise<void> {
        await this.stop();
        await this.provider.dispose();
        this.initialized = false;
    }
}
