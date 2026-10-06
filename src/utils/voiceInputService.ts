"use client";

import { onAlfredStateChange } from "./activityBus";
import { AlfredAudioService } from "./audioSystem";
import type { VoiceEngineStatus, VoiceTranscribeResult } from "@/types/electron";

export type VoiceState = "idle" | "listening" | "processing" | "error";
export type { VoiceEngineStatus, VoiceTranscribeResult };

class VoiceInputServiceImpl {
  private state: VoiceState = "idle";
  private currentTranscript = "";
  private activeMediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stateListeners: Set<(state: VoiceState, detail?: string) => void> = new Set();
  private transcriptListeners: Set<(transcript: string, isFinal: boolean) => void> = new Set();
  private vadAudioContext: AudioContext | null = null;
  private vadSourceNode: MediaStreamAudioSourceNode | null = null;
  private vadAnalyser: AnalyserNode | null = null;
  private vadGainNode: GainNode | null = null;
  private silenceCheckTimer: NodeJS.Timeout | null = null;
  private errorResetTimer: NodeJS.Timeout | null = null;
  private safetyTimeout: NodeJS.Timeout | null = null;
  private isStopping: boolean = false;

  constructor() {
    // Singleton initialization
  }

  /**
   * Inspect local speech-to-text engine availability via Electron IPC.
   */
  public async getStatus(): Promise<VoiceEngineStatus> {
    if (typeof window !== "undefined" && window.electron?.voice?.getStatus) {
      try {
        return await window.electron.voice.getStatus();
      } catch (err: any) {
        return {
          available: false,
          engine: "none",
          status: "ERROR",
          detail: err?.message || "Failed to inspect local voice engine.",
        };
      }
    }

    return {
      available: false,
      engine: "none",
      status: "NOT INSTALLED",
      detail: "ALFRED Desktop environment required for local Whisper STT.",
    };
  }

  public getEngineStatus(): VoiceEngineStatus {
    if (typeof window !== "undefined" && window.electron?.voice) {
      return {
        available: true,
        engine: "faster-whisper",
        status: "READY",
        detail: "Local Faster-Whisper STT active.",
      };
    }
    return {
      available: false,
      engine: "none",
      status: "NOT INSTALLED",
      detail: "ALFRED Desktop environment required.",
    };
  }

  public getState(): VoiceState {
    return this.state;
  }

  public isListening(): boolean {
    return this.state === "listening";
  }

  public getTranscript(): string {
    return this.currentTranscript;
  }

  public clearTranscript(): void {
    this.currentTranscript = "";
  }

  public subscribeState(callback: (state: VoiceState, detail?: string) => void): () => void {
    this.stateListeners.add(callback);
    callback(this.state);
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  public subscribeTranscript(callback: (transcript: string, isFinal: boolean) => void): () => void {
    this.transcriptListeners.add(callback);
    return () => {
      this.transcriptListeners.delete(callback);
    };
  }

  private setState(newState: VoiceState, detail?: string): void {
    this.state = newState;
    this.stateListeners.forEach((listener) => {
      try {
        listener(newState, detail);
      } catch {}
    });

    // Synchronize with ALFRED Core visual state
    if (newState === "listening") {
      onAlfredStateChange("listening", detail || "MIC ACTIVE / LISTENING...");
    } else if (newState === "processing") {
      onAlfredStateChange("thinking", detail || "PROCESSING VOICE...");
    } else if (newState === "idle") {
      onAlfredStateChange("idle", detail || "VOICE INPUT READY");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("alfred-voice-input-concluded"));
      }
    } else if (newState === "error") {
      onAlfredStateChange("error", detail || "VOICE INPUT ERROR");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("alfred-voice-input-concluded"));
      }
    }
  }

  private emitTranscript(transcript: string, isFinal: boolean): void {
    this.currentTranscript = transcript;
    this.transcriptListeners.forEach((listener) => {
      try {
        listener(transcript, isFinal);
      } catch {}
    });
  }

  private cleanupMediaStream(): void {
    this.stopSilenceDetection();

    if (this.vadGainNode) {
      try {
        this.vadGainNode.disconnect();
      } catch {}
      this.vadGainNode = null;
    }
    if (this.vadSourceNode) {
      try {
        this.vadSourceNode.disconnect();
      } catch {}
      this.vadSourceNode = null;
    }
    if (this.vadAnalyser) {
      try {
        this.vadAnalyser.disconnect();
      } catch {}
      this.vadAnalyser = null;
    }
    if (this.vadAudioContext) {
      try {
        this.vadAudioContext.close().catch(() => {});
      } catch {}
      this.vadAudioContext = null;
    }

    if (this.activeMediaStream) {
      try {
        this.activeMediaStream.getTracks().forEach((track) => {
          track.stop();
        });
      } catch {}
      this.activeMediaStream = null;
    }
  }

  /**
   * Start Voice Activity Detection to automatically detect speech completion.
   * Uses real-time time-domain RMS energy analysis with an adaptive ambient noise floor.
   */
  private startSilenceDetection(): void {
    this.stopSilenceDetection();

    let speechDetected = false;
    let consecutiveSpeechFrames = 0;
    let silenceStartTimestamp: number | null = null;
    let ambientEnergy = 0.008; // Baseline room noise floor estimate
    let frameCount = 0;

    const REQUIRED_SILENCE_MS = 1350; // 1.35 seconds of silence concludes command
    const MAX_INITIAL_SILENCE_MS = 8000; // 8 seconds max to start speaking
    const MAX_RECORDING_MS = 16000; // 16 seconds max recording length
    const startTime = Date.now();

    // Check every 60ms for prompt, low-latency speech onset and offset detection
    this.silenceCheckTimer = setInterval(() => {
      if (!this.vadAnalyser || this.state !== "listening" || this.isStopping) {
        this.stopSilenceDetection();
        return;
      }

      const sampleCount = this.vadAnalyser.fftSize || 512;
      const floatData = new Float32Array(sampleCount);
      if (typeof this.vadAnalyser.getFloatTimeDomainData === "function") {
        this.vadAnalyser.getFloatTimeDomainData(floatData);
      } else {
        // Fallback for mock environments
        const byteData = new Uint8Array(sampleCount);
        this.vadAnalyser.getByteTimeDomainData(byteData);
        for (let i = 0; i < sampleCount; i++) {
          floatData[i] = (byteData[i] - 128) / 128;
        }
      }

      // Compute Root Mean Square (RMS) sound pressure energy
      let sumSquares = 0;
      for (let i = 0; i < sampleCount; i++) {
        const val = floatData[i];
        sumSquares += val * val;
      }
      const rms = Math.sqrt(sumSquares / sampleCount);
      frameCount++;

      // Calibration: Use first 3 frames (~180ms) to calibrate baseline room ambient noise
      if (frameCount <= 3) {
        ambientEnergy = Math.max(0.002, Math.min(0.04, rms));
        return;
      }

      // Dynamic thresholds adapted to microphone sensitivity and ambient noise
      const speechThreshold = Math.max(0.026, ambientEnergy * 2.6);
      const silenceThreshold = Math.max(0.014, ambientEnergy * 1.45);

      const isSpeech = rms >= speechThreshold;
      const isSilence = rms < silenceThreshold;

      if (isSpeech) {
        consecutiveSpeechFrames++;
        if (consecutiveSpeechFrames >= 2) {
          speechDetected = true;
          silenceStartTimestamp = null;
        }
      } else {
        consecutiveSpeechFrames = 0;

        if (isSilence && !speechDetected) {
          ambientEnergy = ambientEnergy * 0.95 + rms * 0.05;
        }

        if (speechDetected && isSilence) {
          if (silenceStartTimestamp === null) {
            silenceStartTimestamp = Date.now();
          } else if (Date.now() - silenceStartTimestamp >= REQUIRED_SILENCE_MS) {
            this.stopSilenceDetection();
            if (this.state === "listening" && !this.isStopping) {
              this.stopListening().catch(() => {});
            }
            return;
          }
        } else if (speechDetected && !isSilence) {
          silenceStartTimestamp = null;
        }
      }

      // Safety timeout guards
      const elapsed = Date.now() - startTime;
      if (!speechDetected && elapsed >= MAX_INITIAL_SILENCE_MS) {
        this.stopSilenceDetection();
        if (this.state === "listening" && !this.isStopping) {
          this.stopListening().catch(() => {});
        }
      } else if (speechDetected && elapsed >= MAX_RECORDING_MS) {
        this.stopSilenceDetection();
        if (this.state === "listening" && !this.isStopping) {
          this.stopListening().catch(() => {});
        }
      }
    }, 60);
  }

  private stopSilenceDetection(): void {
    if (this.silenceCheckTimer) {
      clearInterval(this.silenceCheckTimer);
      this.silenceCheckTimer = null;
    }
  }

  /**
   * Activate microphone and start capturing local audio for offline STT.
   */
  public async startListening(): Promise<void> {
    if (this.state === "listening" || this.state === "processing" || this.isStopping) {
      return;
    }

    if (this.errorResetTimer) {
      clearTimeout(this.errorResetTimer);
      this.errorResetTimer = null;
    }
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }

    // Interruption: Immediately stop any active TTS speech playback
    if (typeof window !== "undefined") {
      try {
        const { TtsClientService } = await import("./ttsService");
        if (TtsClientService.isSpeaking()) {
          await TtsClientService.stop();
        }
      } catch {}
    }

    // 1. Strict Microphone Ownership Handoff:
    // If WakeWordService currently owns the mic, fully pause and release it first
    if (typeof window !== "undefined") {
      try {
        const { WakeWordService } = await import("./wakeWordService");
        if (WakeWordService.isListening() || WakeWordService.getStatusState() === "listening") {
          WakeWordService.pause();
          // Yield to let OS audio device handle close
          await new Promise((r) => setTimeout(r, 80));
        }
      } catch {}
    }

    // 2. Verify STT engine status
    if (typeof window !== "undefined" && window.electron?.voice?.getStatus) {
      try {
        const engineStatus = await window.electron.voice.getStatus();
        if (engineStatus.status === "NOT INSTALLED") {
          this.handleError("VOICE ENGINE NOT INSTALLED", engineStatus.detail);
          throw new Error("VOICE ENGINE NOT INSTALLED");
        }
        if (engineStatus.status === "MODEL NOT FOUND") {
          this.handleError("VOICE ENGINE MODEL NOT FOUND", engineStatus.detail);
          throw new Error("VOICE ENGINE MODEL NOT FOUND");
        }
        if (!engineStatus.available && engineStatus.status === "ERROR") {
          this.handleError("VOICE ENGINE OFFLINE", engineStatus.detail);
          throw new Error("VOICE ENGINE OFFLINE");
        }
      } catch (err: any) {
        if (err?.message?.startsWith("VOICE ENGINE")) {
          throw err;
        }
      }
    }

    // 3. Request microphone permission safely
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        try {
          this.activeMediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              sampleRate: 16000,
              echoCancellation: true,
              noiseSuppression: true,
            },
          });
        } catch (constraintErr: any) {
          if (constraintErr?.name !== "NotAllowedError" && constraintErr?.name !== "PermissionDeniedError") {
            this.activeMediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } else {
            throw constraintErr;
          }
        }
      } else {
        this.handleError("MICROPHONE UNAVAILABLE", "Microphone mediaDevices API not supported.");
        throw new Error("MICROPHONE UNAVAILABLE");
      }
    } catch (micErr: any) {
      if (micErr?.name === "NotAllowedError" || micErr?.name === "PermissionDeniedError") {
        this.handleError("MICROPHONE PERMISSION DENIED", "Microphone access rejected by operator or system.");
        throw new Error("MICROPHONE PERMISSION DENIED");
      }
      this.handleError("MICROPHONE UNAVAILABLE", micErr?.message || "Failed to access microphone.");
      throw new Error("MICROPHONE UNAVAILABLE");
    }

    // 4. Initialize MediaRecorder with detected supported MIME type
    try {
      this.recordedChunks = [];
      let mimeType = "";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          mimeType = "audio/webm";
        } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
          mimeType = "audio/ogg;codecs=opus";
        }
      }

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(this.activeMediaStream, options);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder = recorder;
      recorder.start(100); // 100ms timeslice for steady chunk buffer

      // 5. Initialize Voice Activity Detection (silence detection)
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.vadAudioContext = new AudioCtx();
          if (this.vadAudioContext.state === "suspended") {
            await this.vadAudioContext.resume().catch(() => {});
          }
          this.vadSourceNode = this.vadAudioContext.createMediaStreamSource(this.activeMediaStream);
          this.vadAnalyser = this.vadAudioContext.createAnalyser();
          this.vadAnalyser.fftSize = 512;
          this.vadAnalyser.smoothingTimeConstant = 0.2;

          // Connect through silent gain node to destination to guarantee continuous audio clocking
          this.vadGainNode = this.vadAudioContext.createGain();
          this.vadGainNode.gain.value = 0.0;

          this.vadSourceNode.connect(this.vadAnalyser);
          this.vadAnalyser.connect(this.vadGainNode);
          this.vadGainNode.connect(this.vadAudioContext.destination);

          this.startSilenceDetection();
        }
      } catch (err) {
        console.error("[VAD-INIT-ERROR]", err);
      }

      this.currentTranscript = "";
      this.setState("listening", "MIC ACTIVE / LISTENING...");
      AlfredAudioService.play("confirmation", 0.4);

      // 20-second safety timeout to auto-conclude if left recording
      this.safetyTimeout = setTimeout(() => {
        if (this.state === "listening") {
          this.stopListening();
        }
      }, 20000);

    } catch (err: any) {
      this.cleanupMediaStream();
      this.handleError("VOICE INPUT ERROR", err?.message || "Failed to initialize audio recorder.");
      throw err;
    }
  }

  /**
   * Stop microphone capture, transcribe captured audio locally, and return transcript.
   * Guarantees that execution never hangs in PROCESSING or Core in THINKING.
   */
  public async stopListening(): Promise<string> {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }

    this.stopSilenceDetection();

    if (this.state !== "listening" && this.state !== "processing") {
      return this.currentTranscript;
    }

    if (this.isStopping) {
      return this.currentTranscript;
    }

    this.isStopping = true;
    this.setState("processing", "PROCESSING VOICE...");

    const recorder = this.mediaRecorder;
    if (!recorder) {
      this.cleanupMediaStream();
      this.isStopping = false;
      this.setState("idle", "VOICE INPUT READY");
      return this.currentTranscript;
    }

    // Hard timeout guard: 20 seconds max for entire stop + transcribe cycle
    const stopCyclePromise = (async (): Promise<string> => {
      // 1. Wait for MediaRecorder to finish flushing final data chunk and fire stop
      await new Promise<void>((resolveStop) => {
        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            resolveStop();
          }
        };

        recorder.addEventListener("stop", finish, { once: true });
        // Fallback in case stop event doesn't fire within 1500ms
        setTimeout(finish, 1500);

        try {
          if (recorder.state !== "inactive") {
            recorder.stop();
          } else {
            finish();
          }
        } catch {
          finish();
        }
      });

      // 2. Stop microphone hardware tracks immediately
      this.cleanupMediaStream();
      this.mediaRecorder = null;

      // 3. Assemble recorded chunks into Blob
      const blob = new Blob(this.recordedChunks, {
        type: recorder.mimeType || "audio/webm",
      });
      const chunksCount = this.recordedChunks.length;
      this.recordedChunks = [];

      // 4. Validate audio size
      if (blob.size < 400 || chunksCount === 0) {
        this.handleError("NO SPEECH DETECTED", "Audio recording was empty.");
        return "";
      }

      // 5. Convert audio blob to ArrayBuffer
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // 6. Invoke local STT engine in Electron main process
      if (typeof window !== "undefined" && window.electron?.voice?.transcribe) {
        // Race IPC call against 20-second timeout
        const timeoutPromise = new Promise<VoiceTranscribeResult>((_, reject) =>
          setTimeout(() => reject(new Error("Voice transcription timed out (20s).")), 20000)
        );

        const result: VoiceTranscribeResult = await Promise.race([
          window.electron.voice.transcribe(uint8Array),
          timeoutPromise,
        ]);

        if (result.success && result.transcript?.trim()) {
          // Strip wake phrase prefix if user spoke "Hey Alfred, open vs code" in one breath
          const rawTranscript = result.transcript.trim();
          const cleanTranscript = stripWakePhrase(rawTranscript, "Hey Alfred");
          this.emitTranscript(cleanTranscript, true);
          this.setState("idle", "VOICE INPUT READY");
          AlfredAudioService.play("success", 0.5);
          return cleanTranscript;
        } else if (result.success && !result.transcript?.trim()) {
          this.handleError("NO SPEECH DETECTED", "No intelligible speech detected in recording.");
          return "";
        } else {
          this.handleError("VOICE INPUT ERROR", result.error || "Transcription failed.");
          return "";
        }
      } else {
        this.handleError("VOICE ENGINE OFFLINE", "Desktop STT bridge unavailable.");
        return "";
      }
    })();

    // Absolute fallback: If stopCyclePromise doesn't resolve within 22 seconds, force recover
    const hardTimeoutPromise = new Promise<string>((resolve) => {
      setTimeout(() => {
        this.cleanupMediaStream();
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.handleError("VOICE INPUT TIMEOUT", "Operation took too long.");
        resolve("");
      }, 22000);
    });

    try {
      return await Promise.race([stopCyclePromise, hardTimeoutPromise]);
    } catch (err: any) {
      this.cleanupMediaStream();
      this.handleError("VOICE INPUT ERROR", err?.message || "Failed to process audio.");
      return "";
    } finally {
      this.isStopping = false;
    }
  }

  /**
   * Abort recognition immediately without preserving transcript.
   */
  public abortListening(): void {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }
    this.stopSilenceDetection();

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }

    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.cleanupMediaStream();
    this.currentTranscript = "";
    this.isStopping = false;
    this.setState("idle", "Voice input cancelled.");
  }

  private handleError(summary: string, technicalDetail?: string): void {
    if (this.safetyTimeout) {
      clearTimeout(this.safetyTimeout);
      this.safetyTimeout = null;
    }
    this.stopSilenceDetection();

    this.cleanupMediaStream();
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isStopping = false;

    if (technicalDetail && typeof window !== "undefined" && (window as any).__ALFRED_DEBUG__) {
      console.warn(`[ALFRED:Voice] ${summary}: ${technicalDetail}`);
    }

    this.setState("error", summary);
    AlfredAudioService.play("error", 0.5);

    // Auto-recover back to idle after 2.5 seconds
    this.errorResetTimer = setTimeout(() => {
      if (this.state === "error") {
        this.setState("idle");
      }
    }, 2500);
  }
}

/**
 * Cleanly strip wake phrase prefix from user directive if captured in single breath
 */
export function stripWakePhrase(transcript: string, phrase = "Hey Alfred"): string {
  if (!transcript) return "";
  const clean = transcript.trim();
  const lowerText = clean.toLowerCase();
  const lowerPhrase = phrase.trim().toLowerCase();
  if (lowerText.startsWith(lowerPhrase)) {
    let rest = clean.slice(phrase.length).trim();
    if (rest.startsWith(",") || rest.startsWith(":") || rest.startsWith("-")) {
      rest = rest.slice(1).trim();
    }
    return rest || clean;
  }
  return clean;
}

// Singleton export
export const VoiceInputService = new VoiceInputServiceImpl();
