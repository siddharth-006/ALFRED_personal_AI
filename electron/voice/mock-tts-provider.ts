import {
    ITtsProvider,
    TtsStatus,
    TtsSpeakOptions,
    TtsEvent,
} from "./tts-provider.interface";

/**
 * Mock TTS Provider for unit testing and non-Windows environments.
 */
export class MockTtsProvider implements ITtsProvider {
    private speaking: boolean = false;
    private currentId: string | null = null;
    private listeners: Set<(event: TtsEvent) => void> = new Set();
    public spokenHistory: Array<{ id: string; text: string }> = [];
    public options: TtsSpeakOptions = { rate: 0, volume: 100 };
    public stopCallCount: number = 0;
    public disposed: boolean = false;
    private durationMs: number;

    constructor(durationMs: number = 50) {
        this.durationMs = durationMs;
    }

    public async initialize(): Promise<TtsStatus> {
        return {
            available: true,
            engine: "mock",
            status: "READY",
            voice: "Mock Voice",
            voices: ["Mock Voice 1", "Mock Voice 2"],
            detail: "Mock TTS provider active.",
        };
    }

    public async speak(id: string, text: string, options?: TtsSpeakOptions): Promise<boolean> {
        this.speaking = true;
        this.currentId = id;
        this.spokenHistory.push({ id, text });
        if (options) {
            this.options = { ...this.options, ...options };
        }

        this.emitEvent({ type: "started", id, text });

        // Simulate short playback completion
        setTimeout(() => {
            if (this.speaking && this.currentId === id) {
                this.speaking = false;
                this.currentId = null;
                this.emitEvent({ type: "completed", id, text });
            }
        }, this.durationMs);

        return true;
    }

    public async stop(): Promise<void> {
        this.stopCallCount++;
        const wasSpeaking = this.speaking;
        this.speaking = false;
        const id = this.currentId;
        this.currentId = null;
        if (wasSpeaking) {
            this.emitEvent({ type: "stopped", id: id || undefined });
        }
    }

    public isSpeaking(): boolean {
        return this.speaking;
    }

    public async getStatus(): Promise<TtsStatus> {
        return {
            available: true,
            engine: "mock",
            status: this.speaking ? "SPEAKING" : "READY",
            voice: "Mock Voice",
            voices: ["Mock Voice 1", "Mock Voice 2"],
            detail: "Mock TTS provider active.",
        };
    }

    public async setOptions(options: TtsSpeakOptions): Promise<void> {
        this.options = { ...this.options, ...options };
    }

    public onEvent(listener: (event: TtsEvent) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emitEvent(event: TtsEvent): void {
        this.listeners.forEach((fn) => {
            try {
                fn(event);
            } catch {}
        });
    }

    public async dispose(): Promise<void> {
        this.disposed = true;
        await this.stop();
        this.listeners.clear();
    }
}
