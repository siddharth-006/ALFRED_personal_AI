"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  Pause,
  Square,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  VolumeOff,
} from "lucide-react";
import { AmbientTimerDuration } from "@/types/ambient";
import { AMBIENT_MODES } from "@/utils/ambientRegistry";
import { AmbientAudioService, AmbientAudioSnapshot } from "@/utils/ambientAudioService";
import { AmbientCoreVisualizer } from "./AmbientCoreVisualizer";

interface AmbientExperienceModalProps {
  isOpen: boolean;
  onClose: () => void;
  coreState?: string;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const AmbientExperienceModal: React.FC<AmbientExperienceModalProps> = ({
  isOpen,
  onClose,
  coreState = "idle",
}) => {
  const [mounted, setMounted] = useState(false);
  const [snapshot, setSnapshot] = useState<AmbientAudioSnapshot>(AmbientAudioService.getSnapshot());
  const [sessionDuration, setSessionDuration] = useState<AmbientTimerDuration>(null);
  const [sessionSecondsRemaining, setSessionSecondsRemaining] = useState<number | null>(null);
  const [currentElapsed, setCurrentElapsed] = useState<number>(0);
  const [totalDuration, setTotalDuration] = useState<number>(180);
  const [sessionComplete, setSessionComplete] = useState<boolean>(false);

  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const trackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Client-side mount for createPortal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Subscribe to service snapshot
  useEffect(() => {
    const unsub = AmbientAudioService.subscribe((s) => setSnapshot(s));
    return () => unsub();
  }, []);

  // Track position timer (polls seek position while playing)
  useEffect(() => {
    if (!isOpen) return;

    const updateTrackTime = () => {
      const pos = AmbientAudioService.getSeekPosition();
      const dur = AmbientAudioService.getDuration();
      setCurrentElapsed(pos);
      setTotalDuration(dur);
    };

    updateTrackTime();

    if (snapshot.playbackState === "playing" && !snapshot.isTtsSpeaking) {
      trackTimerRef.current = setInterval(updateTrackTime, 500);
    } else {
      if (trackTimerRef.current) clearInterval(trackTimerRef.current);
    }

    return () => {
      if (trackTimerRef.current) clearInterval(trackTimerRef.current);
    };
  }, [isOpen, snapshot.playbackState, snapshot.isTtsSpeaking, snapshot.currentMode.id]);

  // Ambient session timer (playback timer only, strictly isolated from focus)
  useEffect(() => {
    if (sessionDuration === null || snapshot.playbackState !== "playing") {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      return;
    }

    if (sessionSecondsRemaining === null) {
      setSessionSecondsRemaining(sessionDuration * 60);
      setSessionComplete(false);
    }

    sessionTimerRef.current = setInterval(() => {
      setSessionSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          AmbientAudioService.pause();
          setSessionComplete(true);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    };
  }, [sessionDuration, snapshot.playbackState, sessionSecondsRemaining]);

  const handleSelectDuration = (duration: AmbientTimerDuration) => {
    setSessionDuration(duration);
    setSessionSecondsRemaining(duration ? duration * 60 : null);
    setSessionComplete(false);
  };

  // Keyboard accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === " ") {
        if (document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "BUTTON") {
          e.preventDefault();
          AmbientAudioService.togglePlay();
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        AmbientAudioService.prevMode();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        AmbientAudioService.nextMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  const currentMode = snapshot.currentMode;
  const isSilentMode = currentMode.id === "silent";
  const isPlaying = snapshot.playbackState === "playing" && !snapshot.isTtsSpeaking;

  // Track status label
  const statusLabel = isSilentMode
    ? "SILENT / NO AUDIO"
    : snapshot.isTtsSpeaking
    ? "MUTED FOR VOICE (SPEAKING)"
    : snapshot.errorMessage
    ? snapshot.errorMessage
    : isPlaying
    ? "PLAYING"
    : "PAUSED";

  const statusDotColor = isSilentMode
    ? "bg-slate-500"
    : snapshot.isTtsSpeaking
    ? "bg-cyan-400 animate-pulse"
    : snapshot.errorMessage
    ? "bg-amber-400"
    : isPlaying
    ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"
    : "bg-slate-400";

  const formattedSessionTimer = sessionSecondsRemaining !== null
    ? formatTime(sessionSecondsRemaining)
    : null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="ambient-experience-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ambient-fullscreen-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[99999] w-screen h-screen flex flex-col items-center justify-between p-6 md:p-10 bg-[#06080D]/95 backdrop-blur-2xl text-slate-100 overflow-y-auto select-none"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
          }}
        >
          {/* Subtle Ambient Radial Aura */}
          <div
            className="fixed inset-0 pointer-events-none transition-opacity duration-1000"
            style={{
              background: `radial-gradient(circle at 50% 45%, ${currentMode.themeColor}18 0%, transparent 65%)`,
              zIndex: -1,
            }}
          />

          {/* Top Bar: Title & Close */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-5xl flex items-center justify-between border-b border-white/[0.08] pb-4"
          >
            <div className="flex items-center space-x-3">
              <Sparkles size={18} style={{ color: currentMode.themeColor }} />
              <div>
                <h1
                  id="ambient-fullscreen-title"
                  className="font-header text-sm md:text-base font-bold tracking-widest uppercase text-white"
                >
                  ALFRED AMBIENT ENVIRONMENT
                </h1>
                <div className="font-mono text-[10px] text-slate-500 tracking-wider uppercase">
                  IMMERSIVE DESKTOP OS SANCTUARY
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {/* Status Pill */}
              <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] font-mono text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
                <span className="text-slate-300 font-semibold uppercase">{statusLabel}</span>
              </div>

              {/* Close Button: ESC / ✕ */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Ambient Fullscreen Experience"
                title="Return to Dashboard (ESC)"
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.08] transition-colors focus:outline-none focus:ring-1 focus:ring-white/40"
              >
                <span className="font-mono text-[10px] text-slate-400 uppercase">ESC</span>
                <X size={16} />
              </button>
            </div>
          </motion.div>

          {/* Central Stage: Large Visualizer, Mode Identity, Elapsed Counter, & Transport */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 flex flex-col items-center justify-center my-6 space-y-6 w-full max-w-2xl text-center"
          >
            {/* Visualizer Core */}
            <AmbientCoreVisualizer
              mode={currentMode}
              isPlaying={isPlaying}
              coreState={coreState}
              size="lg"
            />

            {/* Mode Identity */}
            <div className="space-y-1">
              <h2 className="font-header text-3xl md:text-4xl font-bold tracking-widest text-white uppercase">
                {currentMode.name}
              </h2>
              <div
                className="font-mono text-xs md:text-sm font-semibold tracking-widest uppercase"
                style={{ color: currentMode.themeColor }}
              >
                {currentMode.tagline}
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto pt-1 font-sans">
                {currentMode.description}
              </p>
            </div>

            {/* Track Progress Counter: [ 02:14 / 03:00 ] */}
            <div className="font-mono text-sm tracking-widest text-slate-300 bg-white/[0.03] px-4 py-1.5 rounded-full border border-white/[0.06] flex items-center space-x-2">
              {isSilentMode ? (
                <>
                  <VolumeOff size={14} className="text-emerald-400" />
                  <span className="text-emerald-400 font-bold">SILENT • NO AUDIO</span>
                </>
              ) : (
                <>
                  <span className="text-white font-semibold">{formatTime(currentElapsed)}</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-slate-400">{formatTime(totalDuration)}</span>
                </>
              )}
            </div>

            {/* Transport Controls: [ ◀ ] [ PLAY / PAUSE ] [ ■ ] [ ▶ ] */}
            <div className="flex items-center space-x-5 pt-2">
              <button
                type="button"
                onClick={() => AmbientAudioService.prevMode()}
                aria-label="Previous Ambient Mode"
                title="Previous Mode (Left Arrow)"
                className="p-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition-colors focus:outline-none focus:ring-1 focus:ring-white/40"
              >
                <ChevronLeft size={20} />
              </button>

              <button
                type="button"
                onClick={() => AmbientAudioService.togglePlay()}
                disabled={isSilentMode}
                aria-label={isPlaying ? "Pause Ambient Audio" : "Play Ambient Audio"}
                title={
                  isSilentMode
                    ? "Silent Mode (No Audio)"
                    : isPlaying
                    ? "Pause (Space)"
                    : "Play (Space)"
                }
                className={`px-8 py-3 rounded-full font-mono text-xs font-bold uppercase tracking-widest flex items-center space-x-2.5 transition-all ${
                  isSilentMode
                    ? "bg-white/[0.04] text-slate-500 border border-white/[0.06] cursor-not-allowed"
                    : isPlaying
                    ? "bg-[#E11D48] text-white shadow-[0_0_24px_rgba(225,29,72,0.5)] border border-[#E11D48]"
                    : "bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/20"
                }`}
              >
                {isSilentMode ? (
                  <>
                    <VolumeOff size={16} />
                    <span>MUTED</span>
                  </>
                ) : isPlaying ? (
                  <>
                    <Pause size={16} />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play size={16} />
                    <span>PLAY</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => AmbientAudioService.stop()}
                disabled={isSilentMode}
                aria-label="Stop Ambient Audio"
                title="Stop Audio"
                className="p-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-rose-400 border border-white/[0.08] transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-white/40"
              >
                <Square size={17} />
              </button>

              <button
                type="button"
                onClick={() => AmbientAudioService.nextMode()}
                aria-label="Next Ambient Mode"
                title="Next Mode (Right Arrow)"
                className="p-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition-colors focus:outline-none focus:ring-1 focus:ring-white/40"
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {/* Volume Slider: VOLUME ─────────●──────── */}
            <div className="w-full max-w-md flex items-center space-x-3 px-4 pt-1">
              <button
                type="button"
                onClick={() => {
                  AmbientAudioService.setVolume(snapshot.volume > 0 ? 0 : 0.5);
                }}
                disabled={isSilentMode}
                aria-label={snapshot.volume > 0 ? "Mute Volume" : "Unmute Volume"}
                className="text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                {snapshot.volume === 0 || isSilentMode ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>

              <div className="flex-1 flex items-center space-x-2">
                <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                  VOL
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  disabled={isSilentMode}
                  value={snapshot.volume}
                  onChange={(e) => AmbientAudioService.setVolume(parseFloat(e.target.value))}
                  aria-label="Ambient Audio Volume Slider"
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#E11D48] disabled:cursor-not-allowed focus:outline-none"
                />
                <span className="font-mono text-[10px] text-slate-400 w-10 text-right">
                  {Math.round(snapshot.volume * 100)}%
                </span>
              </div>
            </div>

            {/* Mode Selection Pills Strip */}
            <div className="w-full max-w-xl grid grid-cols-3 sm:grid-cols-6 gap-2 pt-2">
              {AMBIENT_MODES.map((m) => {
                const isSelected = m.id === currentMode.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => AmbientAudioService.setMode(m.id)}
                    aria-pressed={isSelected}
                    aria-label={`Switch to ${m.name} Mode`}
                    className={`py-2 px-2 rounded-xl border text-center transition-all flex flex-col items-center justify-center space-y-1 ${
                      isSelected
                        ? "bg-white/[0.08] border-white/40 shadow-sm"
                        : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15"
                    }`}
                    style={{
                      borderColor: isSelected ? m.themeColor : undefined,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: m.themeColor,
                        boxShadow: isSelected ? `0 0 6px ${m.themeColor}` : undefined,
                      }}
                    />
                    <span
                      className={`font-header text-xs tracking-wider uppercase font-bold truncate w-full ${
                        isSelected ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {m.name}
                    </span>
                    <span className="font-mono text-[8px] text-slate-500 uppercase">
                      {m.id === "silent" ? "MUTED" : "AUDIO"}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Bottom Bar: Ambient Session Timer & Return Action */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between border-t border-white/[0.08] pt-4 gap-3 text-xs"
          >
            {/* Ambient Playback Session Timer */}
            <div className="flex items-center space-x-2 font-mono text-[10px] text-slate-400">
              <Clock size={13} className="text-slate-400" />
              <span>AMBIENT SESSION:</span>
              {sessionComplete ? (
                <span className="text-amber-400 font-bold ml-1">SESSION COMPLETE</span>
              ) : formattedSessionTimer ? (
                <span className="text-emerald-400 font-bold ml-1">{formattedSessionTimer}</span>
              ) : null}

              <div className="flex items-center space-x-1 ml-2">
                {([15, 30, 60, null] as AmbientTimerDuration[]).map((d) => {
                  const isSelected = sessionDuration === d;
                  return (
                    <button
                      key={d === null ? "inf" : d}
                      type="button"
                      onClick={() => handleSelectDuration(d)}
                      className={`px-2 py-0.5 rounded text-[9px] transition-colors ${
                        isSelected
                          ? "bg-white/20 text-white font-bold"
                          : "bg-white/[0.04] text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {d === null ? "∞" : `${d}m`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Return Action */}
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-header font-bold tracking-widest text-slate-300 hover:text-white uppercase transition-colors focus:outline-none focus:ring-1 focus:ring-white/40"
            >
              RETURN TO DASHBOARD
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
