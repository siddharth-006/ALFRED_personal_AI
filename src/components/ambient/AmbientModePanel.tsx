"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Maximize2,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
} from "lucide-react";
import { AMBIENT_MODES } from "@/utils/ambientRegistry";
import { AmbientAudioService, AmbientAudioSnapshot } from "@/utils/ambientAudioService";
import { AmbientCoreVisualizer } from "./AmbientCoreVisualizer";
import { AmbientExperienceModal } from "./AmbientExperienceModal";

interface AmbientModePanelProps {
  coreState?: string;
}

export const AmbientModePanel: React.FC<AmbientModePanelProps> = ({ coreState = "idle" }) => {
  const [snapshot, setSnapshot] = useState<AmbientAudioSnapshot>(AmbientAudioService.getSnapshot());
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const unsub = AmbientAudioService.subscribe((s) => setSnapshot(s));
    return () => unsub();
  }, []);

  const currentMode = snapshot.currentMode;
  const isSilentMode = currentMode.id === "silent";
  const isPlaying = snapshot.playbackState === "playing" && !snapshot.isTtsSpeaking;

  const statusLabel = isSilentMode
    ? "SILENT • NO AUDIO"
    : snapshot.isTtsSpeaking
    ? "MUTED (SPEAKING)"
    : snapshot.errorMessage
    ? snapshot.errorMessage
    : isPlaying
    ? "PLAYING"
    : "READY";

  const statusDotColor = isSilentMode
    ? "bg-slate-500"
    : snapshot.isTtsSpeaking
    ? "bg-cyan-400 animate-pulse"
    : snapshot.errorMessage
    ? "bg-amber-400"
    : isPlaying
    ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"
    : "bg-slate-400";

  return (
    <>
      <div
        className="alfred-panel p-4 md:p-5 space-y-3 flex-1 flex flex-col justify-between transition-colors relative overflow-hidden"
        style={{
          borderLeft: `2px solid ${currentMode.themeColor}88`,
        }}
      >
        {/* Subtle Ambient Background Gradient */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20 transition-opacity duration-700"
          style={{
            background: `radial-gradient(ellipse at 80% 20%, ${currentMode.themeColor}22 0%, transparent 70%)`,
          }}
        />

        {/* Panel Header */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-2">
            <Sparkles size={15} style={{ color: currentMode.themeColor }} />
            <h3 className="font-header text-sm font-bold tracking-widest text-white uppercase">
              AMBIENT MODE
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            {/* Status Pill */}
            <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[9px] font-mono">
              <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor}`} />
              <span className="text-slate-300 font-semibold uppercase">{statusLabel}</span>
            </div>

            {/* Expand / Experience Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              aria-label="Expand Ambient Mode to Full Experience"
              title="Enter Cinematic Ambient Experience"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors focus:outline-none focus:ring-1 focus:ring-white/30"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>

        {/* Central Visualizer & Identity Core */}
        <div className="flex flex-col items-center justify-center py-1 relative z-10">
          <AmbientCoreVisualizer
            mode={currentMode}
            isPlaying={isPlaying}
            coreState={coreState}
            size="sm"
            onClick={() => setIsModalOpen(true)}
          />

          <div className="mt-2 text-center space-y-0.5">
            <div className="font-header text-xs md:text-sm font-bold tracking-widest text-white uppercase flex items-center justify-center space-x-1.5">
              <span>[</span>
              <span style={{ color: currentMode.themeColor }}>{currentMode.name}</span>
              <span>]</span>
            </div>
            <div className="font-mono text-[9px] tracking-wider text-slate-400 uppercase">
              {currentMode.tagline}
            </div>
          </div>
        </div>

        {/* Bottom Interactive Controls & Volume */}
        <div className="space-y-2 pt-1 border-t border-white/[0.06] relative z-10">
          {/* Controls: [ ◀ ] [ PLAY / PAUSE ] [ ▶ ] */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => AmbientAudioService.prevMode()}
              aria-label="Previous Ambient Mode"
              title="Previous Mode"
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.06] transition-colors focus:outline-none focus:ring-1 focus:ring-white/30"
            >
              <ChevronLeft size={14} />
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
                  ? "Pause Audio"
                  : "Play Audio"
              }
              className={`px-4 py-1.5 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1.5 transition-all ${
                isSilentMode
                  ? "bg-white/[0.03] text-slate-500 border border-white/[0.06] cursor-not-allowed"
                  : isPlaying
                  ? "bg-[#E11D48] text-white shadow-[0_0_12px_rgba(225,29,72,0.4)] border border-[#E11D48]"
                  : "bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/20"
              }`}
            >
              {isSilentMode ? (
                <span>MUTED</span>
              ) : isPlaying ? (
                <>
                  <Pause size={12} />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play size={12} />
                  <span>PLAY</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => AmbientAudioService.nextMode()}
              aria-label="Next Ambient Mode"
              title="Next Mode"
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white border border-white/[0.06] transition-colors focus:outline-none focus:ring-1 focus:ring-white/30"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Volume Slider: VOLUME ────────●── */}
          <div className="flex items-center space-x-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                AmbientAudioService.setVolume(snapshot.volume > 0 ? 0 : 0.5);
              }}
              aria-label={snapshot.volume > 0 ? "Mute Volume" : "Unmute Volume"}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {snapshot.volume === 0 ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>

            <div className="flex-1 flex items-center space-x-2">
              <span className="font-mono text-[8px] text-slate-500 uppercase tracking-wider">
                VOL
              </span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={snapshot.volume}
                onChange={(e) => AmbientAudioService.setVolume(parseFloat(e.target.value))}
                aria-label="Ambient Audio Volume Slider"
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#E11D48] focus:outline-none"
              />
              <span className="font-mono text-[8px] text-slate-400 w-6 text-right">
                {Math.round(snapshot.volume * 100)}%
              </span>
            </div>
          </div>

          {/* Mode Selection Pills */}
          <div className="grid grid-cols-6 gap-1 pt-1">
            {AMBIENT_MODES.map((m) => {
              const isSelected = m.id === currentMode.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => AmbientAudioService.setMode(m.id)}
                  aria-label={`Switch to ${m.name} Mode`}
                  title={`${m.name}: ${m.tagline}`}
                  className={`py-1 rounded text-center transition-all flex flex-col items-center justify-center border ${
                    isSelected
                      ? "bg-white/[0.08] border-white/30 text-white font-bold"
                      : "bg-white/[0.02] border-white/[0.04] text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                  }`}
                  style={{
                    borderColor: isSelected ? m.themeColor : undefined,
                  }}
                >
                  <span
                    className="w-1 h-1 rounded-full mb-0.5"
                    style={{ backgroundColor: m.themeColor }}
                  />
                  <span className="font-header text-[8px] uppercase tracking-wider truncate w-full px-0.5">
                    {m.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cinematic Modal Overlay */}
      <AmbientExperienceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        coreState={coreState}
      />
    </>
  );
};
