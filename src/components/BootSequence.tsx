"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  Terminal,
  Zap,
  Layers,
  ArrowRight,
} from "lucide-react";
import AlfredEmblem from "./AlfredEmblem";
import AlfredCore, { CoreState } from "./AlfredCore";
import { initAudio, AlfredAudioService, playClickSound, playHoverSound } from "@/utils/audioSystem";

interface BootSequenceProps {
  onComplete: () => void;
}

interface TerminalLog {
  id: string;
  timestamp: string;
  text: string;
  level: "info" | "success" | "warn";
}

export default function BootSequence({ onComplete }: BootSequenceProps) {
  const [phase, setPhase] = useState<
    "standby" | "powering" | "initializing" | "synchronizing" | "online" | "transition"
  >("standby");

  const [progress, setProgress] = useState(0);
  const [coreVisualState, setCoreVisualState] = useState<CoreState>("idle");
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  const [currentStepLabel, setCurrentStepLabel] = useState("AWAITING OPERATOR ACTIVATION");
  const [isHoveringTrigger, setIsHoveringTrigger] = useState(false);

  // Real System Stats (collected gracefully from real persistence & electron bridges)
  const [realStats, setRealStats] = useState({
    workspaceCount: 4,
    taskCount: 5,
    projectCount: 3,
    goalCount: 2,
    activeProvider: "MOCK",
    isElectron: false,
    providersStatus: {
      mock: "READY",
      gemini: "STANDBY",
      ollama: "STANDBY",
      claude: "STANDBY",
    },
  });

  // Query real application data from localStorage & Electron on mount
  useEffect(() => {
    try {
      const isElectron = typeof window !== "undefined" && Boolean(window.electron);

      // Tasks
      const savedTasks = localStorage.getItem("alfred_tasks_v2") || localStorage.getItem("alfred_tasks");
      const taskCount = savedTasks ? JSON.parse(savedTasks).length : 5;

      // Workspaces
      const savedWs = localStorage.getItem("alfred_workspaces");
      const workspaceCount = savedWs ? JSON.parse(savedWs).length : 4;

      // Projects
      const savedProj = localStorage.getItem("alfred_projects");
      const projectCount = savedProj ? JSON.parse(savedProj).length : 3;

      // Goals
      const savedGoals = localStorage.getItem("alfred_goals");
      const goalCount = savedGoals ? JSON.parse(savedGoals).length : 2;

      setRealStats((prev) => ({
        ...prev,
        taskCount,
        workspaceCount,
        projectCount,
        goalCount,
        isElectron,
      }));

      // Check real AI Provider status if Electron is available
      if (typeof window !== "undefined" && window.electron?.aiProvider) {
        window.electron.aiProvider.getActive().then((active: string) => {
          if (active) {
            setRealStats((p) => ({ ...p, activeProvider: active.toUpperCase() }));
          }
        }).catch(() => {});

        window.electron.aiProvider.getStatuses().then((statuses: any[]) => {
          if (Array.isArray(statuses)) {
            const providerMap: any = { mock: "READY", gemini: "STANDBY", ollama: "STANDBY", claude: "STANDBY" };
            statuses.forEach((s) => {
              if (s.id && s.status) {
                providerMap[s.id] = s.status === "ready" ? "READY" : s.status === "configured" ? "CONFIGURED" : "STANDBY";
              }
            });
            setRealStats((p) => ({ ...p, providersStatus: providerMap }));
          }
        }).catch(() => {});
      }
    } catch {}
  }, []);

  const quickSkip = useCallback(() => {
    playClickSound();
    setProgress(100);
    setPhase("online");
    setCoreVisualState("success");
    setTimeout(() => {
      setPhase("transition");
      setTimeout(onComplete, 400);
    }, 300);
  }, [onComplete]);

  // Keyboard shortcut listener: ESC to quick-skip
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        quickSkip();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quickSkip]);

  const addLog = useCallback((text: string, level: "info" | "success" | "warn" = "info") => {
    const now = new Date();
    const ts = `${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${Math.floor(now.getMilliseconds() / 100)}`;
    setTerminalLogs((prev) => [
      ...prev.slice(-6),
      { id: `${Date.now()}-${Math.random()}`, timestamp: ts, text, level },
    ]);
  }, []);

  // Execute cinematic multi-stage boot sequence
  const startBoot = useCallback(() => {
    if (phase !== "standby") return;

    try {
      initAudio();
      AlfredAudioService.play("boot");
    } catch {}

    setPhase("powering");
    setCoreVisualState("listening");
    setCurrentStepLabel("PHASE 01 // ROUTING POWER TO ALFRED NEURAL CORE");
    addLog("System trigger received. Operator authorization verified.", "info");

    const runSequence = async () => {
      // 0% -> 18%: Core Power
      for (let p = 0; p <= 18; p += 3) {
        await new Promise((r) => setTimeout(r, 60));
        setProgress(p);
      }
      addLog("Core power bus nominal. Voltage synchronized at 100%.", "success");

      // 18% -> 36%: Neural Engine & Cognitive Architecture
      setPhase("initializing");
      setCoreVisualState("thinking");
      setCurrentStepLabel("PHASE 02 // INITIALIZING COGNITIVE INTERFACE");
      try {
        AlfredAudioService.play("confirmation", 0.4);
      } catch {}

      for (let p = 19; p <= 36; p += 3) {
        await new Promise((r) => setTimeout(r, 70));
        setProgress(p);
      }
      addLog(`Local persistence verified: ${realStats.taskCount} tasks, ${realStats.projectCount} projects loaded.`, "info");

      // 36% -> 58%: Workspaces & Tool Registry
      setCoreVisualState("executing");
      setCurrentStepLabel("PHASE 03 // CALIBRATING WORKSPACES & TOOL BRIDGES");

      for (let p = 37; p <= 58; p += 3) {
        await new Promise((r) => setTimeout(r, 75));
        setProgress(p);
      }
      addLog(`Workspace engine active: ${realStats.workspaceCount} developer environments online.`, "success");
      addLog(realStats.isElectron ? "Electron desktop runtime bridge confirmed." : "Web workstation runtime bridge active.", "info");

      // 58% -> 80%: AI Matrix & Models
      setPhase("synchronizing");
      setCurrentStepLabel("PHASE 04 // DIAGNOSING AI PROVIDER MATRIX");
      try {
        AlfredAudioService.play("confirmation", 0.4);
      } catch {}

      for (let p = 59; p <= 80; p += 3) {
        await new Promise((r) => setTimeout(r, 80));
        setProgress(p);
      }
      addLog(`AI Matrix: Active Provider [${realStats.activeProvider}] ready.`, "success");
      addLog(`Provider Matrix: GEMINI [${realStats.providersStatus.gemini}] · OLLAMA [${realStats.providersStatus.ollama}]`, "info");

      // 80% -> 99%: Final Synchronization
      setCurrentStepLabel("PHASE 05 // SYNCHRONIZING WORKSTATION DIRECTIVES");

      for (let p = 81; p <= 99; p += 3) {
        await new Promise((r) => setTimeout(r, 60));
        setProgress(p);
      }
      addLog("All directives aligned. Core neural feedback nominal.", "success");

      // 100%: Online State
      setProgress(100);
      setPhase("online");
      setCoreVisualState("success");
      setCurrentStepLabel("ALFRED CORE // ONLINE // SYSTEM READY");
      try {
        AlfredAudioService.play("command", 0.7);
      } catch {}

      await new Promise((r) => setTimeout(r, 1100));

      // Transition out
      setPhase("transition");
      await new Promise((r) => setTimeout(r, 600));
      onComplete();
    };

    runSequence();
  }, [phase, addLog, realStats, onComplete]);

  // Auto-start cinematic sequence after 1.2s if operator does not click earlier
  useEffect(() => {
    if (phase !== "standby") return;
    const timer = setTimeout(() => {
      startBoot();
    }, 1200);
    return () => clearTimeout(timer);
  }, [phase, startBoot]);

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-[#04060A] text-slate-100 flex flex-col justify-between p-6 md:p-10 select-none overflow-hidden transition-opacity duration-700 ${
        phase === "transition" ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
    >
      {/* =====================================================================
          ATMOSPHERIC LAYERS & TECHNICAL GRID
          ===================================================================== */}
      {/* Background Radial Core Glow */}
      <div
        className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${
          phase === "standby"
            ? "opacity-25"
            : phase === "online"
            ? "opacity-80"
            : "opacity-50"
        } bg-[radial-gradient(circle_at_50%_48%,rgba(225,29,72,0.18)_0%,rgba(6,182,212,0.06)_35%,transparent_70%)]`}
      />

      {/* Layered Technical Coordinate Grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      {/* Subtle Scanline Overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.4)_50%)]"
        style={{ backgroundSize: "100% 4px" }}
      />

      {/* Top Header Crosshair Readouts */}
      <div className="relative z-20 flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center space-x-3">
          <AlfredEmblem size={28} pulsing={phase !== "standby"} />
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-header text-sm font-extrabold tracking-widest text-white uppercase">
                ALFRED
              </span>
              <span className="text-[10px] font-mono text-[#E11D48] tracking-widest uppercase font-bold">
                {"// SYSTEM INITIALIZATION"}
              </span>
            </div>
            <p className="text-[9px] font-mono text-slate-400 tracking-wider">
              PERSONAL AI OPERATING SYSTEM · BUILD 5.3F
            </p>
          </div>
        </div>

        {/* Top Right Status Telemetry */}
        <div className="flex items-center space-x-4 text-[10px] font-mono">
          <div className="hidden sm:flex items-center space-x-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                phase === "standby"
                  ? "bg-amber-400"
                  : phase === "online"
                  ? "bg-emerald-400 shadow-[0_0_8px_#10B981]"
                  : "bg-[#E11D48] animate-ping"
              }`}
            />
            <span className="text-slate-400 font-semibold tracking-wider uppercase">
              {phase === "standby"
                ? "CORE STANDBY"
                : phase === "online"
                ? "CORE NOMINAL"
                : "INITIALIZING"}
            </span>
          </div>

          <div className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-slate-400">
            {"LOC // 0x7F000001"}
          </div>
        </div>
      </div>

      {/* =====================================================================
          MAIN COGNITIVE BOOT CHAMBER (CENTRAL HUD & REACTOR)
          ===================================================================== */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center my-4">
        
        {/* HUD Tri-Column Arrangement in Boot Phases */}
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center justify-center">

          {/* LEFT DIAGNOSTIC HUD (Hidden in initial standby for quiet focus) */}
          <div className="lg:col-span-3 hidden lg:flex flex-col space-y-3">
            <AnimatePresence>
              {phase !== "standby" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-3 p-4 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md"
                >
                  <div className="flex items-center space-x-2 text-[10px] font-mono text-[#06B6D4] font-bold tracking-widest uppercase pb-2 border-b border-white/[0.06]">
                    <Zap size={13} />
                    <span>SYSTEM DIAGNOSTICS</span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">POWER MATRIX</span>
                      <span className="text-emerald-400 font-bold text-[10px]">100% NOMINAL</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">COGNITIVE BUS</span>
                      <span className={progress >= 25 ? "text-emerald-400 font-bold text-[10px]" : "text-amber-400 text-[10px]"}>
                        {progress >= 25 ? "SYNCHRONIZED" : "STANDBY"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">LOCAL CACHE</span>
                      <span className={progress >= 40 ? "text-emerald-400 font-bold text-[10px]" : "text-slate-400 text-[10px]"}>
                        {progress >= 40 ? "ALLOCATED" : "STANDBY"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">TOOL RUNTIME</span>
                      <span className={progress >= 60 ? "text-emerald-400 font-bold text-[10px]" : "text-slate-400 text-[10px]"}>
                        {progress >= 60 ? "VERIFIED" : "STANDBY"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* CENTER: ALFRED CORE 2.0 REACTOR CENTERPIECE */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center relative min-h-[340px]">
            {/* Concentric Orbital Aura Sweeps */}
            <div
              className={`absolute w-[360px] h-[360px] rounded-full border border-dashed border-[#E11D48]/20 transition-all duration-1000 ${
                isHoveringTrigger ? "scale-105 border-[#E11D48]/40 rotate-180" : "scale-100"
              } ${phase !== "standby" ? "animate-spin" : ""}`}
              style={{ animationDuration: "25s" }}
            />
            <div
              className={`absolute w-[290px] h-[290px] rounded-full border border-white/[0.08] transition-all duration-700 ${
                phase !== "standby" ? "border-[#06B6D4]/30 animate-pulse" : ""
              }`}
            />

            {/* Central Emblem or Functional Core */}
            <div className="relative z-10 flex flex-col items-center">
              {phase === "standby" ? (
                <div className="flex flex-col items-center space-y-6">
                  {/* Standby Architectural Emblem */}
                  <div className="relative p-6">
                    <AlfredEmblem
                      size={90}
                      pulsing={isHoveringTrigger}
                      className="transition-transform duration-500 hover:scale-105"
                    />
                    <div className="absolute inset-0 rounded-full border border-[#E11D48]/20 scale-110 pointer-events-none" />
                  </div>

                  {/* Standby Telemetry Readouts */}
                  <div className="text-center space-y-1">
                    <div className="text-[11px] font-mono tracking-widest text-[#E11D48] uppercase font-bold">
                      {"CORE STATUS // STANDBY"}
                    </div>
                    <p className="text-xs font-sans text-slate-400 max-w-xs">
                      Advanced personal AI operating system ready for operator initialization directive.
                    </p>
                  </div>

                  {/* Primary Futuristic Activation Button */}
                  <button
                    type="button"
                    onClick={startBoot}
                    onMouseEnter={() => {
                      setIsHoveringTrigger(true);
                      playHoverSound();
                    }}
                    onMouseLeave={() => setIsHoveringTrigger(false)}
                    className="relative group px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#BE123C] text-white font-header text-base font-bold tracking-widest uppercase transition-all duration-300 shadow-[0_0_30px_rgba(225,29,72,0.45)] hover:shadow-[0_0_45px_rgba(225,29,72,0.7)] hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center space-x-3 border border-white/20"
                  >
                    <Cpu size={18} className="text-white animate-pulse" />
                    <span>◈ INITIALIZE ALFRED</span>
                    <ArrowRight size={16} className="text-white/80 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              ) : (
                /* Active Boot Core */
                <div className="flex flex-col items-center space-y-4">
                  <AlfredCore
                    size="lg"
                    state={coreVisualState}
                    interactive={false}
                    intent="System Boot Protocol"
                    target="Workstation"
                  />

                  {/* Phase & Percentage Display */}
                  <div className="text-center space-y-1 mt-2">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-header text-4xl font-extrabold tracking-wider text-white">
                        {progress}%
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-[#06B6D4] font-bold tracking-widest uppercase">
                      {currentStepLabel}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT DIAGNOSTIC HUD (Hidden in standby) */}
          <div className="lg:col-span-3 hidden lg:flex flex-col space-y-3">
            <AnimatePresence>
              {phase !== "standby" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-3 p-4 rounded-xl bg-black/40 border border-white/[0.08] backdrop-blur-md"
                >
                  <div className="flex items-center space-x-2 text-[10px] font-mono text-[#E11D48] font-bold tracking-widest uppercase pb-2 border-b border-white/[0.06]">
                    <Layers size={13} />
                    <span>OPERATING MATRIX</span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">AI PROVIDER</span>
                      <span className="text-white font-bold text-[10px]">{realStats.activeProvider}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">WORKSPACES</span>
                      <span className={progress >= 50 ? "text-emerald-400 font-bold text-[10px]" : "text-slate-400 text-[10px]"}>
                        {progress >= 50 ? `${realStats.workspaceCount} READY` : "WAITING"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">TASK DIRECTIVES</span>
                      <span className={progress >= 30 ? "text-emerald-400 font-bold text-[10px]" : "text-slate-400 text-[10px]"}>
                        {progress >= 30 ? `${realStats.taskCount} ENGAGED` : "WAITING"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-[11px]">DESKTOP SHELL</span>
                      <span className="text-white font-bold text-[10px]">
                        {realStats.isElectron ? "ELECTRON IPC" : "BROWSER V2"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* =====================================================================
          BOTTOM SECTION: DATA STREAM & PROGRESS METER
          ===================================================================== */}
      <div className="relative z-20 max-w-4xl mx-auto w-full space-y-3">
        
        {/* Terminal Telemetry Log (Visible in boot phases) */}
        {phase !== "standby" && (
          <div className="p-3 rounded-xl bg-black/60 border border-white/[0.08] font-mono text-xs max-h-28 overflow-y-auto space-y-1 shadow-inner">
            <div className="flex items-center space-x-2 text-[10px] text-slate-400 uppercase tracking-widest pb-1 border-b border-white/[0.04]">
              <Terminal size={12} className="text-[#E11D48]" />
              <span>TERMINAL TELEMETRY FEED</span>
            </div>
            {terminalLogs.map((log) => (
              <div key={log.id} className="flex items-center space-x-2 text-[11px]">
                <span className="text-slate-400 text-[9px] shrink-0 font-semibold">{log.timestamp}</span>
                <span className="text-slate-400">›</span>
                <span
                  className={
                    log.level === "success"
                      ? "text-emerald-400 font-semibold"
                      : log.level === "warn"
                      ? "text-amber-400"
                      : "text-slate-300"
                  }
                >
                  {log.text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Precision Progress Rail in Boot Phases */}
        {phase !== "standby" && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono text-slate-400">
              <span className="tracking-wider">SYSTEM INITIALIZATION PROTOCOL</span>
              <span className="text-white font-bold tracking-widest">[{progress}%]</span>
            </div>
            <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden p-[1px]">
              <motion.div
                className="h-full bg-gradient-to-r from-[#E11D48] via-[#F43F5E] to-[#06B6D4] rounded-full shadow-[0_0_12px_#E11D48]"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>
          </div>
        )}

        {/* Footer Bar & Quick Skip Affordance */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center space-x-2">
            <span className="w-1 h-1 rounded-full bg-emerald-400" />
            <span>ALFRED 2.0 PROTOCOL</span>
            <span className="text-slate-400">·</span>
            <span>SECURE DESKTOP WORKSTATION</span>
          </div>

          <button
            type="button"
            onClick={quickSkip}
            className="hover:text-white transition-colors cursor-pointer flex items-center space-x-1"
          >
            <span className="text-slate-400">[ESC]</span>
            <span className="underline">QUICK BOOT</span>
          </button>
        </div>
      </div>
    </div>
  );
}
