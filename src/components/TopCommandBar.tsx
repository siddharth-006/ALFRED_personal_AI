"use client";

import React, { useEffect, useState } from "react";
import { Volume2, VolumeX, CheckSquare, Target, Radio, Settings } from "lucide-react";
import AIProviderSelector from "./AIProviderSelector";
import AlfredCore, { CoreState } from "./AlfredCore";
import { useTasks } from "@/context/TaskContext";
import { useGoals } from "@/context/GoalContext";
import {
  isSoundEnabled,
  setSoundEnabled,
  playClickSound,
  getMasterVolume,
  setMasterVolume,
} from "@/utils/audioSystem";
import { subscribeToAlfredActivity, AlfredActivityEventDetail } from "@/utils/activityBus";
import { WakeWordService, WakeWordStatusState } from "@/utils/wakeWordService";
import { TtsClientService, TtsStatusState } from "@/utils/ttsService";

export default function TopCommandBar() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  const [soundOn, setSoundOn] = useState(true);
  const [volume, setVolumeState] = useState(0.35);
  const [coreState, setCoreState] = useState<CoreState>("idle");
  const [activeActivityLabel, setActiveActivityLabel] = useState<string | null>(null);
  const [wakeState, setWakeState] = useState<WakeWordStatusState>("disabled");
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [ttsState, setTtsState] = useState<TtsStatusState>("ready");
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const { tasks } = useTasks();
  const { goals } = useGoals();

  const pendingTasks = tasks.filter((t) => !t.completed).length;
  const activeGoals = goals.filter((g) => !g.completed).length;

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    setVolumeState(getMasterVolume());

    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
      setDate(
        now.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "2-digit",
        }).toUpperCase()
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen to global activity bus to synchronize core presence in TopCommandBar
  useEffect(() => {
    const unsubscribe = subscribeToAlfredActivity((event: AlfredActivityEventDetail) => {
      if (event.state) {
        setCoreState(event.state);
      }
      if (event.label) {
        setActiveActivityLabel(event.label);
      }
      if (event.state === "success" || event.state === "error") {
        setTimeout(() => {
          setCoreState("idle");
          setActiveActivityLabel(null);
        }, 3000);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to WakeWordService state
  useEffect(() => {
    setWakeEnabled(WakeWordService.isFeatureEnabled());
    const unsubscribe = WakeWordService.subscribeStatus((state) => {
      setWakeState(state);
      setWakeEnabled(WakeWordService.isFeatureEnabled());
      if (state === "listening") {
        setActiveActivityLabel('Listening for "Hey Alfred"');
      } else if (state === "wake_detected") {
        setActiveActivityLabel("Wake Phrase Detected!");
      }
    });
    return () => unsubscribe();
  }, []);

  // Listen to TtsClientService state
  useEffect(() => {
    setTtsEnabled(TtsClientService.isFeatureEnabled());
    const unsubscribe = TtsClientService.subscribeStatus((state) => {
      setTtsState(state);
      setTtsEnabled(TtsClientService.isFeatureEnabled());
    });
    return () => unsubscribe();
  }, []);

  const toggleWakeWord = async () => {
    playClickSound();
    const willEnable = !WakeWordService.isFeatureEnabled();
    setWakeEnabled(willEnable);
    await WakeWordService.setEnabled(willEnable);
  };

  const toggleTts = async () => {
    playClickSound();
    const willEnable = !TtsClientService.isFeatureEnabled();
    setTtsEnabled(willEnable);
    await TtsClientService.setEnabled(willEnable);
  };

  const toggleAudio = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playClickSound();
  };

  const handleVolumeChange = (newVol: number) => {
    setVolumeState(newVol);
    setMasterVolume(newVol);
  };

  const openTerminal = () => {
    playClickSound();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-command-terminal"));
    }
  };

  return (
    <header className="w-full h-11 bg-[#06080D]/90 border-b border-white/[0.05] backdrop-blur-xl flex items-center justify-between px-4 z-50 shrink-0 select-none">
      {/* Left: System Status & Workstation Brand */}
      <div className="flex items-center space-x-3">
        <div
          onClick={openTerminal}
          className="cursor-pointer group flex items-center space-x-2 py-1 px-1.5 rounded hover:bg-white/[0.03] transition-colors"
          title="Click to interact with ALFRED"
        >
          <AlfredCore
            size="xs"
            compact={true}
            state={coreState}
            interactive={true}
          />
          <div className="flex items-center space-x-2">
            <span className="font-header font-bold text-xs tracking-wider text-white group-hover:text-[#E11D48] transition-colors">
              ALFRED
            </span>
            <span className="text-[10px] text-slate-500 font-sans">
              • {activeActivityLabel || "Ready"}
            </span>
          </div>
        </div>

        {/* Real Live Task & Goal Status (Clean Inline Format) */}
        <div className="hidden lg:flex items-center space-x-3 pl-3 border-l border-white/[0.06] text-xs font-sans text-slate-400">
          <span className="flex items-center space-x-1.5 text-slate-400">
            <CheckSquare size={12} className="text-[#06B6D4]" />
            <span className="text-slate-200 font-medium">{pendingTasks}</span>
            <span className="text-slate-500 text-[11px]">tasks pending</span>
          </span>

          <span className="flex items-center space-x-1.5 text-slate-400">
            <Target size={12} className="text-[#E11D48]" />
            <span className="text-slate-200 font-medium">{activeGoals}</span>
            <span className="text-slate-500 text-[11px]">active goals</span>
          </span>
        </div>
      </div>

      {/* Center: Top Philosophy Quote from Reference */}
      <div className="flex-1 max-w-xl mx-auto text-center hidden md:block">
        <p className="text-xs font-header tracking-widest uppercase text-slate-400 font-medium">
          &quot;A MORE DISCIPLINED YOU. A BRIGHTER TOMORROW.&quot;
        </p>
      </div>

      {/* Right: Date, Time & Quick Controls matching reference image */}
      <div className="flex items-center space-x-3">
        <AIProviderSelector />

        {/* Wake Word Pill Toggle */}
        <button
          type="button"
          onClick={toggleWakeWord}
          className={`flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-mono tracking-wider uppercase transition-all cursor-pointer ${
            !wakeEnabled || wakeState === "disabled"
              ? "bg-white/[0.03] border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]"
              : wakeState === "listening"
              ? "bg-[#06B6D4]/20 border border-[#06B6D4] text-[#06B6D4] shadow-[0_0_10px_rgba(6,182,212,0.35)] animate-pulse"
              : wakeState === "wake_detected"
              ? "bg-rose-500/30 border border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.6)]"
              : wakeState === "error"
              ? "bg-amber-500/20 border border-amber-500 text-amber-400"
              : "bg-[#06B6D4]/10 border border-[#06B6D4]/40 text-[#06B6D4]"
          }`}
          title={
            wakeEnabled
              ? 'Local wake word active ("Hey Alfred"). Click to disable.'
              : 'Enable local wake word ("Hey Alfred"). Offline & local only.'
          }
        >
          <Radio size={11} className={wakeEnabled && wakeState === "listening" ? "animate-pulse" : ""} />
          <span className="hidden sm:inline">
            {!wakeEnabled || wakeState === "disabled"
              ? "WAKE OFF"
              : wakeState === "listening"
              ? "WAKE ACTIVE"
              : wakeState === "wake_detected"
              ? "WAKE DETECTED"
              : wakeState === "error"
              ? "WAKE ERROR"
              : "WAKE READY"}
          </span>
        </button>

        {/* Local Text-to-Speech Toggle Button */}
        <button
          type="button"
          onClick={toggleTts}
          title={
            !ttsEnabled || ttsState === "disabled"
              ? "Voice Responses: OFF (Click to enable)"
              : ttsState === "speaking"
              ? "ALFRED is speaking (Click to interrupt)"
              : "Voice Responses: ON (Click to disable)"
          }
          className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg border text-[11px] font-mono font-medium transition-all cursor-pointer ${
            !ttsEnabled || ttsState === "disabled"
              ? "bg-slate-900/60 border-slate-700/50 text-slate-500 hover:text-slate-300 hover:border-slate-600"
              : ttsState === "speaking"
              ? "bg-[#06B6D4]/20 border-[#06B6D4]/60 text-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.3)] animate-pulse"
              : ttsState === "error"
              ? "bg-[#E11D48]/20 border-[#E11D48]/50 text-[#E11D48]"
              : "bg-cyan-950/30 border-cyan-800/40 text-cyan-400 hover:bg-cyan-900/40"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              !ttsEnabled || ttsState === "disabled"
                ? "bg-slate-600"
                : ttsState === "speaking"
                ? "bg-[#06B6D4] animate-ping"
                : ttsState === "error"
                ? "bg-[#E11D48]"
                : "bg-cyan-400"
            }`}
          />
          <span className="hidden sm:inline">
            {!ttsEnabled || ttsState === "disabled"
              ? "TTS OFF"
              : ttsState === "speaking"
              ? "SPEAKING"
              : ttsState === "error"
              ? "TTS ERR"
              : "TTS ON"}
          </span>
        </button>

        <div className="relative flex items-center space-x-1.5">
          <button
            type="button"
            onClick={toggleAudio}
            title={soundOn ? "Mute interface audio" : "Enable interface audio"}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            {soundOn ? (
              <Volume2 size={15} className="text-slate-300" />
            ) : (
              <VolumeX size={15} className="text-slate-500" />
            )}
          </button>
          {soundOn && (
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              title={`Master Volume: ${Math.round(volume * 100)}%`}
              className="w-14 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#E11D48]"
            />
          )}
        </div>

        {/* Live Date & Time Cluster from Reference Image */}
        <div className="text-right pl-3 border-l border-white/[0.08] flex items-center space-x-3">
          <div>
            <div className="text-[10px] font-sans font-medium text-slate-400">
              {date || "THU, 25 SEP 2026"}
            </div>
            <div className="font-header text-sm font-bold text-white tracking-wider">
              {time || "09:41 AM"}
            </div>
          </div>

          {/* Top Quick Actions from Reference */}
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={openTerminal}
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 hover:text-white transition-all cursor-pointer relative"
              title="Notifications / Activity"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#E11D48] absolute top-1 right-1" />
              <span className="text-xs font-mono">🔔</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                if (typeof window !== "undefined") {
                  window.dispatchEvent(new CustomEvent("open-settings-modal"));
                }
              }}
              className="p-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Settings & System Configuration"
            >
              <Settings size={14} />
            </button>
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#E11D48] to-[#06B6D4] p-px flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-[#080A0F] flex items-center justify-center text-[10px] font-mono text-white font-bold">
                1
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
