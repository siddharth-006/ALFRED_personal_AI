import { AmbientMode } from "@/types/ambient";

export const AMBIENT_MODES: AmbientMode[] = [
  {
    id: "deep-space",
    name: "Deep Space",
    tagline: "CALM • LOW DISTRACTION",
    description: "Subtle cosmic resonance with low harmonic overtones, engineered for deep spatial calm.",
    audioSource: "/audio/ambient/deep-space.wav",
    visualStyle: "deep-space",
    themeColor: "#06B6D4",
    accentGlow: "rgba(6, 182, 212, 0.35)",
    ambientCadence: "0.08 Hz Cosmic Drift",
    isAudioBacked: true,
  },
  {
    id: "rain",
    name: "Rain",
    tagline: "STEADY PRECIPITATION • NOISE VEIL",
    description: "A continuous, filtered acoustic shower dampening external environmental distraction.",
    audioSource: "/audio/ambient/rain.wav",
    visualStyle: "rain",
    themeColor: "#38BDF8",
    accentGlow: "rgba(56, 189, 248, 0.35)",
    ambientCadence: "Gentle Downpour",
    isAudioBacked: true,
  },
  {
    id: "cafe",
    name: "Cafe",
    tagline: "WARM ACOUSTIC ROOM • CHILL COMFORT",
    description: "Subtle cafe room tone and diffuse acoustic warmth for relaxed contemplation.",
    audioSource: "/audio/ambient/cafe.wav",
    visualStyle: "cafe",
    themeColor: "#F59E0B",
    accentGlow: "rgba(245, 158, 11, 0.35)",
    ambientCadence: "Warm Room Texture",
    isAudioBacked: true,
  },
  {
    id: "focus",
    name: "Focus",
    tagline: "BINAURAL CLARITY • DEEP ATTENTION",
    description: "Structured harmonic oscillation to anchor cognitive focus during complex engineering tasks.",
    audioSource: "/audio/ambient/focus.wav",
    visualStyle: "focus",
    themeColor: "#E11D48",
    accentGlow: "rgba(225, 29, 72, 0.40)",
    ambientCadence: "10 Hz Alpha Rhythm",
    isAudioBacked: true,
  },
  {
    id: "night",
    name: "Night",
    tagline: "MIDNIGHT SANCTUARY • QUIET AIR",
    description: "Dark ambient room air tone with delicate nighttime texture for late-night focus.",
    audioSource: "/audio/ambient/night.wav",
    visualStyle: "night",
    themeColor: "#818CF8",
    accentGlow: "rgba(129, 140, 248, 0.30)",
    ambientCadence: "Midnight Ambience",
    isAudioBacked: true,
  },
  {
    id: "silent",
    name: "Silent",
    tagline: "PURE VISUAL CORE • MUTED HARMONY",
    description: "Nominal visual presence with zero acoustic output for distraction-free operation.",
    audioSource: undefined,
    visualStyle: "silent",
    themeColor: "#10B981",
    accentGlow: "rgba(16, 185, 129, 0.30)",
    ambientCadence: "Silent Visual Sanctuary",
    isAudioBacked: false,
  },
];

export const DEFAULT_AMBIENT_MODE_ID = "deep-space";

export function getAmbientMode(id: string): AmbientMode {
  const found = AMBIENT_MODES.find((m) => m.id === id);
  return found || AMBIENT_MODES[0];
}

export function getNextAmbientMode(currentId: string): AmbientMode {
  const currentIndex = AMBIENT_MODES.findIndex((m) => m.id === currentId);
  const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % AMBIENT_MODES.length;
  return AMBIENT_MODES[nextIndex];
}

export function getPreviousAmbientMode(currentId: string): AmbientMode {
  const currentIndex = AMBIENT_MODES.findIndex((m) => m.id === currentId);
  const prevIndex = currentIndex <= 0 ? AMBIENT_MODES.length - 1 : currentIndex - 1;
  return AMBIENT_MODES[prevIndex];
}
