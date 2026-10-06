"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  Terminal,
  Code,
  Brain,
  Layers,
  ShieldCheck,
  Mic,
  Clock,
  Calendar,
  FileText,
  CheckCircle2,
  ArrowRight,
  Cpu,
  Lock,
} from "lucide-react";
import AlfredEmblem from "./AlfredEmblem";
import AlfredCore from "./AlfredCore";
import { playClickSound, playSuccessSound } from "@/utils/audioSystem";
import {
  MOTION_DURATIONS,
  MOTION_EASINGS,
  modalOverlayVariants,
  modalDialogVariants,
} from "@/utils/motion";

export interface DemoExperienceProps {
  isOpen: boolean;
  onClose: () => void;
  onStartUsing?: () => void;
}

interface DemoStep {
  id: number;
  title: string;
  badge: string;
  subtitle: string;
  durationSeconds: number;
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: 1,
    badge: "SYSTEM INTRODUCTION",
    title: "Meet ALFRED",
    subtitle: "Your local-first, privacy-respecting AI productivity workstation.",
    durationSeconds: 9,
  },
  {
    id: 2,
    badge: "NATURAL COMMANDS",
    title: "Talk to ALFRED Naturally",
    subtitle: "Voice and typed commands translate deterministically into verified system tools.",
    durationSeconds: 9,
  },
  {
    id: 3,
    badge: "WORKFLOW AUTOMATION",
    title: "One-Click Coding Mode",
    subtitle: "Orchestrate your workspace, editor, and deep-work timer in a single unified flow.",
    durationSeconds: 9,
  },
  {
    id: 4,
    badge: "LOCAL MEMORY",
    title: "Explicit, Operator-Controlled Memory",
    subtitle: "ALFRED learns your preferences only when explicitly instructed. Zero hidden tracking.",
    durationSeconds: 9,
  },
  {
    id: 5,
    badge: "PROACTIVE INTELLIGENCE",
    title: "Grounded Daily Intelligence",
    subtitle: "Morning Briefings, End-of-Day Reviews, and actionable suggestions based on actual state.",
    durationSeconds: 9,
  },
  {
    id: 6,
    badge: "PERSONAL KNOWLEDGE (RAG)",
    title: "Local Knowledge Vault",
    subtitle: "Search and synthesize personal notes and documentation safely with local embeddings.",
    durationSeconds: 9,
  },
  {
    id: 7,
    badge: "VOICE INTERFACE",
    title: "Voice, Wake Word & TTS",
    subtitle: "Hands-free operations with offline 'Hey Alfred' wake detection and local Whisper STT.",
    durationSeconds: 9,
  },
  {
    id: 8,
    badge: "SCHEDULES & AUTOMATIONS",
    title: "Autonomous Routines & Events",
    subtitle: "Automate recurring routines with strict guardrails and user confirmation on mutations.",
    durationSeconds: 9,
  },
  {
    id: 9,
    badge: "SECURITY ARCHITECTURE",
    title: "Air-Gapped Safety Boundary",
    subtitle: "The AI is never given unrestricted shell access. Every action is audited and whitelisted.",
    durationSeconds: 9,
  },
  {
    id: 10,
    badge: "READY FOR DEPLOYMENT",
    title: "Experience ALFRED Yourself",
    subtitle: "Your command center is ready. Command your workstation with confidence.",
    durationSeconds: 12,
  },
];

export default function DemoExperience({
  isOpen,
  onClose,
  onStartUsing,
}: DemoExperienceProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedInStep, setElapsedInStep] = useState(0);
  const prefersReduced = useReducedMotion();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const step = DEMO_STEPS[currentStep] || DEMO_STEPS[0];
  const totalSteps = DEMO_STEPS.length;

  // Cleanup on unmount or close
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const [isInitializing, setIsInitializing] = useState(true);
  const [initStage, setInitStage] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      clearTimer();
      setCurrentStep(0);
      setElapsedInStep(0);
      setIsPaused(false);
      setIsInitializing(true);
      setInitStage(0);
      return;
    }

    setElapsedInStep(0);
    setIsInitializing(true);
    setInitStage(0);

    let stage = 0;
    const interval = setInterval(() => {
      stage++;
      setInitStage(stage);
      if (stage >= 6) {
        clearInterval(interval);
        setIsInitializing(false);
      }
    }, 280);

    return () => clearInterval(interval);
  }, [isOpen, clearTimer]);

  // Step advancement timer (100ms ticks for smooth progress bar)
  useEffect(() => {
    if (!isOpen || isPaused || isInitializing) {
      clearTimer();
      return;
    }

    const stepDurationMs = step.durationSeconds * 1000;
    const intervalMs = 100;

    timerRef.current = setInterval(() => {
      setElapsedInStep((prev) => {
        const next = prev + intervalMs;
        if (next >= stepDurationMs) {
          // Advance to next step or pause on last
          if (currentStep < totalSteps - 1) {
            setCurrentStep((s) => s + 1);
            return 0;
          } else {
            setIsPaused(true);
            return stepDurationMs;
          }
        }
        return next;
      });
    }, intervalMs);

    return () => clearTimer();
  }, [isOpen, isPaused, isInitializing, currentStep, step.durationSeconds, totalSteps, clearTimer]);

  // Keyboard navigation: Escape to exit, Left for prev, Right for next, Space to toggle pause
  const handleComplete = useCallback(() => {
    playSuccessSound();
    onClose();
    if (onStartUsing) {
      onStartUsing();
    }
  }, [onClose, onStartUsing]);

  const handleNext = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((s) => s + 1);
      setElapsedInStep(0);
    } else {
      handleComplete();
    }
  }, [currentStep, totalSteps, handleComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      setElapsedInStep(0);
    }
  }, [currentStep]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        playClickSound();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        playClickSound();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        playClickSound();
        handlePrev();
      } else if (e.key === " ") {
        e.preventDefault();
        playClickSound();
        if (isInitializing) {
          setIsInitializing(false);
        } else {
          setIsPaused((p) => !p);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev, isInitializing]);

  const handleRestart = () => {
    playClickSound();
    setCurrentStep(0);
    setElapsedInStep(0);
    setIsPaused(false);
    setIsInitializing(false);
  };

  if (!isOpen) return null;

  const progressPercent = Math.min(
    100,
    (elapsedInStep / (step.durationSeconds * 1000)) * 100
  );

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="ALFRED Interactive Product Demonstration"
      >
        {/* Backdrop */}
        <motion.div
          variants={modalOverlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Cinematic Demo Container */}
        <motion.div
          variants={modalDialogVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="relative w-full max-w-4xl bg-[#090C14]/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 max-h-[90vh]"
          style={{
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 40px -10px rgba(6, 182, 212, 0.15)",
          }}
        >
          {/* Top Bar: Telemetry Header & Controls */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#0C101B]/80 shrink-0">
            <div className="flex items-center gap-3">
              <AlfredEmblem size={24} glow={true} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold tracking-wider text-white font-mono uppercase">
                    ALFRED // INTERACTIVE PRODUCT TOUR
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono tracking-wider bg-[#06B6D4]/15 text-[#06B6D4] border border-[#06B6D4]/30 rounded">
                    SIMULATION MODE
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 font-mono">
                  STEP {currentStep + 1} OF {totalSteps} • ZERO MUTATIONS GUARANTEED
                </div>
              </div>
            </div>

            {/* Quick Actions & Close */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  playClickSound();
                  setIsPaused(!isPaused);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                title={isPaused ? "Resume demonstration (Space)" : "Pause demonstration (Space)"}
              >
                {isPaused ? <Play size={13} className="text-[#10B981]" /> : <Pause size={13} className="text-[#F59E0B]" />}
                <span>{isPaused ? "RESUME" : "PAUSE"}</span>
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  onClose();
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors"
                aria-label="Exit demonstration"
                title="Exit (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Segmented Step Progress Indicator */}
          <div className="w-full bg-[#080A10] px-6 py-2 border-b border-white/5 flex items-center gap-1.5 shrink-0">
            {DEMO_STEPS.map((s, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <div
                  key={s.id}
                  onClick={() => {
                    playClickSound();
                    setCurrentStep(idx);
                    setElapsedInStep(0);
                  }}
                  className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/10 cursor-pointer relative transition-all hover:bg-white/20"
                  title={`Step ${idx + 1}: ${s.title}`}
                >
                  {isPast && <div className="w-full h-full bg-[#06B6D4]" />}
                  {isCurrent && (
                    <div
                      className="h-full bg-gradient-to-r from-[#06B6D4] to-[#22D3EE] transition-all"
                      style={{
                        width: prefersReduced ? "100%" : `${progressPercent}%`,
                        transitionDuration: prefersReduced ? "0ms" : "100ms",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Main Visual Showcase Stage */}
          <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8 flex flex-col justify-center min-h-[380px]">
            {isInitializing ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="flex flex-col items-center justify-center text-center space-y-6 py-4"
              >
                <AlfredCore state="thinking" size="md" interactive={false} />
                <div className="space-y-4 max-w-sm w-full">
                  <div className="text-xs font-mono font-bold tracking-widest text-[#06B6D4] uppercase animate-pulse">
                    INITIALIZING DEMONSTRATION
                  </div>
                  <div className="space-y-2 font-mono text-xs text-left bg-black/50 border border-white/10 rounded-xl p-4 shadow-xl">
                    <div className={`flex items-center justify-between transition-colors duration-200 ${initStage >= 1 ? "text-emerald-400 font-semibold" : "text-gray-600"}`}>
                      <span>COMMAND SYSTEM</span>
                      <span>{initStage >= 1 ? "✓ READY" : "..."}</span>
                    </div>
                    <div className={`flex items-center justify-between transition-colors duration-200 ${initStage >= 2 ? "text-emerald-400 font-semibold" : "text-gray-600"}`}>
                      <span>VOICE SYSTEM</span>
                      <span>{initStage >= 2 ? "✓ READY" : "..."}</span>
                    </div>
                    <div className={`flex items-center justify-between transition-colors duration-200 ${initStage >= 3 ? "text-emerald-400 font-semibold" : "text-gray-600"}`}>
                      <span>MEMORY SYSTEM</span>
                      <span>{initStage >= 3 ? "✓ READY" : "..."}</span>
                    </div>
                    <div className={`flex items-center justify-between transition-colors duration-200 ${initStage >= 4 ? "text-emerald-400 font-semibold" : "text-gray-600"}`}>
                      <span>AUTOMATION</span>
                      <span>{initStage >= 4 ? "✓ READY" : "..."}</span>
                    </div>
                    <div className={`flex items-center justify-between transition-colors duration-200 ${initStage >= 5 ? "text-emerald-400 font-semibold" : "text-gray-600"}`}>
                      <span>DESKTOP CONTROL</span>
                      <span>{initStage >= 5 ? "✓ READY" : "..."}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsInitializing(false)}
                    className="text-[11px] font-mono text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Press Space or Click to Enter →
                  </button>
                </div>
              </motion.div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{
                    duration: prefersReduced ? 0.01 : MOTION_DURATIONS.quick,
                    ease: MOTION_EASINGS.standard,
                  }}
                  className="w-full"
                >
                  {/* Step Header */}
                  <div className="mb-6 text-center sm:text-left">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono tracking-wider font-semibold text-[#06B6D4] bg-[#06B6D4]/10 border border-[#06B6D4]/25 mb-2">
                      <Sparkles size={12} />
                      {step.badge}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                      {step.title}
                    </h2>
                    <p className="text-sm text-gray-400 mt-1 max-w-2xl">
                      {step.subtitle}
                    </p>
                  </div>

                  {/* Step-Specific Interactive Simulation Canvas */}
                  <div className="w-full bg-[#0A0E18]/80 border border-white/8 rounded-xl p-5 sm:p-6 shadow-inner">
                    {renderStepContent(step.id)}
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Bottom Navigation & Action Controls */}
          <div className="px-6 py-4 border-t border-white/8 bg-[#0C101B]/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-gray-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 border border-white/10 transition-colors"
              >
                <ChevronLeft size={14} />
                BACK
              </button>

              <button
                onClick={handleRestart}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono text-gray-400 hover:text-white hover:bg-white/5 border border-white/10 transition-colors"
                title="Restart demonstration from step 1"
              >
                <RotateCcw size={12} />
                RESTART
              </button>
            </div>

            <div className="flex items-center gap-3">
              {currentStep < totalSteps - 1 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold font-mono tracking-wide text-white bg-gradient-to-r from-[#06B6D4] to-[#0891B2] hover:from-[#22D3EE] hover:to-[#06B6D4] shadow-lg shadow-cyan-950/40 border border-cyan-400/30 transition-all cursor-pointer"
                >
                  <span>NEXT FEATURE</span>
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs font-semibold font-mono tracking-wide text-white bg-gradient-to-r from-[#E11D48] to-[#BE123C] hover:from-[#F43F5E] hover:to-[#E11D48] shadow-lg shadow-rose-950/50 border border-rose-400/30 transition-all cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>START USING ALFRED</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  // Simulation Renderers for all 10 steps
  function renderStepContent(stepId: number) {
    switch (stepId) {
      case 1:
        // STEP 1 — INTRODUCTION
        return (
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="shrink-0 flex items-center justify-center p-4">
              <AlfredCore state="idle" size="sm" interactive={false} />
            </div>
            <div className="flex-1 space-y-3">
              <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                CORE CAPABILITIES // HIGH-PERFORMANCE WORKSTATION
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                  <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
                    <Brain size={14} className="text-[#06B6D4]" />
                    Local-First AI
                  </div>
                  <div className="text-gray-400 text-[11px]">
                    Works with local Ollama or cloud Gemini with automatic fallback.
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                  <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
                    <Mic size={14} className="text-[#E11D48]" />
                    Voice & Wake Word
                  </div>
                  <div className="text-gray-400 text-[11px]">
                    Offline &apos;Hey Alfred&apos; wake detection and fast local speech synthesis.
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                  <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
                    <ShieldCheck size={14} className="text-[#10B981]" />
                    Strict Risk Control
                  </div>
                  <div className="text-gray-400 text-[11px]">
                    Dangerous actions require mandatory operator confirmation.
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/5">
                  <div className="font-semibold text-white flex items-center gap-1.5 mb-1">
                    <Layers size={14} className="text-[#F59E0B]" />
                    Focus & Workspaces
                  </div>
                  <div className="text-gray-400 text-[11px]">
                    Orchestrates apps, docs, and focus sessions effortlessly.
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        // STEP 2 — COMMANDS
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 pb-2 border-b border-white/5">
              <span>SIMULATED COMMAND PIPELINE</span>
              <span className="text-[#06B6D4]">DETERMINISTIC EXECUTION</span>
            </div>
            {/* Command Bubble */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 font-mono text-sm text-white">
              <Terminal size={16} className="text-[#06B6D4] shrink-0" />
              <span>Operator: &quot;Open VS Code&quot;</span>
            </div>
            {/* Execution Pipeline Steps */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
              <div className="p-3 rounded-lg bg-[#0C1220] border border-cyan-500/20 text-center">
                <div className="text-[10px] font-mono text-cyan-400">1. INPUT</div>
                <div className="text-xs font-semibold text-white mt-1">Natural Query</div>
              </div>
              <div className="p-3 rounded-lg bg-[#0C1220] border border-cyan-500/20 text-center">
                <div className="text-[10px] font-mono text-cyan-400">2. UNDERSTANDING</div>
                <div className="text-xs font-semibold text-white mt-1">launch_application</div>
              </div>
              <div className="p-3 rounded-lg bg-[#0C1220] border border-cyan-500/20 text-center">
                <div className="text-[10px] font-mono text-cyan-400">3. TOOL RESOLVER</div>
                <div className="text-xs font-semibold text-white mt-1">Whitelisted: &apos;code&apos;</div>
              </div>
              <div className="p-3 rounded-lg bg-[#0C1220] border border-emerald-500/30 text-center">
                <div className="text-[10px] font-mono text-emerald-400">4. EXECUTION</div>
                <div className="text-xs font-semibold text-white mt-1 flex items-center justify-center gap-1">
                  <CheckCircle2 size={13} className="text-emerald-400" />
                  App Launched
                </div>
              </div>
            </div>
            <div className="text-[11px] text-gray-400 font-mono text-center">
              ALFRED maps natural phrasing to strict, whitelisted executable paths without arbitrary shell execution.
            </div>
          </div>
        );

      case 3:
        // STEP 3 — CODING MODE
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 pb-2 border-b border-white/5">
              <span>WORKFLOW: CODING MODE (SIMULATED)</span>
              <span className="text-[#E11D48]">MULTI-STEP ORCHESTRATION</span>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 font-mono text-sm text-white">
              Operator: &quot;Start coding for 45 minutes&quot;
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-[#14101A] border border-rose-500/20">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-mono mb-1">
                  <Layers size={14} />
                  WORKSPACE
                </div>
                <div className="text-sm font-semibold text-white">DSA Workspace</div>
                <div className="text-[11px] text-gray-400 mt-1">LeetCode • Notes • Docs</div>
              </div>
              <div className="p-3 rounded-lg bg-[#14101A] border border-rose-500/20">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-mono mb-1">
                  <Code size={14} />
                  EDITOR
                </div>
                <div className="text-sm font-semibold text-white">VS Code Launch</div>
                <div className="text-[11px] text-gray-400 mt-1">Project directory ready</div>
              </div>
              <div className="p-3 rounded-lg bg-[#14101A] border border-rose-500/20">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-mono mb-1">
                  <Clock size={14} />
                  DEEP WORK TIMER
                </div>
                <div className="text-sm font-semibold text-white">45-Minute Matrix</div>
                <div className="text-[11px] text-gray-400 mt-1">Do-not-disturb telemetry</div>
              </div>
            </div>
            <div className="p-2.5 rounded bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center gap-2">
              <CheckCircle2 size={14} />
              Demonstration only: Real focus sessions and applications are not mutated during demo mode.
            </div>
          </div>
        );

      case 4:
        // STEP 4 — MEMORY
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 pb-2 border-b border-white/5">
              <span>LOCAL MEMORY & PREFERENCES</span>
              <span className="text-[#06B6D4]">OPERATOR-APPROVED ONLY</span>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 font-mono text-sm text-white">
              Operator: &quot;Remember that I prefer 45-minute coding sessions.&quot;
            </div>
            <div className="p-4 rounded-xl bg-[#09111E] border border-cyan-500/25 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400 font-semibold">
                  PROPOSED MEMORY ITEM (SIMULATED)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800">
                  WORKFLOW_PREFERENCE
                </span>
              </div>
              <div className="text-sm text-gray-200">
                &quot;Prefers 45-minute coding sessions for deep work.&quot;
              </div>
              <div className="flex items-center gap-2 text-xs font-mono pt-1 text-gray-400 border-t border-white/5">
                <ShieldCheck size={14} className="text-[#10B981]" />
                Requires explicit confirmation. ALFRED never saves arbitrary thoughts silently.
              </div>
            </div>
            <div className="text-[11px] text-gray-400 font-mono">
              Memory is passive data: it informs defaults but never acts as executable shell commands.
            </div>
          </div>
        );

      case 5:
        // STEP 5 — INTELLIGENCE
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 pb-2 border-b border-white/5">
              <span>PROACTIVE INTELLIGENCE</span>
              <span className="text-amber-400">GROUNDED FACTUAL REASONING</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-semibold">
                  <Calendar size={14} />
                  Morning Briefing
                </div>
                <div className="text-xs text-gray-300">
                  Synthesizes today&apos;s pending tasks, active streak, and recommended morning focus.
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-semibold">
                  <Sparkles size={14} />
                  Contextual Recommendations
                </div>
                <div className="text-xs text-gray-300">
                  Highlights overdue milestones and suggests high-leverage next tasks.
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-mono font-semibold">
                  <CheckCircle2 size={14} />
                  End-of-Day Review
                </div>
                <div className="text-xs text-gray-300">
                  Summarizes completed focus blocks, tasks achieved, and momentum for tomorrow.
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-white/5 border border-white/10 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-semibold">
                  <Layers size={14} />
                  Weekly Planning
                </div>
                <div className="text-xs text-gray-300">
                  Strategic weekly retrospective with actionable goal adjustments.
                </div>
              </div>
            </div>
            <div className="text-[11px] text-gray-400 font-mono text-center">
              All intelligence is generated from your real, canonical data. Zero fabricated metrics.
            </div>
          </div>
        );

      case 6:
        // STEP 6 — KNOWLEDGE
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 pb-2 border-b border-white/5">
              <span>LOCAL RAG // KNOWLEDGE VAULT</span>
              <span className="text-[#06B6D4]">LOCAL EMBEDDINGS</span>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 font-mono text-sm text-white">
              Operator: &quot;What was the algorithm optimization discussed in our project notes?&quot;
            </div>
            <div className="p-4 rounded-xl bg-[#08121E] border border-cyan-500/25 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <FileText size={14} />
                CITATION: notes/algorithms_q3.md (Relevance: 0.94)
              </div>
              <div className="text-xs text-gray-200">
                &quot;According to your project documentation, the team switched to a segment tree approach to achieve O(log N) point updates.&quot;
              </div>
            </div>
            <div className="text-[11px] text-gray-400 font-mono">
              Demo uses synthetic citations only. Your personal documents are never accessed or sent to cloud servers during simulation.
            </div>
          </div>
        );

      case 7:
        // STEP 7 — VOICE
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 pb-2 border-b border-white/5">
              <span>VOICE INTERACTION STACK</span>
              <span className="text-emerald-400">LOCAL & SECURE</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-around gap-4 p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#06B6D4]/15 border border-[#06B6D4]/30 flex items-center justify-center text-[#06B6D4] mb-2">
                  <Mic size={20} />
                </div>
                <div className="text-xs font-mono font-semibold text-white">Wake Word</div>
                <div className="text-[11px] text-gray-400 mt-0.5">&quot;Hey Alfred&quot; (Local)</div>
              </div>

              <ArrowRight size={16} className="text-gray-500 hidden sm:block" />

              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#E11D48]/15 border border-[#E11D48]/30 flex items-center justify-center text-[#E11D48] mb-2">
                  <Cpu size={20} />
                </div>
                <div className="text-xs font-mono font-semibold text-white">Transcription</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Local Whisper AI</div>
              </div>

              <ArrowRight size={16} className="text-gray-500 hidden sm:block" />

              <div className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 flex items-center justify-center text-[#10B981] mb-2">
                  <Sparkles size={20} />
                </div>
                <div className="text-xs font-mono font-semibold text-white">Natural Speech</div>
                <div className="text-[11px] text-gray-400 mt-0.5">Concise Windows TTS</div>
              </div>
            </div>
            <div className="p-2.5 rounded bg-cyan-950/20 border border-cyan-500/20 text-cyan-300 text-xs font-mono flex items-center gap-2">
              <ShieldCheck size={14} />
              Demo audio visualization is purely synthetic. Microphone hardware is NOT activated during this tour.
            </div>
          </div>
        );

      case 8:
        // STEP 8 — AUTOMATION
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 pb-2 border-b border-white/5">
              <span>SCHEDULED ROUTINES & RULES</span>
              <span className="text-[#F59E0B]">CONFIRMATION GUARDRAILS</span>
            </div>
            <div className="p-3.5 rounded-lg bg-[#14120D] border border-amber-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <Clock size={13} />
                  SCHEDULED EVENT TRIGGER (08:00 AM)
                </span>
                <span className="text-gray-400">WEEKDAYS</span>
              </div>
              <div className="text-xs text-gray-300">
                Trigger: Daily Morning Routine → Requesting launch of DSA Workspace and VS Code.
              </div>
              <div className="p-2.5 rounded bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center justify-between">
                <span>Requires operator confirmation</span>
                <span className="px-2 py-0.5 rounded bg-amber-500 text-black font-semibold text-[10px]">
                  PENDING CONFIRMATION
                </span>
              </div>
            </div>
            <div className="text-[11px] text-gray-400 font-mono text-center">
              ALFRED will never execute unexpected file mutations or process changes in the background without authorization.
            </div>
          </div>
        );

      case 9:
        // STEP 9 — SECURITY
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 pb-2 border-b border-white/5">
              <span>DEFENSE-IN-DEPTH ARCHITECTURE</span>
              <span className="text-emerald-400">ZERO SHELL INJECTION</span>
            </div>
            <div className="p-4 rounded-xl bg-[#0A141A] border border-emerald-500/20 space-y-3">
              <div className="text-xs font-mono font-semibold text-emerald-400 flex items-center gap-2">
                <Lock size={15} />
                THE ALFRED SECURITY BOUNDARY
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs font-mono">
                <div className="p-2 rounded bg-white/5 border border-white/5">
                  <div className="text-[10px] text-gray-400">STAGE 1</div>
                  <div className="text-white font-semibold mt-0.5">AI Proposal</div>
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/5">
                  <div className="text-[10px] text-cyan-400">STAGE 2</div>
                  <div className="text-white font-semibold mt-0.5">Permissions</div>
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/5">
                  <div className="text-[10px] text-amber-400">STAGE 3</div>
                  <div className="text-white font-semibold mt-0.5">Risk Check</div>
                </div>
                <div className="p-2 rounded bg-white/5 border border-white/5">
                  <div className="text-[10px] text-rose-400">STAGE 4</div>
                  <div className="text-white font-semibold mt-0.5">Confirmation</div>
                </div>
                <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/30 col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-emerald-400">STAGE 5</div>
                  <div className="text-emerald-300 font-semibold mt-0.5">Tool Registry</div>
                </div>
              </div>
              <div className="text-xs text-gray-300 leading-relaxed pt-1">
                Raw AI models never have access to child processes, unrestricted shell commands, or arbitrary network endpoints. Every executed step passes through the verified ToolRegistry.
              </div>
            </div>
          </div>
        );

      case 10:
      default:
        // STEP 10 — FINAL
        return (
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            <AlfredCore state="success" size="sm" interactive={false} />
            <div className="max-w-md space-y-2">
              <h3 className="text-xl font-bold text-white tracking-tight">
                Now You Know ALFRED
              </h3>
              <p className="text-xs text-gray-400">
                You&apos;re ready to command your workstation. Type commands into the terminal, activate with &quot;Hey Alfred&quot;, or orchestrate your daily focus sessions.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleComplete}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold font-mono text-xs text-white bg-gradient-to-r from-[#E11D48] to-[#BE123C] hover:from-[#F43F5E] hover:to-[#E11D48] shadow-lg shadow-rose-950/60 border border-rose-400/30 transition-all cursor-pointer"
              >
                <Sparkles size={14} />
                <span>START USING ALFRED</span>
              </button>
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>RUN DEMO AGAIN</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl font-mono text-xs text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors cursor-pointer"
              >
                EXIT
              </button>
            </div>
          </div>
        );
    }
  }
}
