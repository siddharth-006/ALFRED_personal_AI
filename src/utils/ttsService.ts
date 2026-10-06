"use client";

import type { TtsEngineStatus, TtsEvent, TtsSpeakOptions } from "@/types/electron";

export type TtsStatusState = "disabled" | "ready" | "speaking" | "error";

const TTS_ENABLED_KEY = "alfred_tts_enabled_v1";
const TTS_VOLUME_KEY = "alfred_tts_volume_v1";
const TTS_RATE_KEY = "alfred_tts_rate_v1";
const TTS_VOICE_KEY = "alfred_tts_voice_v1";

class TtsClientServiceImpl {
    private isEnabled: boolean = true;
    private statusState: TtsStatusState = "ready";
    private statusDetail: string = "TTS Ready";
    private activeVoice: string | undefined = undefined;
    private availableVoices: string[] = [];
    private volume: number = 100;
    private rate: number = 0;
    private isActivelySpeaking: boolean = false;
    private listeners: Set<(state: TtsStatusState, detail: string) => void> = new Set();
    private wasWakeWordActiveBeforeSpeech: boolean = false;

    constructor() {
        this.loadSettings();
        if (typeof window !== "undefined") {
            // Listen to main process TTS events
            if (window.electron?.tts?.onEvent) {
                window.electron.tts.onEvent((event: TtsEvent) => {
                    this.handleTtsEvent(event);
                });
            }
            // Pre-fetch status
            setTimeout(() => {
                this.initialize().catch(() => {});
            }, 300);
        }
    }

    private loadSettings(): void {
        if (typeof window === "undefined" || !window.localStorage) return;
        try {
            const savedEnabled = localStorage.getItem(TTS_ENABLED_KEY);
            if (savedEnabled !== null) {
                this.isEnabled = savedEnabled === "true";
            } else {
                this.isEnabled = true; // Enabled by default
            }

            const savedVol = localStorage.getItem(TTS_VOLUME_KEY);
            if (savedVol !== null) {
                this.volume = parseInt(savedVol, 10) || 100;
            }

            const savedRate = localStorage.getItem(TTS_RATE_KEY);
            if (savedRate !== null) {
                this.rate = parseInt(savedRate, 10) || 0;
            }

            const savedVoice = localStorage.getItem(TTS_VOICE_KEY);
            if (savedVoice) {
                this.activeVoice = savedVoice;
            }

            if (!this.isEnabled) {
                this.statusState = "disabled";
                this.statusDetail = "Voice responses disabled";
            }
        } catch {}
    }

    public async initialize(): Promise<TtsEngineStatus> {
        if (typeof window !== "undefined" && window.electron?.tts?.getStatus) {
            try {
                const status = await window.electron.tts.getStatus();
                if (status.available && status.status !== "ERROR") {
                    this.availableVoices = status.voices || [];
                    if (!this.activeVoice && status.voice) {
                        this.activeVoice = status.voice;
                    }
                    if (this.isEnabled) {
                        this.setStatus("ready", `Voice output ready (${this.activeVoice || "Local SAPI"})`);
                    }
                } else if (status.status === "ERROR") {
                    this.setStatus("error", status.detail || "TTS engine unavailable");
                }
                return status;
            } catch (err: any) {
                this.setStatus("error", err?.message || "Failed to query TTS status");
                return {
                    available: false,
                    engine: "none",
                    status: "ERROR",
                    detail: err?.message || "Failed to initialize TTS",
                };
            }
        }

        return {
            available: true,
            engine: "mock",
            status: "READY",
            detail: "Browser TTS fallback",
        };
    }

    private handleTtsEvent(event: TtsEvent): void {
        switch (event.type) {
            case "started":
                this.isActivelySpeaking = true;
                if (this.isEnabled) {
                    this.setStatus("speaking", "ALFRED speaking...");
                }
                break;
            case "completed":
            case "stopped":
                this.isActivelySpeaking = false;
                if (this.isEnabled) {
                    this.setStatus("ready", `Voice output ready (${this.activeVoice || "Local SAPI"})`);
                }
                this.handleSpeechEnded();
                break;
            case "error":
                this.isActivelySpeaking = false;
                this.handleSpeechEnded();
                if (this.isEnabled) {
                    this.setStatus("error", event.error || "Speech error");
                }
                break;
        }
    }

    /**
     * Coordinate with WakeWordService: Resume wake-word monitoring after speech concludes.
     */
    private async handleSpeechEnded(): Promise<void> {
        if (this.wasWakeWordActiveBeforeSpeech) {
            this.wasWakeWordActiveBeforeSpeech = false;
            // Short 300ms pause to let room acoustic reverb settle before reopening wake microphone
            setTimeout(async () => {
                try {
                    const { WakeWordService } = await import("./wakeWordService");
                    if (WakeWordService.isFeatureEnabled() && !WakeWordService.isListening()) {
                        await WakeWordService.resume();
                    }
                } catch {}
            }, 300);
        }
    }

    /**
     * Speak speech text using local Windows TTS.
     * Automatically coordinates wake-word suppression and handles cancellation.
     */
    public async speak(text: string, options?: TtsSpeakOptions): Promise<boolean> {
        if (!this.isEnabled) {
            return false;
        }

        const clean = text?.trim();
        if (!clean) return false;

        // Microphone Safety: Suppress/pause wake word detection while ALFRED is speaking
        // so computer audio output does not accidentally trigger wake word false positives!
        try {
            const { WakeWordService } = await import("./wakeWordService");
            if (WakeWordService.isListening()) {
                this.wasWakeWordActiveBeforeSpeech = true;
                WakeWordService.pause();
            }
        } catch {}

        if (typeof window !== "undefined" && window.electron?.tts?.speak) {
            try {
                this.isActivelySpeaking = true;
                this.setStatus("speaking", "ALFRED speaking...");
                const opts: TtsSpeakOptions = {
                    volume: options?.volume ?? this.volume,
                    rate: options?.rate ?? this.rate,
                    voice: options?.voice ?? this.activeVoice,
                };
                const res = await window.electron.tts.speak(clean, opts);
                if (!res.success) {
                    this.isActivelySpeaking = false;
                    this.handleSpeechEnded();
                    this.setStatus("ready", "Voice output ready");
                    return false;
                }
                return true;
            } catch (err: any) {
                this.isActivelySpeaking = false;
                this.handleSpeechEnded();
                this.setStatus("error", err?.message || "Speech failed");
                return false;
            }
        }

        return false;
    }

    /**
     * Immediately interrupt and cancel active speech playback.
     */
    public async stop(): Promise<void> {
        this.isActivelySpeaking = false;
        if (typeof window !== "undefined" && window.electron?.tts?.stop) {
            try {
                await window.electron.tts.stop();
            } catch {}
        }
        if (this.isEnabled) {
            this.setStatus("ready", "Voice output ready");
        }
        this.handleSpeechEnded();
    }

    public isSpeaking(): boolean {
        return this.isActivelySpeaking;
    }

    public isFeatureEnabled(): boolean {
        return this.isEnabled;
    }

    public async setEnabled(enabled: boolean): Promise<void> {
        this.isEnabled = enabled;
        if (typeof window !== "undefined" && window.localStorage) {
            localStorage.setItem(TTS_ENABLED_KEY, enabled ? "true" : "false");
        }
        if (!enabled) {
            await this.stop();
            this.setStatus("disabled", "Voice responses disabled by operator");
        } else {
            this.setStatus("ready", `Voice output ready (${this.activeVoice || "Local SAPI"})`);
        }
    }

    public setVolume(vol: number): void {
        this.volume = Math.max(0, Math.min(100, vol));
        if (typeof window !== "undefined" && window.localStorage) {
            localStorage.setItem(TTS_VOLUME_KEY, String(this.volume));
        }
    }

    public setRate(rate: number): void {
        this.rate = Math.max(-10, Math.min(10, rate));
        if (typeof window !== "undefined" && window.localStorage) {
            localStorage.setItem(TTS_RATE_KEY, String(this.rate));
        }
    }

    public getStatusState(): TtsStatusState {
        return this.statusState;
    }

    public getStatusDetail(): string {
        return this.statusDetail;
    }

    public getAvailableVoices(): string[] {
        return this.availableVoices;
    }

    public getActiveVoice(): string | undefined {
        return this.activeVoice;
    }

    public subscribeStatus(cb: (state: TtsStatusState, detail: string) => void): () => void {
        this.listeners.add(cb);
        cb(this.statusState, this.statusDetail);
        return () => this.listeners.delete(cb);
    }

    private setStatus(state: TtsStatusState, detail: string): void {
        this.statusState = state;
        this.statusDetail = detail;
        this.listeners.forEach((fn) => {
            try {
                fn(state, detail);
            } catch {}
        });
    }
}

export const TtsClientService = new TtsClientServiceImpl();
