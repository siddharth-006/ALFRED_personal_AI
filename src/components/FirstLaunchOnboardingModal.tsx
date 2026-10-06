"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Cpu,
  Mic,
  Keyboard,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Terminal,
  Volume2,
  Lock,
  Server,
  Zap,
  Check,
} from "lucide-react";
import type { AlfredSettings } from "../../electron/services/settings.types";
import { playClickSound, playSuccessSound } from "@/utils/audioSystem";

interface StepConfig {
  id: number;
  code: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
}

const STEPS: StepConfig[] = [
  {
    id: 0,
    code: "STEP 01",
    title: "SYSTEM INITIALIZATION",
    subtitle: "Welcome to ALFRED // Autonomous Local Framework & Executive Director",
    icon: Sparkles,
  },
  {
    id: 1,
    code: "STEP 02",
    title: "AI PROVIDER ARCHITECTURE",
    subtitle: "Select neural engine for reasoning, planning, and task execution",
    icon: Cpu,
  },
  {
    id: 2,
    code: "STEP 03",
    title: "ACOUSTIC & VOICE INTERFACE",
    subtitle: "Configure local Whisper transcription, wake-word detection, and neural TTS",
    icon: Mic,
  },
  {
    id: 3,
    code: "STEP 04",
    title: "GLOBAL DESKTOP SUMMON",
    subtitle: "Configure system-wide hotkey launcher and background tray presence",
    icon: Keyboard,
  },
  {
    id: 4,
    code: "STEP 05",
    title: "SECURITY & PRIVACY COVENANT",
    subtitle: "Local-first data guarantees, bounded execution, and mutation confirmation",
    icon: Shield,
  },
  {
    id: 5,
    code: "STEP 06",
    title: "SYSTEM OPERATIONAL",
    subtitle: "Review telemetry state and launch your personal intelligence command center",
    icon: CheckCircle2,
  },
];

export default function FirstLaunchOnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [settings, setSettings] = useState<AlfredSettings | null>(null);

  // Local draft state for quick adjustments
  const [activeProvider, setActiveProvider] = useState<"mock" | "ollama" | "gemini" | "claude">("mock");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [ttsRate, setTtsRate] = useState(1.0);
  const [hotkeyShortcut, setHotkeyShortcut] = useState("CommandOrControl+Shift+Space");
  const [requireConfirmation, setRequireConfirmation] = useState(true);
  const [closeToTray, setCloseToTray] = useState(true);

  // Check onboarding status on boot from persistent SettingsService
  useEffect(() => {
    let isSubscribed = true;

    const checkInitialOnboarding = async () => {
      // Memory check prevents reopening during the same renderer session or route changes
      if (typeof window !== "undefined" && (window as any).__ALFRED_ONBOARDING_COMPLETED__ === true) {
        return;
      }

      if (typeof window !== "undefined" && window.electron?.settings) {
        try {
          const s = await window.electron.settings.get();
          if (!isSubscribed) return;
          setSettings(s);
          if (s) {
            setActiveProvider(s.aiProvider?.activeProvider || "mock");
            setVoiceEnabled(s.voice?.enabled ?? true);
            setWakeWordEnabled(s.wakeWord?.enabled ?? true);
            setTtsEnabled(s.tts?.enabled ?? true);
            setTtsRate(s.tts?.rate ?? 1.0);
            setHotkeyShortcut(s.hotkey?.shortcut || "CommandOrControl+Shift+Space");
            setRequireConfirmation(s.permissions?.requireConfirmationForMutations ?? true);
            setCloseToTray(s.background?.closeToTray ?? true);

            // Persistent SettingsService is the single source of truth
            if (s.onboarding?.completed === true) {
              (window as any).__ALFRED_ONBOARDING_COMPLETED__ = true;
              try {
                window.localStorage?.setItem("alfred_onboarding_completed", "true");
              } catch {}
              setIsOpen(false);
            } else {
              // FIRST EVER LAUNCH: onboarding.completed is false -> show wizard
              setIsOpen(true);
            }
          }
        } catch (err) {
          console.error("Failed to check onboarding state:", err);
        }
      }
    };

    checkInitialOnboarding();

    const handleOpenWizard = () => {
      playClickSound();
      setCurrentStep(0);
      setIsOpen(true);
    };

    window.addEventListener("open-onboarding-modal", handleOpenWizard);
    return () => {
      isSubscribed = false;
      window.removeEventListener("open-onboarding-modal", handleOpenWizard);
    };
  }, []);

  const handleComplete = useCallback(async () => {
    playSuccessSound();
    if (typeof window !== "undefined") {
      try {
        window.localStorage?.setItem("alfred_onboarding_completed", "true");
        window.sessionStorage?.setItem("alfred_onboarding_completed", "true");
        (window as any).__ALFRED_ONBOARDING_COMPLETED__ = true;
      } catch {}
    }
    if (typeof window !== "undefined" && window.electron?.settings) {
      try {
        await window.electron.settings.update({
          aiProvider: {
            activeProvider,
            temperature: settings?.aiProvider.temperature ?? 0.7,
            hasConfiguredApiKey: settings?.aiProvider.hasConfiguredApiKey ?? false,
          },
          voice: {
            enabled: voiceEnabled,
            language: "en",
          },
          wakeWord: {
            enabled: wakeWordEnabled,
            phrase: "Hey Alfred",
            threshold: 0.5,
          },
          tts: {
            enabled: ttsEnabled,
            rate: ttsRate,
          },
          hotkey: {
            enabled: true,
            shortcut: hotkeyShortcut,
          },
          background: {
            closeToTray,
            startMinimized: false,
          },
          permissions: {
            ...(settings?.permissions || {
              read_only: true,
              productivity_mutation: true,
              desktop_control: true,
              automation: true,
              knowledge_access: true,
              notification: true,
              strictDataOnlyMode: true,
            }),
            requireConfirmationForMutations: requireConfirmation,
          },
          onboarding: {
            completed: true,
            completedAt: new Date().toISOString(),
          },
        });
      } catch (err) {
        console.error("Failed to commit onboarding settings:", err);
      }
    }
    setIsOpen(false);
  }, [
    activeProvider,
    voiceEnabled,
    wakeWordEnabled,
    ttsEnabled,
    ttsRate,
    hotkeyShortcut,
    requireConfirmation,
    closeToTray,
    settings,
  ]);

  const handleNext = () => {
    playClickSound();
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    playClickSound();
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  if (!isOpen) return null;

  const currentStepConfig = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#0B0F17] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-white"
      >
        {/* Top Header & Telemetry Stepper */}
        <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span className="text-xs font-mono font-bold tracking-widest text-cyan-400 uppercase">
                ALFRED SYSTEM ONBOARDING // INITIAL SETUP
              </span>
            </div>
            <button
              onClick={handleSkip}
              className="text-xs font-mono text-white/40 hover:text-white/80 transition-colors px-2.5 py-1 rounded border border-white/10 hover:border-white/20"
            >
              SKIP WIZARD
            </button>
          </div>

          {/* Stepper Progress Indicator */}
          <div className="grid grid-cols-6 gap-1.5">
            {STEPS.map((s, index) => {
              const isActive = index === currentStep;
              const isPassed = index < currentStep;
              return (
                <div key={s.id} className="flex flex-col gap-1">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isActive
                        ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                        : isPassed
                        ? "bg-cyan-500/50"
                        : "bg-white/10"
                    }`}
                  />
                  <div className="flex items-center justify-between text-[10px] font-mono text-white/40 px-0.5">
                    <span className={isActive ? "text-cyan-300 font-bold" : isPassed ? "text-white/70" : "text-white/30"}>
                      0{index + 1}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Body Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          <div className="border-b border-white/10 pb-4">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <currentStepConfig.icon size={22} />
              </div>
              <div>
                <span className="text-[11px] font-mono tracking-widest text-cyan-400 uppercase font-semibold">
                  {currentStepConfig.code}
                </span>
                <h2 className="text-xl font-bold tracking-wide text-white font-mono">
                  {currentStepConfig.title}
                </h2>
              </div>
            </div>
            <p className="text-xs text-white/60 ml-11">{currentStepConfig.subtitle}</p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              {/* STEP 0: Welcome & Philosophy */}
              {currentStep === 0 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-cyan-950/20 border border-cyan-500/30 text-xs text-cyan-200/90 leading-relaxed font-mono">
                    <p className="font-semibold text-cyan-300 mb-1">
                      [DIRECTIVE: AUTONOMOUS DESKTOP INTELLIGENCE]
                    </p>
                    ALFRED is engineered as an offline-capable, local-first personal AI operating system.
                    Unlike web chat wrappers, ALFRED integrates with your desktop environment, executes bounded system tools, coordinates routines, and safeguards your privacy with cryptographic and confirmation boundaries.
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-lg border border-white/10 bg-white/[0.02]">
                      <Lock size={18} className="text-emerald-400 mb-2" />
                      <div className="text-xs font-bold text-white mb-1">Zero Cloud Dependency</div>
                      <div className="text-[11px] text-white/50 leading-normal">
                        Knowledge vault and memories live locally in your user workspace.
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border border-white/10 bg-white/[0.02]">
                      <Terminal size={18} className="text-cyan-400 mb-2" />
                      <div className="text-xs font-bold text-white mb-1">ToolRegistry Boundary</div>
                      <div className="text-[11px] text-white/50 leading-normal">
                        All machine actions pass through strict permission checks and confirmation.
                      </div>
                    </div>
                    <div className="p-3.5 rounded-lg border border-white/10 bg-white/[0.02]">
                      <Zap size={18} className="text-amber-400 mb-2" />
                      <div className="text-xs font-bold text-white mb-1">Sub-Second Dispatch</div>
                      <div className="text-[11px] text-white/50 leading-normal">
                        Global hotkey launcher summons ALFRED from background tray instantly.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 1: AI Provider Selection */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="text-xs text-white/70">
                    Select your primary reasoning provider. ALFRED works 100% offline out-of-the-box using the deterministic Mock Engine or your locally running Ollama instance.
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        id: "mock",
                        name: "Mock Engine (Deterministic)",
                        badge: "100% OFFLINE",
                        desc: "Instant deterministic replies and intent matching. Requires zero API keys or downloads.",
                      },
                      {
                        id: "ollama",
                        name: "Local Ollama (Llama 3 / Mistral)",
                        badge: "LOCAL GPU / PRIVATE",
                        desc: "Fully private neural inference running on localhost:11434. Completely sovereign.",
                      },
                      {
                        id: "gemini",
                        name: "Google Gemini (Flash / Pro)",
                        badge: "CLOUD HYBRID",
                        desc: "High-speed multi-modal intelligence via GEMINI_API_KEY environment variable.",
                      },
                      {
                        id: "claude",
                        name: "Anthropic Claude (Sonnet)",
                        badge: "CLOUD HYBRID",
                        desc: "Advanced tool reasoning and planning via ANTHROPIC_API_KEY environment variable.",
                      },
                    ].map((p) => {
                      const isSelected = activeProvider === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => {
                            playClickSound();
                            setActiveProvider(p.id as any);
                          }}
                          className={`text-left p-3.5 rounded-lg border transition-all ${
                            isSelected
                              ? "bg-cyan-500/10 border-cyan-400 text-white shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                              : "bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/[0.04] hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                              {p.name}
                            </span>
                            <span
                              className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                                isSelected
                                  ? "bg-cyan-400/20 text-cyan-300 border border-cyan-400/40"
                                  : "bg-white/10 text-white/50"
                              }`}
                            >
                              {p.badge}
                            </span>
                          </div>
                          <div className="text-[11px] text-white/50 leading-relaxed">{p.desc}</div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-3 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-between text-xs text-white/60 font-mono">
                    <span>SECRETS COVENANT:</span>
                    <span className="text-emerald-400">API keys are NEVER saved in localStorage or exposed to renderer</span>
                  </div>
                </div>
              )}

              {/* STEP 2: Acoustic & Voice Interface */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="text-xs text-white/70">
                    ALFRED includes a complete offline acoustic pipeline: local Whisper speech recognition, OpenWakeWord / VAD wake detection, and Windows SAPI speech synthesis.
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-white/10 bg-white/[0.02]">
                      <div>
                        <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                          <Mic size={15} className="text-cyan-400" />
                          LOCAL WHISPER SPEECH RECOGNITION
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5">
                          Converts voice input to text locally via embedded Whisper worker
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={voiceEnabled}
                        onChange={(e) => setVoiceEnabled(e.target.checked)}
                        className="w-4 h-4 accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-white/10 bg-white/[0.02]">
                      <div>
                        <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                          <Sparkles size={15} className="text-amber-400" />
                          WAKE-WORD DETECTION (&ldquo;Hey Alfred&rdquo;)
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5">
                          Listens passively in background for wake invocation phrase
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={wakeWordEnabled}
                        onChange={(e) => setWakeWordEnabled(e.target.checked)}
                        className="w-4 h-4 accent-cyan-400 cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-lg border border-white/10 bg-white/[0.02]">
                      <div>
                        <div className="text-xs font-bold text-white font-mono flex items-center gap-2">
                          <Volume2 size={15} className="text-emerald-400" />
                          WINDOWS SAPI NEURAL TTS OUTPUT
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5">
                          Speaks responses and proactive notifications aloud
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={ttsEnabled}
                        onChange={(e) => setTtsEnabled(e.target.checked)}
                        className="w-4 h-4 accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  {ttsEnabled && (
                    <div className="p-3 rounded-lg border border-white/10 bg-white/[0.01] flex items-center justify-between text-xs">
                      <span className="font-mono text-white/60">SPEECH RATE: {ttsRate.toFixed(1)}x</span>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={ttsRate}
                        onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                        className="w-48 accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: Global Hotkey & Launcher */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="text-xs text-white/70">
                    Summon ALFRED instantly from any application or game using the global system shortcut. When ALFRED is minimized to the system tray, pressing this shortcut restores focus immediately to the Command Terminal.
                  </div>

                  <div className="p-4 rounded-lg border border-cyan-500/30 bg-cyan-950/15 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-cyan-300">
                        GLOBAL SUMMON HOTKEY
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-300">
                        ACTIVE
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={hotkeyShortcut}
                        onChange={(e) => setHotkeyShortcut(e.target.value)}
                        className="flex-1 bg-black/60 border border-white/20 rounded px-3 py-2 text-sm font-mono text-cyan-200 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        onClick={() => {
                          playClickSound();
                          setHotkeyShortcut("CommandOrControl+Shift+Space");
                        }}
                        className="px-3 py-2 rounded border border-white/10 bg-white/5 text-xs font-mono text-white/70 hover:text-white hover:bg-white/10"
                      >
                        RESET DEFAULT
                      </button>
                    </div>

                    <div className="text-[11px] font-mono text-white/50">
                      Standard: <code className="text-cyan-400">Ctrl+Shift+Space</code> (Windows/Linux) or{" "}
                      <code className="text-cyan-400">Cmd+Shift+Space</code> (macOS)
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-white/10 bg-white/[0.02]">
                    <div>
                      <div className="text-xs font-bold text-white font-mono">CLOSE TO SYSTEM TRAY</div>
                      <div className="text-[11px] text-white/50 mt-0.5">
                        Closing the window leaves ALFRED active in background to service hotkey & automations
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={closeToTray}
                      onChange={(e) => setCloseToTray(e.target.checked)}
                      className="w-4 h-4 accent-cyan-400 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: Security & Privacy Covenant */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="text-xs text-white/70">
                    ALFRED adheres to strict defense-in-depth principles. System commands cannot be executed directly by AI providers or renderer scripts without passing through ToolRegistry validation and ConfirmationStore.
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-950/15 flex items-start gap-3">
                      <Shield size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-emerald-300 font-mono">
                          MANDATORY MUTATION CONFIRMATION
                        </div>
                        <div className="text-[11px] text-emerald-200/70 mt-0.5 leading-relaxed">
                          Actions that modify tasks, projects, system state, or workspace files require explicit user approval via confirmation tokens before execution.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={requireConfirmation}
                        onChange={(e) => setRequireConfirmation(e.target.checked)}
                        className="w-4 h-4 accent-emerald-400 cursor-pointer shrink-0 mt-1"
                      />
                    </div>

                    <div className="p-3.5 rounded-lg border border-white/10 bg-white/[0.02] flex items-start gap-3">
                      <Lock size={18} className="text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white font-mono">
                          NO INVASIVE SURVEILLANCE
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                          Screenshots, keylogging, external memory inspection, and browser history harvesting are permanently disabled at the architecture level.
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-white/10 bg-white/[0.02] flex items-start gap-3">
                      <Server size={18} className="text-white/60 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-white font-mono">
                          LOCAL DATA PERSISTENCE
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5 leading-relaxed">
                          Your knowledge vault documents and user memories reside exclusively under <code className="text-cyan-400">.alfred/</code> in your user home directory.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: Operational Readiness & Launch */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg border border-cyan-500/30 bg-cyan-950/20 space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-cyan-400" />
                      <span className="text-xs font-bold text-cyan-300 font-mono tracking-wider">
                        ALFRED INITIALIZATION PROFILE PREPARED
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <span className="text-white/40 block">AI REASONING:</span>
                        <span className="text-cyan-300 font-semibold uppercase">{activeProvider}</span>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <span className="text-white/40 block">SUMMON SHORTCUT:</span>
                        <span className="text-cyan-300 font-semibold">{hotkeyShortcut}</span>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <span className="text-white/40 block">ACOUSTIC PIPELINE:</span>
                        <span className="text-emerald-400 font-semibold">
                          {voiceEnabled ? "WHISPER LOCAL" : "DISABLED"} {"//"} {wakeWordEnabled ? "WAKE WORD ACTIVE" : "MANUAL"}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-black/40 border border-white/5">
                        <span className="text-white/40 block">SAFETY LEVEL:</span>
                        <span className="text-emerald-400 font-semibold">
                          {requireConfirmation ? "STRICT CONFIRMATION" : "DIRECT"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-white/60 leading-relaxed font-mono">
                    Ready to initialize ALFRED. You can re-open this configuration wizard or adjust individual subsystem parameters anytime from the Settings modal (<code className="text-cyan-400">Ctrl+,</code> or Top Bar).
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-8 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <div>
            {currentStep > 0 ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-xs font-mono text-white/80 hover:text-white hover:bg-white/5 transition-all"
              >
                <ArrowLeft size={14} />
                BACK
              </button>
            ) : (
              <div className="text-[11px] font-mono text-white/30">INITIAL SETUP 1/6</div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleNext}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all ${
                currentStep === STEPS.length - 1
                  ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.5)]"
                  : "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40"
              }`}
            >
              {currentStep === STEPS.length - 1 ? (
                <>
                  <Check size={15} />
                  INITIALIZE ALFRED CORE
                </>
              ) : (
                <>
                  PROCEED
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
