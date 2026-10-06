"use client";

/**
 * ALFRED Audio Service (Phase 5.4 - Professional Sound System)
 *
 * Cohesive, subtle, futuristic desktop AI sound language:
 * - Pure Web Audio API synthesis (100% offline, zero external downloads)
 * - Restrained, cinematic, technological acoustic identity
 * - Volume control (0.0 to 1.0) with local persistence (alfred_audio_settings_v1)
 * - Mute / Enable toggle
 * - Event cooldowns & debouncing to prevent audio storms
 * - Ambient thinking tone with controlled duration & immediate stop
 */

export type AlfredAudioEvent =
  | "boot"
  | "command"
  | "thinking"
  | "executing"
  | "success"
  | "error"
  | "confirmation"
  | "workspace"
  | "taskComplete"
  | "focusStart"
  | "focusPause"
  | "focusResume"
  | "focusReset"
  | "focusComplete"
  | "notification"
  | "wake"
  | "click"
  | "hover";

export interface AlfredAudioSettings {
  enabled: boolean;
  volume: number; // 0.0 to 1.0, default 0.35
}

const SETTINGS_STORAGE_KEY = "alfred_audio_settings_v1";
const LEGACY_STORAGE_KEY = "alfred_sound_enabled";

// Per-event cooldowns in milliseconds to prevent audio spam & storming
const EVENT_COOLDOWNS: Record<AlfredAudioEvent, number> = {
  boot: 1000,
  command: 150,
  thinking: 2000,
  executing: 300,
  success: 250,
  error: 300,
  confirmation: 400,
  workspace: 500,
  taskComplete: 200,
  focusStart: 400,
  focusPause: 400,
  focusResume: 400,
  focusReset: 400,
  focusComplete: 600,
  notification: 400,
  wake: 400,
  click: 60,
  hover: 80,
};

class AlfredAudioServiceImpl {
  private ctx: AudioContext | null = null;
  private settings: AlfredAudioSettings = {
    enabled: true,
    volume: 0.35, // Restrained default
  };
  private userInteracted = false;
  private lastPlayedTimestamp: Map<AlfredAudioEvent, number> = new Map();
  private isThinkingActive = false;
  private thinkingTimer: any = null;
  private thinkingGainNode: GainNode | null = null;
  private thinkingOscNodes: OscillatorNode[] = [];

  constructor() {
    this.loadSettings();
    if (typeof window !== "undefined") {
      const markInteracted = () => {
        this.userInteracted = true;
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
        window.removeEventListener("click", markInteracted, true);
        window.removeEventListener("keydown", markInteracted, true);
        window.removeEventListener("pointerdown", markInteracted, true);
      };
      window.addEventListener("click", markInteracted, true);
      window.addEventListener("keydown", markInteracted, true);
      window.addEventListener("pointerdown", markInteracted, true);
    }
  }

  private loadSettings() {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = {
          enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
          volume:
            typeof parsed.volume === "number"
              ? Math.max(0, Math.min(1, parsed.volume))
              : 0.35,
        };
      } else {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy !== null) {
          this.settings.enabled = legacy !== "false";
        }
      }
    } catch {
      // Fallback to default
    }
  }

  public saveSettings() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.settings));
      localStorage.setItem(LEGACY_STORAGE_KEY, this.settings.enabled ? "true" : "false");
    } catch {}
  }

  public init() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        try {
          this.ctx = new AudioCtxClass();
        } catch {
          // AudioContext not supported
        }
      }
    }
    if (this.userInteracted && this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public isEnabled(): boolean {
    return this.settings.enabled;
  }

  public setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    if (!enabled) {
      this.stopThinking();
    }
    this.saveSettings();
  }

  public getVolume(): number {
    return this.settings.volume;
  }

  public setVolume(volume: number) {
    this.settings.volume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  /**
   * Main entry point to play semantic ALFRED audio events
   */
  public play(event: AlfredAudioEvent, customVolumeMultiplier: number = 1.0): boolean {
    if (!this.settings.enabled) return false;

    // Check cooldown
    const now = Date.now();
    const last = this.lastPlayedTimestamp.get(event) || 0;
    const cooldown = EVENT_COOLDOWNS[event] ?? 100;
    if (now - last < cooldown) {
      return false; // Suppress duplicate/audio storm
    }
    this.lastPlayedTimestamp.set(event, now);

    this.init();
    const ctx = this.ctx;
    if (!ctx) return false;

    // Attempt to resume if suspended (e.g. following browser autoplay requirements)
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
      if (!this.userInteracted) {
        return false;
      }
    }

    const t = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    // Apply combined master volume & event scaling
    const finalVolume = this.settings.volume * customVolumeMultiplier;
    masterGain.gain.setValueAtTime(Math.max(0.0001, finalVolume), t);

    try {
      this.synthesizeEvent(event, ctx, masterGain, t);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Controlled thinking state management:
   * Emits a subtle, low-frequency computing pulse that stops cleanly when AI completes.
   */
  public startThinking() {
    if (!this.settings.enabled || this.isThinkingActive) return;
    this.isThinkingActive = true;

    // Play subtle initial thinking recognition chime
    this.play("thinking", 0.4);

    // Controlled, extremely quiet ambient pulse every 2.4 seconds (max 5 pulses then auto-stops)
    let pulseCount = 0;
    if (this.thinkingTimer) clearInterval(this.thinkingTimer);
    this.thinkingTimer = setInterval(() => {
      if (!this.isThinkingActive || !this.settings.enabled) {
        this.stopThinking();
        return;
      }
      pulseCount++;
      if (pulseCount > 6) {
        // Stop automatically after ~15s to never become annoying
        this.stopThinking();
        return;
      }
      this.play("thinking", 0.25);
    }, 2400);
  }

  public stopThinking() {
    this.isThinkingActive = false;
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null;
    }
    if (this.thinkingGainNode && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.thinkingGainNode.gain.cancelScheduledValues(now);
        this.thinkingGainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      } catch {}
    }
    this.thinkingOscNodes.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.thinkingOscNodes = [];
    this.thinkingGainNode = null;
  }

  /**
   * Sound synthesis library: pure Web Audio API sound design
   */
  private synthesizeEvent(
    event: AlfredAudioEvent,
    ctx: AudioContext,
    destination: GainNode,
    now: number
  ) {
    switch (event) {
      case "boot": {
        // SYSTEM BOOT SEQUENCE:
        // 1. Deep sub-bass surge (60Hz -> 110Hz)
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = "sine";
        sub.frequency.setValueAtTime(55, now);
        sub.frequency.exponentialRampToValueAtTime(110, now + 0.6);
        subGain.gain.setValueAtTime(0, now);
        subGain.gain.linearRampToValueAtTime(0.22, now + 0.15);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        sub.connect(subGain);
        subGain.connect(destination);
        sub.start(now);
        sub.stop(now + 1.0);

        // 2. Twin crystal chime harmonic rising (392Hz G4 -> 784Hz G5 -> 1174Hz D6)
        const chords = [392, 587.33, 880, 1174.66];
        chords.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq * 0.98, now + 0.1 + idx * 0.06);
          osc.frequency.exponentialRampToValueAtTime(freq, now + 0.18 + idx * 0.06);

          gain.gain.setValueAtTime(0, now + 0.1 + idx * 0.06);
          gain.gain.linearRampToValueAtTime(0.08, now + 0.15 + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8 + idx * 0.06);

          osc.connect(gain);
          gain.connect(destination);
          osc.start(now + 0.1 + idx * 0.06);
          osc.stop(now + 1.1);
        });
        break;
      }

      case "command": {
        // COMMAND: Short, precise, crisp digital acknowledgement (sine + bandpass)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(740, now);
        osc.frequency.exponentialRampToValueAtTime(1240, now + 0.04);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }

      case "thinking": {
        // THINKING: Extremely subtle, warm dual-frequency harmonic pulse
        const freqs = [440, 554.37]; // A4 and C#5 (warm major third)
        freqs.forEach((f, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, now + i * 0.03);

          gain.gain.setValueAtTime(0, now + i * 0.03);
          gain.gain.linearRampToValueAtTime(0.04, now + 0.04 + i * 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.35 + i * 0.03);

          osc.connect(gain);
          gain.connect(destination);
          osc.start(now + i * 0.03);
          osc.stop(now + 0.45);
        });
        break;
      }

      case "executing": {
        // EXECUTING: Soft, high-tech pulse (triangular sweep down)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.14);
        break;
      }

      case "success": {
        // SUCCESS: Subtle ascending two-tone affirmative chime (F#5 -> B5)
        const notes = [739.99, 987.77];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          const start = now + idx * 0.07;
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);

          osc.connect(gain);
          gain.connect(destination);
          osc.start(start);
          osc.stop(start + 0.5);
        });
        break;
      }

      case "error": {
        // ERROR: Restrained, low dissonant double pulse (not harsh, professional warning)
        const tones = [220, 207.65]; // Minor second interval for gentle technological dissonance
        tones.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          const start = now + idx * 0.04;
          osc.frequency.setValueAtTime(freq, start);

          // Low-pass filter to soften sawtooth
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(450, start);

          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.08, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(destination);
          osc.start(start);
          osc.stop(start + 0.4);
        });
        break;
      }

      case "confirmation": {
        // CONFIRMATION: Warm amber attention tone (F#4 + A#4 rising to C#5)
        const notes = [369.99, 466.16, 554.37];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          const start = now + idx * 0.05;
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

          osc.connect(gain);
          gain.connect(destination);
          osc.start(start);
          osc.stop(start + 0.55);
        });
        break;
      }

      case "workspace": {
        // WORKSPACE LAUNCH: Wide activation & spatial expansion tone
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc2.type = "triangle";
        osc1.frequency.setValueAtTime(261.63, now); // C4
        osc1.frequency.exponentialRampToValueAtTime(523.25, now + 0.25); // C5
        osc2.frequency.setValueAtTime(329.63, now); // E4
        osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.25); // E5

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.65);
        osc2.stop(now + 0.65);
        break;
      }

      case "taskComplete": {
        // TASK COMPLETE: Short, crisp, gratifying confirmation (high harmonic G5 -> C6)
        const steps = [783.99, 1046.5];
        steps.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          const start = now + i * 0.055;
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.11, start + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

          osc.connect(gain);
          gain.connect(destination);
          osc.start(start);
          osc.stop(start + 0.4);
        });
        break;
      }

      case "focusStart": {
        // FOCUS START: Calm, deep atmospheric activation tone (D4 -> F#4)
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        sub.type = "sine";
        osc.frequency.setValueAtTime(293.66, now); // D4
        osc.frequency.linearRampToValueAtTime(369.99, now + 0.3); // F#4
        sub.frequency.setValueAtTime(146.83, now); // D3

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.13, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

        osc.connect(gain);
        sub.connect(gain);
        gain.connect(destination);
        osc.start(now);
        sub.start(now);
        osc.stop(now + 0.9);
        sub.stop(now + 0.9);
        break;
      }

      case "focusPause": {
        // FOCUS PAUSE: Soft descending transition (E4 -> B3)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(329.63, now);
        osc.frequency.exponentialRampToValueAtTime(246.94, now + 0.22);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.45);
        break;
      }

      case "focusResume": {
        // FOCUS RESUME: Soft ascending transition (B3 -> E4)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(246.94, now);
        osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.2);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.45);
        break;
      }

      case "focusReset": {
        // FOCUS RESET: Low subtle release tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.25);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.07, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }

      case "focusComplete": {
        // FOCUS COMPLETE: Celebratory yet professional sequence (D maj chord: D4, F#4, A4, D5)
        const chord = [293.66, 369.99, 440.0, 587.33];
        chord.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          const start = now + idx * 0.09;
          osc.frequency.setValueAtTime(freq, start);

          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.12, start + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.9);

          osc.connect(gain);
          gain.connect(destination);
          osc.start(start);
          osc.stop(start + 1.0);
        });
        break;
      }

      case "notification": {
        // NOTIFICATION: Subtle futuristic alert ping
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      }

      case "wake": {
        // WAKE WORD DETECTED: Elegant dual-chime harmonic acknowledgement (A5 -> E6)
        const notes = [880, 1318.51];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const noteStart = now + idx * 0.07;
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq * 0.98, noteStart);
          osc.frequency.exponentialRampToValueAtTime(freq, noteStart + 0.03);

          gain.gain.setValueAtTime(0, noteStart);
          gain.gain.linearRampToValueAtTime(0.14, noteStart + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.28);

          osc.connect(gain);
          gain.connect(destination);
          osc.start(noteStart);
          osc.stop(noteStart + 0.3);
        });
        break;
      }

      case "click": {
        // Precision micro tactile click
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.04);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }

      case "hover": {
        // Delicate micro hover tick
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(3200, now);
        osc.frequency.exponentialRampToValueAtTime(6400, now + 0.015);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.03, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

        osc.connect(gain);
        gain.connect(destination);
        osc.start(now);
        osc.stop(now + 0.035);
        break;
      }
    }
  }
}

// Global Singleton Instance
export const AlfredAudioService = new AlfredAudioServiceImpl();

// Backward-compatible exports matching existing codebase call sites
export const initAudio = () => AlfredAudioService.init();
export const setSoundEnabled = (enabled: boolean) => AlfredAudioService.setEnabled(enabled);
export const isSoundEnabled = () => AlfredAudioService.isEnabled();
export const setMasterVolume = (volume: number) => AlfredAudioService.setVolume(volume);
export const getMasterVolume = () => AlfredAudioService.getVolume();

export const playClickSound = () => AlfredAudioService.play("click");
export const playHoverSound = () => AlfredAudioService.play("hover");
export const playSuccessSound = () => AlfredAudioService.play("success");
export const playStartupSound = () => AlfredAudioService.play("boot");
export const playScanSound = () => AlfredAudioService.play("notification");
export const playWakeSound = () => AlfredAudioService.play("wake");
