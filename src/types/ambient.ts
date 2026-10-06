export type AmbientModeId = "deep-space" | "rain" | "cafe" | "focus" | "night" | "silent";

export interface AmbientMode {
  id: AmbientModeId | string;
  name: string;
  tagline: string;
  description: string;
  audioSource?: string;
  visualStyle: "deep-space" | "rain" | "cafe" | "focus" | "night" | "silent";
  themeColor: string;
  accentGlow: string;
  ambientCadence: string;
  isAudioBacked: boolean;
}

export type AmbientPlaybackState = "idle" | "playing" | "paused" | "unavailable";

export interface AmbientSessionSettings {
  selectedModeId: string;
  volume: number; // 0.0 to 1.0
  isPlaying: boolean;
}

export type AmbientTimerDuration = 15 | 30 | 60 | null; // minutes, null = infinite
