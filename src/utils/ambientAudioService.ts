"use client";

import { AmbientMode, AmbientPlaybackState } from "@/types/ambient";
import {
  AMBIENT_MODES,
  DEFAULT_AMBIENT_MODE_ID,
  getAmbientMode,
  getNextAmbientMode,
  getPreviousAmbientMode,
} from "./ambientRegistry";
import { TtsClientService, TtsStatusState } from "./ttsService";

export interface AmbientAudioSnapshot {
  currentMode: AmbientMode;
  playbackState: AmbientPlaybackState;
  volume: number;
  isTtsSpeaking: boolean;
  seekPosition: number;
  duration: number;
  errorMessage?: string;
}

export type HowlInstanceLike = {
  play: () => number | any;
  pause: () => any;
  stop: () => any;
  unload: () => any;
  volume: (vol?: number) => any;
  playing: () => boolean;
  state: () => string;
  seek: (pos?: number) => number | any;
  duration: () => number;
};

export type HowlConstructorLike = new (options: {
  src: string[];
  html5?: boolean;
  loop?: boolean;
  volume?: number;
  onload?: () => void;
  onloaderror?: (id: number | null, err: any) => void;
  onplayerror?: (id: number | null, err: any) => void;
}) => HowlInstanceLike;

const STORAGE_KEY_MODE = "alfred_ambient_mode_v1";
const STORAGE_KEY_VOLUME = "alfred_ambient_volume_v1";
const STORAGE_KEY_ENABLED = "alfred_ambient_enabled_v1";

let customHowlFactory: HowlConstructorLike | null = null;
let cachedHowlConstructor: HowlConstructorLike | null = null;

async function resolveHowlClass(): Promise<HowlConstructorLike | null> {
  if (customHowlFactory) {
    return customHowlFactory;
  }
  if (typeof window === "undefined") {
    return null;
  }
  if (cachedHowlConstructor) {
    return cachedHowlConstructor;
  }
  try {
    const mod = await import("howler");
    cachedHowlConstructor = mod.Howl as unknown as HowlConstructorLike;
    return cachedHowlConstructor;
  } catch (err) {
    console.warn("[AmbientAudioService] Failed to load Howler module:", err);
    return null;
  }
}

class AmbientAudioServiceImpl {
  private currentMode: AmbientMode = AMBIENT_MODES[0];
  private playbackState: AmbientPlaybackState = "idle";
  private volume: number = 0.5; // Default 50%
  private isTtsSpeaking: boolean = false;
  private wasPlayingBeforeTts: boolean = false;
  private savedSeekPosition: number = 0;
  private errorMessage?: string;
  private currentHowl: HowlInstanceLike | null = null;
  private loadSequence: number = 0;
  private subscribers: Set<(snapshot: AmbientAudioSnapshot) => void> = new Set();
  private ttsUnsubscribe: (() => void) | null = null;

  constructor() {
    this.loadPersistedSettings();
    this.setupTtsCoordination();
  }

  private loadPersistedSettings(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      const savedMode = localStorage.getItem(STORAGE_KEY_MODE);
      if (savedMode) {
        this.currentMode = getAmbientMode(savedMode);
      } else {
        this.currentMode = getAmbientMode(DEFAULT_AMBIENT_MODE_ID);
      }

      const savedVol = localStorage.getItem(STORAGE_KEY_VOLUME);
      if (savedVol !== null) {
        const parsed = parseFloat(savedVol);
        if (!isNaN(parsed)) {
          this.volume = Math.max(0, Math.min(1, parsed));
        }
      }
      // Audio NEVER auto-plays on fresh launch/restart unless user explicitly initiates it
      this.playbackState = this.currentMode.id === "silent" ? "unavailable" : "idle";
      if (this.currentMode.id === "silent") {
        this.errorMessage = "SILENT (NO AUDIO)";
      }
    } catch {
      this.currentMode = getAmbientMode(DEFAULT_AMBIENT_MODE_ID);
      this.volume = 0.5;
      this.playbackState = "idle";
    }
  }

  private setupTtsCoordination(): void {
    if (typeof window === "undefined") return;
    try {
      this.ttsUnsubscribe = TtsClientService.subscribeStatus((state: TtsStatusState) => {
        if (state === "speaking") {
          this.handleTtsStarted();
        } else {
          this.handleTtsEnded();
        }
      });
    } catch {
      // Safe fallback if TTS service is unavailable
    }
  }

  /**
   * Robust pause helper that overcomes Howler's HTML5 loop bug.
   * Disables looping flags, clears timers/queues, and directly pauses underlying audio nodes.
   */
  private applyHowlPause(howl: any): void {
    if (!howl) return;
    try {
      howl._loop = false;
      if (Array.isArray(howl._sounds)) {
        for (const s of howl._sounds) {
          s._loop = false;
          s._paused = true;
          if (s._node) {
            if (typeof s._node.pause === "function") {
              try {
                s._node.loop = false;
                s._node.pause();
              } catch {}
            }
            if (s._node.bufferSource && typeof s._node.bufferSource.stop === "function") {
              try {
                s._node.bufferSource.stop(0);
              } catch {}
            }
          }
        }
      }
      if (Array.isArray(howl._queue)) {
        howl._queue = [];
      }
      if (howl._endTimers) {
        for (const key of Object.keys(howl._endTimers)) {
          try {
            clearTimeout(howl._endTimers[key]);
          } catch {}
        }
        howl._endTimers = {};
      }
      if (typeof howl.pause === "function") {
        howl.pause();
      }
    } catch (err) {
      console.warn("[AmbientAudioService] Error during applyHowlPause:", err);
    }
  }

  /**
   * Re-enables looping flag before starting playback.
   */
  private applyHowlResume(howl: any): void {
    if (!howl) return;
    try {
      howl._loop = true;
      if (Array.isArray(howl._sounds)) {
        for (const s of howl._sounds) {
          s._loop = true;
          if (s._node && typeof s._node.loop !== "undefined") {
            s._node.loop = true;
          }
        }
      }
    } catch {}
  }

  /**
   * TTS Audio Control: Stop ambient audio completely while ALFRED is speaking
   * and record exact playback seek position for seamless resumption.
   */
  public handleTtsStarted(): void {
    if (this.isTtsSpeaking) return;
    this.isTtsSpeaking = true;

    if (this.playbackState === "playing" && this.currentHowl) {
      this.wasPlayingBeforeTts = true;
      try {
        const pos = typeof this.currentHowl.seek === "function" ? this.currentHowl.seek() : 0;
        this.savedSeekPosition = typeof pos === "number" ? pos : 0;
      } catch {}
      // COMPLETE STOP/PAUSE - Zero ambient audio output during TTS
      this.applyHowlPause(this.currentHowl);
    } else {
      this.wasPlayingBeforeTts = false;
    }
    this.notifySubscribers();
  }

  /**
   * TTS Audio Control: Resume ambient audio from exact preserved position
   * once ALFRED finishes speaking.
   */
  public handleTtsEnded(): void {
    if (!this.isTtsSpeaking) return;
    this.isTtsSpeaking = false;

    if (this.wasPlayingBeforeTts) {
      this.wasPlayingBeforeTts = false;
      if (this.currentMode.audioSource && this.currentMode.id !== "silent" && this.currentHowl) {
        try {
          this.applyHowlResume(this.currentHowl);
          if (typeof this.savedSeekPosition === "number" && this.savedSeekPosition > 0) {
            this.currentHowl.seek(this.savedSeekPosition);
          }
          this.currentHowl.play();
          this.playbackState = "playing";
        } catch {}
      }
    }
    this.notifySubscribers();
  }

  public getSnapshot(): AmbientAudioSnapshot {
    return {
      currentMode: this.currentMode,
      playbackState: this.playbackState,
      volume: this.volume,
      isTtsSpeaking: this.isTtsSpeaking,
      seekPosition: this.getSeekPosition(),
      duration: this.getDuration(),
      errorMessage: this.errorMessage,
    };
  }

  public getCurrentMode(): AmbientMode {
    return this.currentMode;
  }

  public getPlaybackState(): AmbientPlaybackState {
    return this.playbackState;
  }

  public getVolume(): number {
    return this.volume;
  }

  public isPlaying(): boolean {
    return this.playbackState === "playing" && !this.isTtsSpeaking;
  }

  public getSeekPosition(): number {
    if (this.currentHowl && typeof this.currentHowl.seek === "function") {
      try {
        const pos = this.currentHowl.seek();
        return typeof pos === "number" ? pos : 0;
      } catch {
        return this.savedSeekPosition;
      }
    }
    return this.savedSeekPosition;
  }

  public getDuration(): number {
    if (this.currentHowl && typeof this.currentHowl.duration === "function") {
      try {
        const d = this.currentHowl.duration();
        return typeof d === "number" && d > 0 ? d : 180;
      } catch {
        return 180;
      }
    }
    return 180;
  }

  public setVolume(newVolume: number): void {
    const clamped = Math.max(0, Math.min(1, newVolume));
    this.volume = clamped;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_VOLUME, String(clamped));
      } catch {}
    }

    if (this.currentHowl) {
      try {
        this.currentHowl.volume(clamped);
      } catch {}
    }
    this.notifySubscribers();
  }

  public async play(): Promise<boolean> {
    this.errorMessage = undefined;

    // Check if mode is silent or has no audio source
    if (!this.currentMode.audioSource || this.currentMode.id === "silent") {
      this.playbackState = "unavailable";
      this.errorMessage = "SILENT (NO AUDIO)";
      this.unloadCurrentAudio();
      this.notifySubscribers();
      return false;
    }

    // Set intended state immediately to prevent duplicate invocations
    this.playbackState = "playing";
    this.notifySubscribers();

    // If ALFRED is speaking, queue playback to resume when speech ends
    if (this.isTtsSpeaking) {
      this.wasPlayingBeforeTts = true;
      return true;
    }

    const currentSeq = ++this.loadSequence;

    try {
      const HowlClass = await resolveHowlClass();
      if (!HowlClass) {
        this.playbackState = "unavailable";
        this.errorMessage = "AUDIO UNAVAILABLE";
        this.notifySubscribers();
        return false;
      }

      // If user paused or changed mode during load, do not play
      if (currentSeq !== this.loadSequence || this.playbackState !== "playing") {
        return false;
      }

      // If we don't have an active Howl instance or it was unloaded, create it
      if (!this.currentHowl) {
        const audioSrc = this.currentMode.audioSource;

        this.currentHowl = new HowlClass({
          src: [audioSrc],
          html5: true,
          loop: true,
          volume: this.volume,
          onloaderror: (_id, err) => {
            console.warn(`[AmbientAudioService] Failed to load ambient track '${audioSrc}':`, err);
            this.playbackState = "unavailable";
            this.errorMessage = "AUDIO UNAVAILABLE";
            this.unloadCurrentAudio();
            this.notifySubscribers();
          },
          onplayerror: (_id, err) => {
            console.warn(`[AmbientAudioService] Playback error on track '${audioSrc}':`, err);
            this.playbackState = "paused";
            this.errorMessage = "AUDIO PLAYBACK ERROR";
            this.notifySubscribers();
          },
        });
      }

      if (currentSeq !== this.loadSequence || !this.currentHowl || this.playbackState !== "playing") {
        if (this.currentHowl && this.playbackState !== "playing") {
          this.applyHowlPause(this.currentHowl);
        }
        return false;
      }

      // Re-enable looping flag before playing
      this.applyHowlResume(this.currentHowl);

      // Resume from saved position if exists
      if (this.savedSeekPosition > 0 && typeof this.currentHowl.seek === "function") {
        try {
          this.currentHowl.seek(this.savedSeekPosition);
        } catch {}
      }

      this.currentHowl.play();
      this.playbackState = "playing";
      this.errorMessage = undefined;

      if (typeof window !== "undefined" && window.localStorage) {
        try {
          localStorage.setItem(STORAGE_KEY_ENABLED, "true");
        } catch {}
      }

      this.notifySubscribers();
      return true;
    } catch (err: any) {
      console.warn("[AmbientAudioService] Exception starting ambient audio:", err);
      this.playbackState = "unavailable";
      this.errorMessage = "AUDIO UNAVAILABLE";
      this.unloadCurrentAudio();
      this.notifySubscribers();
      return false;
    }
  }

  public pause(): void {
    this.loadSequence++;
    this.wasPlayingBeforeTts = false;
    this.playbackState = "paused";

    if (this.currentHowl) {
      try {
        const pos = typeof this.currentHowl.seek === "function" ? this.currentHowl.seek() : 0;
        this.savedSeekPosition = typeof pos === "number" ? pos : 0;
      } catch {}
      this.applyHowlPause(this.currentHowl);
    }

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_ENABLED, "false");
      } catch {}
    }
    this.notifySubscribers();
  }

  public stop(): void {
    this.loadSequence++;
    this.wasPlayingBeforeTts = false;
    this.savedSeekPosition = 0;
    this.playbackState = "idle";

    if (this.currentHowl) {
      this.applyHowlPause(this.currentHowl);
      try {
        this.currentHowl.stop();
      } catch {}
    }

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_ENABLED, "false");
      } catch {}
    }
    this.notifySubscribers();
  }

  public async togglePlay(): Promise<void> {
    if (this.currentMode.id === "silent") {
      this.playbackState = "unavailable";
      this.errorMessage = "SILENT (NO AUDIO)";
      this.notifySubscribers();
      return;
    }

    const isCurrentlyPlaying =
      this.playbackState === "playing" ||
      (this.currentHowl && typeof this.currentHowl.playing === "function" && this.currentHowl.playing());

    if (isCurrentlyPlaying) {
      this.pause();
    } else {
      await this.play();
    }
  }

  public async setMode(modeId: string): Promise<void> {
    if (this.currentMode.id === modeId) return;

    const wasPlaying = this.playbackState === "playing" || this.wasPlayingBeforeTts;
    this.unloadCurrentAudio();
    this.wasPlayingBeforeTts = false;
    this.savedSeekPosition = 0;

    this.currentMode = getAmbientMode(modeId);
    this.errorMessage = undefined;

    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.setItem(STORAGE_KEY_MODE, this.currentMode.id);
      } catch {}
    }

    if (this.currentMode.id === "silent" || !this.currentMode.audioSource) {
      this.playbackState = "unavailable";
      this.errorMessage = "SILENT (NO AUDIO)";
      this.notifySubscribers();
      return;
    }

    if (wasPlaying) {
      await this.play();
    } else {
      this.playbackState = "idle";
      this.notifySubscribers();
    }
  }

  public async nextMode(): Promise<void> {
    const next = getNextAmbientMode(this.currentMode.id);
    await this.setMode(next.id);
  }

  public async prevMode(): Promise<void> {
    const prev = getPreviousAmbientMode(this.currentMode.id);
    await this.setMode(prev.id);
  }

  private unloadCurrentAudio(): void {
    if (this.currentHowl) {
      this.applyHowlPause(this.currentHowl);
      try {
        this.currentHowl.stop();
        this.currentHowl.unload();
      } catch {}
      this.currentHowl = null;
    }
  }

  public cleanup(): void {
    this.unloadCurrentAudio();
    if (this.ttsUnsubscribe) {
      try {
        this.ttsUnsubscribe();
      } catch {}
      this.ttsUnsubscribe = null;
    }
    this.subscribers.clear();
  }

  public subscribe(cb: (snapshot: AmbientAudioSnapshot) => void): () => void {
    this.subscribers.add(cb);
    cb(this.getSnapshot());
    return () => {
      this.subscribers.delete(cb);
    };
  }

  private notifySubscribers(): void {
    const snapshot = this.getSnapshot();
    this.subscribers.forEach((fn) => {
      try {
        fn(snapshot);
      } catch {}
    });
  }

  // Testing Hook to verify Howler interactions without relying on browser globals
  public static _setHowlFactoryForTesting(factory: HowlConstructorLike | null): void {
    customHowlFactory = factory;
  }
}

export const AmbientAudioService = new AmbientAudioServiceImpl();
