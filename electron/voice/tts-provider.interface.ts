/**
 * ALFRED Phase 5.4C: Text-to-Speech Provider Interface & Types
 * Clean, modular abstraction supporting Windows-native SAPI and future neural engines.
 */

export interface TtsStatus {
    available: boolean;
    engine: "windows-sapi" | "mock" | "none";
    status: "INITIALIZING" | "READY" | "SPEAKING" | "DISABLED" | "ERROR";
    voice?: string;
    voices?: string[];
    detail?: string;
}

export interface TtsSpeakOptions {
    rate?: number; // -10 to 10 (SAPI rate) or 0.5 to 2.0
    volume?: number; // 0 to 100
    voice?: string;
}

export interface TtsEvent {
    type: "ready" | "started" | "completed" | "stopped" | "error";
    id?: string;
    text?: string;
    error?: string;
}

export interface ITtsProvider {
    /**
     * Initialize the local TTS engine and verify runtime availability.
     */
    initialize(): Promise<TtsStatus>;

    /**
     * Speak speech text asynchronously.
     * @param id Unique speech request identifier
     * @param text Clean, human-readable speech text
     * @param options Speech synthesis parameters (rate, volume, voice)
     * @returns Promise resolving to true if speech was accepted and started
     */
    speak(id: string, text: string, options?: TtsSpeakOptions): Promise<boolean>;

    /**
     * Immediately stop/interrupt any ongoing speech playback.
     */
    stop(): Promise<void>;

    /**
     * Check if speech audio is currently active.
     */
    isSpeaking(): boolean;

    /**
     * Inspect current status and active voice info.
     */
    getStatus(): Promise<TtsStatus>;

    /**
     * Update runtime options (voice, default volume, rate).
     */
    setOptions(options: TtsSpeakOptions): Promise<void>;

    /**
     * Subscribe to TTS lifecycle events.
     */
    onEvent(listener: (event: TtsEvent) => void): () => void;

    /**
     * Clean up processes and resources.
     */
    dispose(): Promise<void>;
}
