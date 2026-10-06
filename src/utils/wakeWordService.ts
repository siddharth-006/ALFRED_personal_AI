"use client";

import { VoiceInputService } from "./voiceInputService";
import { playWakeSound } from "./audioSystem";
import type { WakeWordEngineStatus } from "@/types/electron";

export type WakeWordStatusState =
  | "disabled"
  | "initializing"
  | "ready"
  | "listening"
  | "wake_detected"
  | "error";

export interface WakeWordEvent {
  phrase: string;
  timestamp: number;
  score?: number;
}

const WAKE_WORD_CONFIG_KEY = "alfred_wake_word_enabled_v1";
const WAKE_WORD_PHRASE_KEY = "alfred_wake_word_phrase_v1";

class WakeWordServiceImpl {
  private statusState: WakeWordStatusState = "disabled";
  private isEnabled: boolean = false;
  private wakePhrase: string = "Hey Alfred";
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isPaused: boolean = false;
  private isDetecting: boolean = false;
  private sampleBuffer: number[] = [];
  private audioQueue: Int16Array[] = [];
  private isProcessingQueue: boolean = false;
  private readonly SAMPLES_PER_FRAME = 1280; // 80ms at 16kHz
  private consecutiveDetections: number = 0;
  private lastDetectionTime: number = 0;

  // Listeners
  private statusListeners: Set<(state: WakeWordStatusState, detail?: string) => void> = new Set();
  private wakeListeners: Set<(event: WakeWordEvent) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const savedEnabled = localStorage.getItem(WAKE_WORD_CONFIG_KEY);
        // Default is conservative: disabled unless explicitly enabled by user
        this.isEnabled = savedEnabled === "true";
        const savedPhrase = localStorage.getItem(WAKE_WORD_PHRASE_KEY);
        if (savedPhrase) {
          this.wakePhrase = savedPhrase;
        }
      } catch {
        this.isEnabled = false;
      }

      // Listen for voice input conclusion to deterministically regain microphone ownership
      window.addEventListener("alfred-voice-input-concluded", () => {
        if (this.isEnabled && (this.isPaused || this.statusState === "wake_detected")) {
          // Allow small 400ms pause to ensure OS audio device released
          setTimeout(() => {
            if (this.isEnabled && !VoiceInputService.isListening()) {
              this.resume();
            }
          }, 400);
        }
      });
    }
  }

  public getStatusState(): WakeWordStatusState {
    return this.statusState;
  }

  public getWakePhrase(): string {
    return this.wakePhrase;
  }

  public isListening(): boolean {
    return this.statusState === "listening" && !this.isPaused;
  }

  public isFeatureEnabled(): boolean {
    return this.isEnabled;
  }

  public subscribeStatus(callback: (state: WakeWordStatusState, detail?: string) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.statusState);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public subscribeWake(callback: (event: WakeWordEvent) => void): () => void {
    this.wakeListeners.add(callback);
    return () => {
      this.wakeListeners.delete(callback);
    };
  }

  private setStatus(newState: WakeWordStatusState, detail?: string): void {
    this.statusState = newState;
    this.statusListeners.forEach((fn) => {
      try {
        fn(newState, detail);
      } catch {}
    });
  }

  /**
   * Set custom wake phrase and notify main process if supported
   */
  public async setWakePhrase(phrase: string): Promise<boolean> {
    if (!phrase || !phrase.trim()) return false;
    this.wakePhrase = phrase.trim();
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(WAKE_WORD_PHRASE_KEY, this.wakePhrase);
      } catch {}
      if (window.electron?.wakeWord?.setPhrase) {
        try {
          await window.electron.wakeWord.setPhrase(this.wakePhrase);
        } catch {}
      }
    }
    return true;
  }

  /**
   * Enable or disable the Wake Word detection feature.
   */
  public async setEnabled(enabled: boolean): Promise<void> {
    this.isEnabled = enabled;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(WAKE_WORD_CONFIG_KEY, enabled ? "true" : "false");
      } catch {}
    }

    if (!enabled) {
      await this.stop();
      this.setStatus("disabled", "Wake-word detection disabled.");
    } else {
      await this.initialize();
      await this.start();
    }
  }

  /**
   * Initialize local wake-word engine status.
   */
  public async initialize(): Promise<WakeWordEngineStatus> {
    if (this.statusState === "initializing") {
      return {
        available: false,
        engine: "none",
        status: "NOT INSTALLED",
        phrase: this.wakePhrase,
        detail: "Initializing...",
      };
    }

    this.setStatus("initializing", "Checking local wake-word engine...");

    if (typeof window !== "undefined" && window.electron?.wakeWord?.getStatus) {
      try {
        const status = await window.electron.wakeWord.getStatus();
        if (status.available && status.status === "READY") {
          this.setStatus("ready", `Local wake engine ready: "${status.phrase || this.wakePhrase}"`);
        } else {
          this.setStatus("error", status.detail || "Wake word engine unavailable.");
        }
        return status;
      } catch (err: any) {
        this.setStatus("error", err?.message || "Failed to query wake engine status.");
        return {
          available: false,
          engine: "none",
          status: "ERROR",
          phrase: this.wakePhrase,
          detail: err?.message || "Failed to connect to wake engine",
        };
      }
    }

    // In non-Electron browser environment
    this.setStatus("ready", "Mock browser wake detector ready.");
    return {
      available: true,
      engine: "mock",
      status: "READY",
      phrase: this.wakePhrase,
      detail: "Browser mock detector",
    };
  }

  /**
   * Start listening for wake phrase.
   * Acquires microphone in 16kHz PCM mode.
   */
  public async start(): Promise<void> {
    if (!this.isEnabled) {
      this.setStatus("disabled", "Wake word disabled by operator.");
      return;
    }

    // Duplicate start protection
    if (this.statusState === "listening" && !this.isPaused) {
      return;
    }

    // Unpause if paused
    this.isPaused = false;

    // Strict Microphone Ownership: Ensure VoiceInputService is not using mic
    if (VoiceInputService.isListening() || VoiceInputService.getState() === "processing") {
      this.isPaused = true;
      this.setStatus("ready", "Voice input active. Wake detector standing by.");
      return;
    }

    try {
      this.setStatus("initializing", "Acquiring microphone for wake word...");

      if (!navigator?.mediaDevices?.getUserMedia) {
        this.setStatus("error", "Microphone mediaDevices API not supported.");
        return;
      }

      // Pre-cleanup any lingering audio resources
      this.cleanupAudio();

      // Request low-latency audio stream with graceful fallback
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err: any) {
        if (err?.name !== "NotAllowedError" && err?.name !== "PermissionDeniedError") {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw err;
        }
      }

      // Initialize Web Audio pipeline to downsample / convert to 16kHz PCM
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 16000 });
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      // Create ScriptProcessorNode with bufferSize 2048
      this.scriptProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);

      this.sampleBuffer = [];
      this.audioQueue = [];
      this.scriptProcessor.onaudioprocess = (e: AudioProcessingEvent) => {
        if (this.isPaused || this.statusState !== "listening") return;
        this.handleAudioProcess(e);
      };

      // Connect through a zero-gain node to mute speaker feedback while keeping Web Audio processing active
      const muteGain = this.audioContext.createGain();
      muteGain.gain.value = 0;
      this.sourceNode.connect(this.scriptProcessor);
      this.scriptProcessor.connect(muteGain);
      muteGain.connect(this.audioContext.destination);

      this.isPaused = false;
      this.setStatus("listening", `LISTENING FOR WAKE WORD ("${this.wakePhrase}")...`);

    } catch (err: any) {
      this.cleanupAudio();
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        this.setStatus("error", "Microphone permission denied for wake detection.");
      } else {
        this.setStatus("error", err?.message || "Failed to initialize wake microphone.");
      }
    }
  }

  /**
   * Process 16kHz PCM audio chunk and queue 1280-sample frames (80ms) continuously without drops
   */
  private handleAudioProcess(e: AudioProcessingEvent) {
    if (this.isPaused || this.statusState !== "listening") return;

    const inputData = e.inputBuffer.getChannelData(0);
    // Convert float32 [-1.0, 1.0] to int16 [-32768, 32767]
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      this.sampleBuffer.push(s < 0 ? s * 0x8000 : s * 0x7fff);
    }

    // Accumulate all complete 1280-sample frames into processing queue
    while (this.sampleBuffer.length >= this.SAMPLES_PER_FRAME) {
      const frameSamples = this.sampleBuffer.splice(0, this.SAMPLES_PER_FRAME);
      this.audioQueue.push(new Int16Array(frameSamples));
    }

    // Keep queue bounded to prevent latency buildup under heavy system load (max 20 frames = 1.6s)
    if (this.audioQueue.length > 20) {
      this.audioQueue = this.audioQueue.slice(-10);
    }

    // Pump queued frames through the wake engine
    this.processAudioQueue();
  }

  private async processAudioQueue() {
    if (this.isProcessingQueue || this.isPaused || this.statusState !== "listening") return;
    this.isProcessingQueue = true;

    try {
      while (this.audioQueue.length > 0 && !this.isPaused && this.statusState === "listening") {
        const frame = this.audioQueue.shift();
        if (frame) {
          await this.predictAudioFrame(frame);
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Send frame to local wake engine via Electron IPC
   */
  private async predictAudioFrame(int16Array: Int16Array) {
    if (this.isPaused || this.statusState !== "listening") return;
    this.isDetecting = true;
    try {
      if (typeof window !== "undefined" && window.electron?.wakeWord?.predict) {
        // Convert Int16Array to Base64
        const buffer = new Uint8Array(int16Array.buffer);
        let binary = "";
        const len = buffer.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(buffer[i]);
        }
        const b64 = window.btoa(binary);

        const threshold = 0.35;
        const result = await window.electron.wakeWord.predict(b64, threshold);

        if (result.score && result.score > 0.05) {
          console.debug(`[ALFRED:WakeWord] score: ${result.score.toFixed(3)} (threshold: ${threshold})`);
        }

        if (result.detected && !this.isPaused) {
          console.info(`[ALFRED:WakeWord] WAKE WORD DETECTED! (${result.phrase}) score=${result.score}`);
          const now = Date.now();
          if (now - this.lastDetectionTime > 2500) {
            this.lastDetectionTime = now;
            this.audioQueue = [];
            this.sampleBuffer = [];
            await this.onWakeDetected(result.phrase || this.wakePhrase, result.score);
          }
        }
      }
    } catch {
      // transient frame drop
    } finally {
      this.isDetecting = false;
    }
  }

  /**
   * Core wake-word event triggers deterministic handoff to VoiceInputService.
   */
  public async onWakeDetected(phrase = "Hey Alfred", score?: number): Promise<void> {
    // Prevent duplicate triggers
    if (this.statusState === "wake_detected") return;

    this.setStatus("wake_detected", `WAKE DETECTED: "${phrase}"`);

    // Interruption: Immediately stop any active TTS speech playback
    try {
      const { TtsClientService } = await import("./ttsService");
      if (TtsClientService.isSpeaking()) {
        await TtsClientService.stop();
      }
    } catch {}

    // 1. Play audio chime
    try {
      playWakeSound();
    } catch {}

    // 2. Pause and completely release microphone hardware immediately
    this.pause();

    // 3. Emit wake event to subscribers
    const event: WakeWordEvent = {
      phrase,
      timestamp: Date.now(),
      score,
    };
    this.wakeListeners.forEach((fn) => {
      try {
        fn(event);
      } catch {}
    });

    // 4. Dispatch DOM event for application wide listeners
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("alfred-wake-detected", { detail: event })
      );
    }

    // 5. Deterministic handoff:
    // Yield 200ms to allow audio chime and OS audio device teardown, then start VoiceInputService
    setTimeout(async () => {
      try {
        await VoiceInputService.startListening();
      } catch {
        // If VoiceInputService fails, resume wake detector safely
        if (this.isEnabled) {
          this.resume();
        }
      }
    }, 200);
  }

  /**
   * Pause wake-word detection and completely release microphone capture hardware.
   * Deterministic microphone ownership guarantee.
   */
  public pause(): void {
    this.isPaused = true;
    this.cleanupAudio();
    if (this.isEnabled && this.statusState !== "wake_detected") {
      this.setStatus("ready", "Wake-word paused for voice command input.");
    }
  }

  /**
   * Resume wake-word detection after command listening has completed.
   */
  public async resume(): Promise<void> {
    if (!this.isEnabled) return;
    this.isPaused = false;
    // Strict Mutual Exclusion Check: Ensure VoiceInputService is not using mic
    if (VoiceInputService.isListening() || VoiceInputService.getState() === "processing") {
      this.isPaused = true;
      return;
    }
    // Re-acquire microphone stream cleanly
    try {
      await this.start();
    } catch {
      this.setStatus("ready", "Wake word ready (idle).");
    }
  }

  /**
   * Stop wake-word service completely.
   */
  public async stop(): Promise<void> {
    this.isPaused = false;
    this.cleanupAudio();
    if (this.isEnabled) {
      this.setStatus("ready", "Wake-word monitoring paused.");
    } else {
      this.setStatus("disabled", "Wake-word detection disabled.");
    }
  }

  private cleanupAudio(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      this.mediaStream = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {}
      this.sourceNode = null;
    }
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.onaudioprocess = null;
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close().catch(() => {});
      } catch {}
      this.audioContext = null;
    }
    this.sampleBuffer = [];
    this.audioQueue = [];
  }
}

export const WakeWordService = new WakeWordServiceImpl();
