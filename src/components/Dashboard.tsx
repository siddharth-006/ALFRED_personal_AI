"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Flame,
  CheckCircle2,
  Circle,
  CheckCircle,
  Target,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Layers,
  Crosshair,
  Activity,
  ChevronDown,
  X,
  Code,
  LineChart,
  Terminal,
  Brain,
  Briefcase,
  ArrowRight,
  Mic,
  MicOff,
  Sparkles,
} from "lucide-react";
import { useTasks, Task } from "@/context/TaskContext";
import { useGoals } from "@/context/GoalContext";
import { useProjects } from "@/context/ProjectContext";
import { useWorkspaces, Workspace, WorkspaceType } from "@/context/WorkspaceContext";
import { useFocus } from "@/context/FocusContext";
import { getStreakData, StreakData } from "@/utils/streakUtils";
import { getFocusName } from "@/utils/focusMapping";
import {
  playClickSound,
  playHoverSound,
  playSuccessSound,
  AlfredAudioService,
} from "@/utils/audioSystem";
import {
  subscribeToAlfredActivity,
  AlfredActivityEventDetail,
} from "@/utils/activityBus";
import AlfredCore, { CoreState, ProductivitySummary } from "./AlfredCore";
import { VoiceInputService, VoiceState } from "@/utils/voiceInputService";
import type { ProactiveSuggestion } from "../../electron/agent/proactive/proactive.types";
import MorningBriefingPanel from "./MorningBriefingPanel";
import EndOfDayReviewPanel from "./EndOfDayReviewPanel";
import WeeklyReviewPanel from "./WeeklyReviewPanel";
import DemoExperience from "./DemoExperience";
import { AmbientModePanel } from "./ambient/AmbientModePanel";

const MOTIVATIONS = [
  {
    quote: "Small consistent steps lead to big results.",
    author: "ALFRED",
    subtitle: "DAILY ARCHITECTURE PRINCIPLE",
  },
  {
    quote: "Discipline is choosing between what you want now and what you want most.",
    author: "ALFRED",
    subtitle: "EXECUTION STANDARD",
  },
  {
    quote: "Focus is a muscle. Train it with deep work every day.",
    author: "ALFRED",
    subtitle: "OPERATIONAL DISCIPLINE",
  },
  {
    quote: "Systems outlast motivation. Trust the architecture.",
    author: "ALFRED",
    subtitle: "FOUNDATIONAL MINDSET",
  },
  {
    quote: "Action eliminates anxiety. Begin the next highest priority.",
    author: "ALFRED",
    subtitle: "STRATEGIC MOMENTUM",
  },
  {
    quote: "Excellence is not an act, but a habit. Keep your streak intact.",
    author: "ALFRED",
    subtitle: "CONSISTENCY DIRECTIVE",
  },
];


const getWorkspaceIcon = (type: WorkspaceType, size = 15) => {
  switch (type) {
    case "dsa":
      return <Code size={size} />;
    case "datascience":
      return <LineChart size={size} />;
    case "hackathon":
      return <Terminal size={size} />;
    case "machinelearning":
      return <Brain size={size} />;
    case "custom":
    default:
      return <Briefcase size={size} />;
  }
};

export default function Dashboard() {
  const { tasks, toggleTask } = useTasks();
  const { goals } = useGoals();
  const { projects } = useProjects();
  const { currentFocus, setFocus, workspaces, launchWorkspace } = useWorkspaces();

  // Streak & System state
  const [streakData, setStreakData] = useState<StreakData>({ currentStreak: 0, lastActiveDate: null });

  // Command input bar state
  const [quickPrompt, setQuickPrompt] = useState("");
  const [coreState, setCoreState] = useState<CoreState>("idle");
  const [activeProvider, setActiveProvider] = useState<string>("mock");

  // Voice Input Foundation State
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceDetail, setVoiceDetail] = useState<string>("");

  // Workspace launch modal state
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [launchMessage, setLaunchMessage] = useState("");

  // Demo experience modal state
  const [isDemoOpen, setIsDemoOpen] = useState(false);

  // Load real streak data
  useEffect(() => {
    setStreakData(getStreakData());
  }, [tasks]);

  // Listen for open-alfred-demo custom events
  useEffect(() => {
    const handleOpenDemo = () => {
      setIsDemoOpen(true);
    };
    window.addEventListener("open-alfred-demo", handleOpenDemo);
    return () => window.removeEventListener("open-alfred-demo", handleOpenDemo);
  }, []);

  // Read active AI provider from Electron
  useEffect(() => {
    if (typeof window !== "undefined" && window.electron?.aiProvider) {
      window.electron.aiProvider.getActive().then((provider) => {
        if (provider) setActiveProvider(provider);
      }).catch(() => {});
    }
  }, []);

  // Subscribe to real activity bus events for system core state
  useEffect(() => {
    const unsubscribe = subscribeToAlfredActivity((event: AlfredActivityEventDetail) => {
      if (event.state) {
        setCoreState(event.state as CoreState);
      }
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to VoiceInputService events
  useEffect(() => {
    const unsubState = VoiceInputService.subscribeState((vState, detail) => {
      setVoiceState(vState);
      if (detail) setVoiceDetail(detail);
      if (vState === "listening") {
        setCoreState("listening");
      } else if (vState === "processing") {
        setCoreState("thinking");
      } else if (vState === "idle" && coreState === "listening") {
        setCoreState("idle");
      }
    });

    const unsubTranscript = VoiceInputService.subscribeTranscript((text) => {
      if (text) {
        setQuickPrompt(text);
      }
    });

    return () => {
      unsubState();
      unsubTranscript();
    };
  }, [coreState]);

  const handleToggleVoice = async () => {
    playClickSound();
    if (VoiceInputService.isListening()) {
      await VoiceInputService.stopListening();
    } else {
      try {
        await VoiceInputService.startListening();
      } catch {}
    }
  };

  // Focus Session from dedicated FocusContext
  const {
    durationMinutes,
    setDurationMinutes,
    timerState,
    remainingSeconds,
    startFocus,
    pauseFocus,
    resumeFocus,
    resetFocus,
    addFiveMinutes,
    stats: focusStats,
  } = useFocus();

  // Synchronize Core State to "focus" when focus timer is running
  const effectiveCoreState: CoreState = timerState === "running" && coreState === "idle" ? "focus" : coreState;

  // Motivation Rotation state
  const [motivationIndex, setMotivationIndex] = useState(0);

  const nextMotivation = useCallback(() => {
    playClickSound();
    setMotivationIndex((prev) => (prev + 1) % MOTIVATIONS.length);
  }, []);

  // Duration selector dropdown toggle
  const [isDurationDropdownOpen, setIsDurationDropdownOpen] = useState(false);
  const [customDurationInput, setCustomDurationInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Focus Session category selector dropdown state for Today's Mission
  const [isMissionFocusDropdownOpen, setIsMissionFocusDropdownOpen] = useState(false);

  // Proactive Intelligence State (Phase 5.5C)
  const [proactiveSuggestion, setProactiveSuggestion] = useState<ProactiveSuggestion | null>(null);

  // Phase 5.8C: Canonical Coding Session State from FocusService
  const [codingSessionInfo, setCodingSessionInfo] = useState<{
    isActive: boolean;
    sessionName?: string;
    activeWorkspace?: string;
    activeApplication?: string;
    state?: string;
  } | null>(null);

  const refreshCodingSessionState = useCallback(async () => {
    if (typeof window !== "undefined" && window.electron?.focus?.getStatus) {
      try {
        const summary = await window.electron.focus.getStatus();
        if (summary && summary.isActive) {
          setCodingSessionInfo({
            isActive: true,
            sessionName: summary.sessionName,
            activeWorkspace: summary.activeWorkspace,
            activeApplication: summary.activeApplication,
            state: summary.state,
          });
        } else {
          setCodingSessionInfo(null);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    refreshCodingSessionState();
    const interval = setInterval(refreshCodingSessionState, 1500);
    return () => clearInterval(interval);
  }, [refreshCodingSessionState]);

  const refreshProactiveSuggestions = useCallback(async () => {
    if (typeof window !== "undefined" && window.electron?.proactive?.getSuggestions) {
      try {
        const result = await window.electron.proactive.getSuggestions();
        if (result && result.activeSuggestion) {
          setProactiveSuggestion(result.activeSuggestion);
        } else {
          setProactiveSuggestion(null);
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    refreshProactiveSuggestions();
    const unsub = subscribeToAlfredActivity(() => {
      refreshProactiveSuggestions();
    });
    return unsub;
  }, [refreshProactiveSuggestions, tasks, timerState]);

  const handleDismissProactive = async () => {
    playClickSound();
    if (proactiveSuggestion && window.electron?.proactive?.dismiss) {
      await window.electron.proactive.dismiss(proactiveSuggestion.cooldownKey || proactiveSuggestion.id);
    }
    setProactiveSuggestion(null);
  };

  const handleExecuteProactiveAction = (cmd: string) => {
    playClickSound();
    window.dispatchEvent(
      new CustomEvent("open-command-terminal", {
        detail: { initialCommand: cmd, autoExecute: false },
      })
    );
  };

  // Available focus options aggregated from workspaces, task categories, and presets
  const availableFocusOptions = useMemo(() => {
    const defaultCategories = ["DSA", "Data Science", "Machine Learning", "College", "Hackathon", "Personal"];
    const taskCategories = tasks.map((t) => t.category).filter(Boolean);
    const workspaceTypes = workspaces.map((w) => getFocusName(w.type));
    const combined = Array.from(new Set([...defaultCategories, ...taskCategories, ...workspaceTypes]));
    return combined;
  }, [tasks, workspaces]);

  const focusedCategory = currentFocus;

  // Normalized matching helper (handles "datascience" vs "Data Science" vs "data science")
  const matchesFocus = useCallback(
    (itemCategory: string, focusVal: string | null) => {
      if (!focusVal) return true;
      const cleanFocus = focusVal.toLowerCase().replace(/[\s_-]+/g, "");
      const cleanCat = itemCategory.toLowerCase().replace(/[\s_-]+/g, "");
      return cleanCat === cleanFocus || cleanCat.includes(cleanFocus) || cleanFocus.includes(cleanCat);
    },
    []
  );

  // Derived real metrics
  // Mission Task Selection: Focus on currentFocus category if set and has tasks, or active mission list
  const missionTasks: Task[] = useMemo(() => {
    if (focusedCategory) {
      const categoryTasks = tasks.filter((t) => matchesFocus(t.category, focusedCategory));
      if (categoryTasks.length > 0) return categoryTasks;
    }
    return tasks;
  }, [tasks, focusedCategory, matchesFocus]);

  const missionCompletedTasks = missionTasks.filter((t) => t.completed).length;
  const missionTotalTasks = missionTasks.length;
  const missionProgressPercentage =
    missionTotalTasks > 0
      ? Math.round((missionCompletedTasks / missionTotalTasks) * 100)
      : 0;

  // Overall system task counts
  const totalCompletedTasks = tasks.filter((t) => t.completed).length;
  const totalTasksCount = tasks.length;
  const completedGoals = goals.filter((g) => g.completed).length;
  const totalGoals = goals.length;
  const activeProjectsCount = projects.filter((p) => p.status === "In Progress" || p.status === "Not Started").length;

  // Today's Mission Lead: first incomplete task in mission set, or first task
  const todayMission: Task | undefined = useMemo(() => {
    return missionTasks.find((t) => !t.completed) || missionTasks[0];
  }, [missionTasks]);

  // Next Best Action (deterministic derivation from pending tasks/goals)
  const nextAction = useMemo(() => {
    // 1. Check for uncompleted tasks in focus category
    if (focusedCategory) {
      const match = tasks.find(
        (t) => !t.completed && matchesFocus(t.category, focusedCategory)
      );
      if (match) {
        return {
          title: match.text,
          category: match.category,
          reason: `Aligned with current ${getFocusName(focusedCategory)} focus`,
          taskId: match.id,
          type: "task" as const,
        };
      }
    }
    // 2. Check for incomplete goal
    const activeGoal = goals.find((g) => !g.completed && g.current < g.target);
    if (activeGoal) {
      return {
        title: activeGoal.title,
        category: `${activeGoal.type} Goal`,
        reason: `Target: ${activeGoal.current}/${activeGoal.target} completed`,
        goalId: activeGoal.id,
        type: "goal" as const,
      };
    }
    // 3. Fallback to any pending task
    const pendingTask = tasks.find((t) => !t.completed);
    if (pendingTask) {
      return {
        title: pendingTask.text,
        category: pendingTask.category,
        reason: "Highest pending item in mission queue",
        taskId: pendingTask.id,
        type: "task" as const,
      };
    }
    return null;
  }, [tasks, goals, focusedCategory, matchesFocus]);

  // Upcoming items derived from real tasks & goals using Priority & Sequence (NO fake times)
  const upcomingItems = useMemo(() => {
    const uncompleted = tasks.filter((t) => !t.completed && t.id !== todayMission?.id);
    const colors = ["bg-cyan-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500", "bg-purple-500"];
    
    if (uncompleted.length > 0) {
      return uncompleted.slice(0, 5).map((task, idx) => ({
        priority: `P0${idx + 1}`,
        title: task.text,
        color: colors[idx % colors.length],
        category: task.category,
      }));
    }
    // Fallback to active goals if all tasks completed
    return goals.slice(0, 4).map((g, idx) => ({
      priority: `G0${idx + 1}`,
      title: `${g.title} (${g.current}/${g.target})`,
      color: colors[idx % colors.length],
      category: g.type,
    }));
  }, [tasks, goals, todayMission]);

  // Productivity summary for Core 2.0
  const productivitySummary: ProductivitySummary = useMemo(
    () => ({
      completedTasks: totalCompletedTasks,
      totalTasks: totalTasksCount,
      currentStreak: streakData.currentStreak,
      activeProjects: activeProjectsCount,
      focusCategory: currentFocus,
      todayFocusMinutes: focusStats.todayFocusMinutes,
    }),
    [totalCompletedTasks, totalTasksCount, streakData.currentStreak, activeProjectsCount, currentFocus, focusStats.todayFocusMinutes]
  );

  // Quick Command dispatch to Command Terminal
  const dispatchCommand = (prompt: string, autoExecute: boolean = true) => {
    playClickSound();
    setCoreState("executing");
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("open-command-terminal", {
          detail: { initialCommand: prompt, autoExecute },
        })
      );
    }
    setTimeout(() => setCoreState("idle"), 2500);
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPrompt.trim()) return;
    dispatchCommand(quickPrompt.trim(), true);
    setQuickPrompt("");
  };

  const handleTaskToggle = (taskId: string, wasCompleted: boolean) => {
    if (!wasCompleted) playSuccessSound();
    else playClickSound();
    toggleTask(taskId);
  };

  const openLaunchModal = (ws: Workspace) => {
    playClickSound();
    setActiveWorkspace(ws);
    setLaunchMessage("");
    setIsLaunchModalOpen(true);
  };

  const executeLaunch = async () => {
    if (!activeWorkspace) return;
    launchWorkspace(activeWorkspace.id);

    if (window.electron?.workspace) {
      const res = await window.electron.workspace.launch(activeWorkspace);
      if (res && res.success) {
        AlfredAudioService.play("workspace");
        setLaunchMessage("WORKSPACE LAUNCH SEQUENCE EXECUTED VIA ELECTRON.");
      } else {
        AlfredAudioService.play("error");
        setLaunchMessage("WORKSPACE LAUNCH FAILED VIA ELECTRON.");
      }
    } else {
      let openedCount = 0;
      activeWorkspace.websites.forEach((url) => {
        const newWin = window.open(url, "_blank");
        if (newWin) openedCount++;
      });
      if (openedCount < activeWorkspace.websites.length && activeWorkspace.websites.length > 0) {
        AlfredAudioService.play("error");
        setLaunchMessage("WARNING: BROWSER POP-UP BLOCKER DETECTED.");
      } else {
        AlfredAudioService.play("workspace");
        setLaunchMessage("INITIATING WORKSPACE DEPLOYMENT...");
      }
    }

    setTimeout(() => {
      setIsLaunchModalOpen(false);
      setActiveWorkspace(null);
    }, 1600);
  };

  // Recent 7 days streak indicator derivation
  const streakDays = useMemo(() => {
    const days = ["M", "T", "W", "T", "F", "S", "S"];
    const todayIndex = (new Date().getDay() + 6) % 7; // Monday = 0
    return days.map((dayLabel, idx) => {
      const isPastOrToday = idx <= todayIndex;
      const isToday = idx === todayIndex;
      const offset = todayIndex - idx;
      const isActive = isPastOrToday && offset >= 0 && offset < streakData.currentStreak;
      return {
        label: dayLabel,
        isToday,
        isActive,
      };
    });
  }, [streakData.currentStreak]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Productivity formatted focus hours/minutes
  const formattedFocusTime = useMemo(() => {
    const mins = focusStats.todayFocusMinutes;
    if (mins < 60) {
      return `${mins}m`;
    }
    const hrs = (mins / 60).toFixed(1);
    return `${hrs}h`;
  }, [focusStats.todayFocusMinutes]);

  const handleCustomDurationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(customDurationInput, 10);
    if (!isNaN(val) && val > 0 && val <= 180) {
      setDurationMinutes(val);
      setShowCustomInput(false);
      setIsDurationDropdownOpen(false);
      setCustomDurationInput("");
      playClickSound();
    }
  };

  // Circular progress for Focus Session
  const focusTotalSecs = durationMinutes * 60;
  const focusElapsedSecs = Math.max(0, focusTotalSecs - remainingSeconds);
  const focusProgressPct = Math.min(100, Math.round((focusElapsedSecs / focusTotalSecs) * 100));

  return (
    <div className="p-4 md:p-6 bg-transparent min-h-screen relative text-slate-200 select-none space-y-5">
      {/* Background Ambient Technological Lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[radial-gradient(circle,rgba(225,29,72,0.14)_0%,rgba(225,29,72,0.03)_50%,transparent_75%)] pointer-events-none" />

      {/* Phase 5.5C: Tactical Proactive Suggestion Banner */}
      <AnimatePresence>
        {proactiveSuggestion && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            className="alfred-panel p-4 rounded-sm border-l-2 border-l-[#06B6D4] bg-[#0B0E17]/90 backdrop-blur-md shadow-[0_0_18px_rgba(6,182,212,0.12)] relative z-20 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
          >
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-sm bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4] mt-0.5 shrink-0">
                <Brain size={16} className="animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono tracking-widest text-[#06B6D4] uppercase font-bold">
                    TACTICAL OBSERVATION // {proactiveSuggestion.type.replace(/_/g, " ")}
                  </span>
                  {proactiveSuggestion.priority === "high" && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-[#E11D48]/20 border border-[#E11D48]/40 text-[#E11D48] font-bold">
                      PRIORITY
                    </span>
                  )}
                </div>
                <h4 className="text-xs font-mono font-bold text-white tracking-wide">
                  {proactiveSuggestion.title}
                </h4>
                <p className="text-xs font-sans text-slate-300 leading-relaxed">
                  {proactiveSuggestion.message}
                </p>
                <p className="text-[11px] font-mono text-slate-400 italic">
                  Rationale: {proactiveSuggestion.rationale}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end md:self-center pt-2 md:pt-0">
              {proactiveSuggestion.suggestedAction && (
                <button
                  type="button"
                  onClick={() => handleExecuteProactiveAction(proactiveSuggestion.suggestedAction!.command)}
                  className="px-3 py-1.5 rounded-sm bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4] text-[#06B6D4] hover:text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                >
                  <span>{proactiveSuggestion.suggestedAction.label}</span>
                  <ArrowRight size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={handleDismissProactive}
                className="px-2.5 py-1.5 rounded-sm bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-slate-400 hover:text-white text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer"
                title="Dismiss this observation"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 5.8B: Morning Briefing Overview Surface */}
      <MorningBriefingPanel />

      {/* Phase 5.8D: End-of-Day Review Surface */}
      <EndOfDayReviewPanel />

      {/* ALFRED 6.0: Weekly Intelligence / Review Surface */}
      <WeeklyReviewPanel />

      {/* =========================================================================
          MAIN TOP ROW: LEFT COLUMN (Mission + Focus), CENTER STAGE (ALFRED Core 2.0), RIGHT COLUMN (Productivity + Live Activity)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch relative z-10">

        {/* LEFT COLUMN: Today's Mission & Focus Session (3.5 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4 flex flex-col justify-between">
          
          {/* Panel 1: TODAY'S MISSION (with vertical rail) */}
          <div className="alfred-panel p-5 space-y-3.5 border-l-2 border-l-[#E11D48] relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 relative">
                <Target size={16} className="text-[#E11D48]" />
                <h3 className="font-header text-sm font-bold tracking-widest text-white uppercase">
                  TODAY&apos;S MISSION
                </h3>

                {/* Focus Session Switcher Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setIsMissionFocusDropdownOpen((prev) => !prev);
                    }}
                    title="Change focus session"
                    className="flex items-center space-x-1 text-[9px] font-mono text-[#06B6D4] hover:text-white bg-[#06B6D4]/10 hover:bg-[#06B6D4]/20 border border-[#06B6D4]/30 px-1.5 py-0.5 rounded uppercase transition-colors cursor-pointer"
                  >
                    <span>{focusedCategory || "ALL SESSIONS"}</span>
                    <ChevronDown size={10} className="text-[#06B6D4]" />
                  </button>

                  {/* Focus Dropdown Menu */}
                  {isMissionFocusDropdownOpen && (
                    <div className="absolute left-0 top-6 w-44 bg-[#0B0E17] border border-white/[0.15] shadow-2xl rounded-lg py-1 z-30 space-y-0.5 text-xs font-sans">
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setFocus(null);
                          setIsMissionFocusDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-between ${
                          !focusedCategory ? "text-[#E11D48] font-bold" : "text-slate-300"
                        }`}
                      >
                        <span>All Sessions (No Filter)</span>
                        {!focusedCategory && <span className="text-[10px]">✓</span>}
                      </button>

                      <div className="border-t border-white/[0.08] my-0.5" />

                      {availableFocusOptions.map((opt) => {
                        const isSelected =
                          focusedCategory?.toLowerCase() === opt.toLowerCase();
                        return (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              playClickSound();
                              setFocus(opt);
                              setIsMissionFocusDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-1.5 hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-between ${
                              isSelected ? "text-[#06B6D4] font-bold" : "text-slate-300"
                            }`}
                          >
                            <span className="truncate">{opt}</span>
                            {isSelected && <span className="text-[10px] text-[#06B6D4]">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="font-mono text-xs text-[#E11D48] font-bold">
                  {missionCompletedTasks}
                </span>
                <span className="font-mono text-xs text-slate-500">/</span>
                <span className="font-mono text-xs text-slate-400 font-semibold">
                  {missionTotalTasks}
                </span>
              </div>
            </div>

            {/* Active Mission Title & Percentage */}
            <div className="space-y-1.5">
              <div className="font-sans text-sm font-semibold text-white truncate">
                {todayMission ? todayMission.text : "Complete Core System Review"}
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex-1 bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-[#E11D48] to-[#F43F5E] h-full rounded-full transition-all duration-500 shadow-[0_0_8px_#E11D48]"
                    style={{ width: `${missionProgressPercentage}%` }}
                  />
                </div>
                <span className="font-mono text-xs font-bold text-slate-300">
                  {missionProgressPercentage}%
                </span>
              </div>
            </div>

            {/* Mission Rail with Step Sequence Numbering */}
            <div className="space-y-2 pt-1 border-t border-white/[0.06] max-h-48 overflow-y-auto pr-1 relative">
              {missionTasks.map((task, idx) => (
                <div
                  key={task.id}
                  onClick={() => handleTaskToggle(task.id, task.completed)}
                  onMouseEnter={playHoverSound}
                  className="flex items-center space-x-2.5 cursor-pointer group"
                >
                  <span className="font-mono text-[9px] text-slate-500 group-hover:text-[#06B6D4] w-4 shrink-0">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  {task.completed ? (
                    <CheckCircle2 size={15} className="text-[#E11D48] shrink-0 drop-shadow-[0_0_6px_rgba(225,29,72,0.8)]" />
                  ) : (
                    <Circle size={15} className="text-slate-500 group-hover:text-white shrink-0 transition-colors" />
                  )}
                  <span
                    className={`text-xs font-sans truncate transition-colors ${
                      task.completed ? "text-slate-400 line-through" : "text-slate-300 group-hover:text-white"
                    }`}
                  >
                    {task.text}
                  </span>
                  {task.category && (
                    <span className="ml-auto text-[8px] font-mono uppercase text-slate-400 border border-white/[0.06] px-1 rounded shrink-0">
                      {task.category}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Panel 2: FOCUS SESSION TIMER (with circular progress indicator) */}
          <div className="alfred-panel p-5 space-y-3 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock size={15} className="text-[#E11D48]" />
                <h3 className="font-header text-sm font-bold tracking-widest text-white uppercase">
                  {codingSessionInfo?.isActive ? "CODING SESSION" : "FOCUS SESSION"}
                </h3>
                {codingSessionInfo?.isActive && (
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-[#06B6D4]/20 border border-[#06B6D4]/40 text-[#06B6D4] font-bold">
                    {codingSessionInfo.state === "paused" ? "PAUSED" : "ACTIVE"}
                  </span>
                )}
              </div>
              
              {/* Duration selector button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDurationDropdownOpen((prev) => !prev)}
                  title="Configure session duration"
                  className="flex items-center space-x-1 text-[11px] font-mono text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-2 py-0.5 rounded cursor-pointer transition-colors"
                >
                  <span>{durationMinutes}m</span>
                  <ChevronDown size={11} className="text-slate-400" />
                </button>

                {/* Duration Config Dropdown */}
                {isDurationDropdownOpen && (
                  <div className="absolute right-0 top-7 w-36 bg-[#0B0E17] border border-white/[0.15] shadow-2xl rounded-lg py-1 z-30 space-y-0.5 text-xs">
                    {[15, 25, 30, 45, 60].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          setDurationMinutes(mins);
                          setIsDurationDropdownOpen(false);
                          setShowCustomInput(false);
                          playClickSound();
                        }}
                        className={`w-full text-left px-3 py-1.5 hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-between ${
                          durationMinutes === mins ? "text-[#E11D48] font-bold" : "text-slate-300"
                        }`}
                      >
                        <span>{mins} minutes</span>
                        {durationMinutes === mins && <span className="text-[10px]">✓</span>}
                      </button>
                    ))}
                    <div className="border-t border-white/[0.08] pt-1">
                      {showCustomInput ? (
                        <form onSubmit={handleCustomDurationSubmit} className="px-2 py-1">
                          <input
                            type="number"
                            min="1"
                            max="180"
                            placeholder="mins (1-180)"
                            value={customDurationInput}
                            onChange={(e) => setCustomDurationInput(e.target.value)}
                            autoFocus
                            className="w-full bg-white/[0.06] border border-white/20 rounded px-2 py-1 text-xs text-white outline-none focus:border-[#E11D48]"
                          />
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowCustomInput(true)}
                          className="w-full text-left px-3 py-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                        >
                          Custom...
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Circular Timer Display */}
            <div className="flex items-center justify-center py-1 relative">
              <div className="relative w-36 h-36 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90">
                  <circle
                    cx="72"
                    cy="72"
                    r="62"
                    stroke="rgba(255, 255, 255, 0.06)"
                    strokeWidth="4"
                    fill="none"
                  />
                  <circle
                    cx="72"
                    cy="72"
                    r="62"
                    stroke="#E11D48"
                    strokeWidth="4"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 62}
                    strokeDashoffset={2 * Math.PI * 62 * (1 - focusProgressPct / 100)}
                    className="transition-all duration-500 drop-shadow-[0_0_6px_#E11D48]"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <div className="font-header text-3xl font-extrabold text-white tracking-tight drop-shadow-[0_0_12px_rgba(225,29,72,0.6)]">
                    {formatTimer(remainingSeconds)}
                  </div>
                  <span className="text-[10px] font-mono text-[#06B6D4] uppercase tracking-wider mt-0.5">
                    {timerState === "running"
                      ? `${focusProgressPct}% COMPLETE`
                      : timerState === "paused"
                      ? "PAUSED"
                      : timerState === "completed"
                      ? "+25M RECORDED"
                      : "Ready when you are."}
                  </span>
                </div>
              </div>
            </div>

            {/* Timer Controls */}
            <div className="flex items-center justify-center space-x-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  if (timerState === "running") {
                    pauseFocus();
                  } else if (timerState === "paused") {
                    resumeFocus();
                  } else {
                    startFocus();
                  }
                }}
                className="w-9 h-9 rounded-full bg-gradient-to-r from-[#E11D48] to-[#BE123C] hover:scale-105 flex items-center justify-center text-white shadow-[0_0_14px_rgba(225,29,72,0.6)] transition-all cursor-pointer"
                title={timerState === "running" ? "Pause" : timerState === "paused" ? "Resume" : "Start"}
              >
                {timerState === "running" ? (
                  <Pause size={14} fill="currentColor" />
                ) : (
                  <Play size={14} fill="currentColor" className="ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  resetFocus();
                }}
                title="Reset session"
                className="w-7 h-7 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-xs text-slate-300 transition-all cursor-pointer"
              >
                <RotateCcw size={12} />
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  addFiveMinutes();
                }}
                title="Add 5 minutes"
                className="w-7 h-7 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-[10px] font-mono text-slate-300 transition-all cursor-pointer"
              >
                +5m
              </button>
            </div>
          </div>
        </div>

        {/* CENTER STAGE: Holographic Pedestal with Flying Red Core Emblem */}
        <div className="lg:col-span-4 xl:col-span-6 flex flex-col items-center justify-center relative min-h-[420px]">
          {/* Subtle concentric orbital aura behind reactor */}
          <div className="absolute w-[360px] h-[360px] rounded-full border border-red-500/20 animate-pulse pointer-events-none" />
          <div className="absolute w-[300px] h-[300px] rounded-full border border-red-500/30 border-dashed pointer-events-none" />

          {/* Central ALFRED Holographic Core 2.0 */}
          <div className="relative z-10 flex flex-col items-center">
            <AlfredCore
              size="lg"
              state={effectiveCoreState}
              interactive={true}
              productivityData={productivitySummary}
              onClick={() => dispatchCommand("Show my workstation directives", false)}
            />
          </div>

          {/* Radial Technological Holographic Pedestal at Base */}
          <div className="w-64 h-12 mt-2 relative flex items-center justify-center pointer-events-none">
            <div className="w-56 h-7 rounded-[100%] bg-gradient-to-r from-transparent via-[#E11D48]/40 to-transparent blur-sm" />
            <div className="w-44 h-2 rounded-[100%] border border-[#E11D48]/70 shadow-[0_0_18px_#E11D48]" />
          </div>

          {/* Interactive Guided Tour / Experience ALFRED Button */}
          <div className="mt-3 relative z-20">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setIsDemoOpen(true);
              }}
              className="group relative flex items-center gap-2.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-950/40 via-white/[0.04] to-rose-950/40 hover:from-cyan-900/60 hover:to-rose-900/60 border border-white/15 hover:border-cyan-400/50 text-xs font-mono font-semibold tracking-wider text-white shadow-lg transition-all duration-200 cursor-pointer"
              title="Launch interactive cinematic demonstration of ALFRED's capabilities"
            >
              <Sparkles size={14} className="text-[#06B6D4] group-hover:scale-110 transition-transform" />
              <span>EXPERIENCE ALFRED</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-mono">
                TOUR
              </span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Productivity Overview & Ambient Mode (3.5 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4 flex flex-col justify-between">
          
          {/* Panel 3: PRODUCTIVITY OVERVIEW (Truthful deterministic metrics + 7-Day Activity Strip) */}
          <div className="alfred-panel p-5 space-y-3.5 border-r-2 border-r-[#E11D48]">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Activity size={16} className="text-[#E11D48]" />
                <h3 className="font-header text-sm font-bold tracking-widest text-white uppercase">
                  PRODUCTIVITY OVERVIEW
                </h3>
              </div>
              <span className="text-[10px] font-mono text-[#06B6D4] border border-[#06B6D4]/30 px-2 py-0.5 rounded">
                LIVE
              </span>
            </div>

            {/* 4 Micro Stat Cards */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <Clock size={13} className="mx-auto text-rose-400 mb-1" />
                <div className="font-header text-sm font-bold text-white">{formattedFocusTime}</div>
                <div className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">Focus</div>
              </div>

              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <CheckCircle2 size={13} className="mx-auto text-emerald-400 mb-1" />
                <div className="font-header text-sm font-bold text-emerald-400">{totalCompletedTasks}</div>
                <div className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">Tasks</div>
              </div>

              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <Target size={13} className="mx-auto text-cyan-400 mb-1" />
                <div className="font-header text-sm font-bold text-white">{completedGoals}/{totalGoals}</div>
                <div className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">Goals</div>
              </div>

              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                <Layers size={13} className="mx-auto text-[#E11D48] mb-1" />
                <div className="font-header text-sm font-bold text-[#E11D48]">{activeProjectsCount}</div>
                <div className="text-[8px] font-mono text-slate-500 uppercase mt-0.5">Projects</div>
              </div>
            </div>

            {/* 7-DAY ACTIVITY STRIP */}
            <div className="pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
                <span>7-DAY ACTIVITY</span>
                <span className="text-[#E11D48] font-bold">{streakData.currentStreak}d Streak</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {streakDays.map((d, i) => (
                  <div key={i} className="flex flex-col items-center space-y-1">
                    <div
                      className={`w-full h-5 rounded-sm transition-all flex items-end justify-center p-0.5 ${
                        d.isActive
                          ? "bg-[#E11D48]/30 border border-[#E11D48]/70"
                          : d.isToday
                          ? "bg-white/[0.06] border border-white/20"
                          : "bg-white/[0.02] border border-white/[0.04]"
                      }`}
                    >
                      <div
                        className={`w-full rounded-sm ${
                          d.isActive ? "bg-[#E11D48] h-3 shadow-[0_0_6px_#E11D48]" : "bg-white/10 h-1"
                        }`}
                      />
                    </div>
                    <span className={`text-[8px] font-mono ${d.isToday ? "text-[#E11D48] font-bold" : "text-slate-500"}`}>
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Panel 4: AMBIENT MODE (Replaces Live Activity Stream) */}
          <AmbientModePanel coreState={effectiveCoreState} />
        </div>
      </div>

      {/* =========================================================================
          COMMAND CAPSULE (Primary Desktop Control Surface)
          ========================================================================= */}
      <div className="relative z-20 max-w-3xl mx-auto space-y-2.5">
        <form
          onSubmit={handleQuickSubmit}
          className="relative flex items-center bg-[#0B0E17]/90 border border-white/[0.12] hover:border-[#E11D48]/60 focus-within:border-[#E11D48] focus-within:shadow-[0_0_24px_rgba(225,29,72,0.3)] rounded-full px-4 py-2 transition-all backdrop-blur-xl"
        >
          {/* Status Indicator */}
          <div className="flex items-center space-x-1.5 mr-2.5 text-[10px] font-mono text-slate-400 shrink-0">
            <span
              className={`w-2 h-2 rounded-full ${
                voiceState === "listening"
                  ? "bg-[#E11D48] animate-ping shadow-[0_0_8px_#E11D48]"
                  : voiceState === "processing" || coreState === "thinking"
                  ? "bg-[#06B6D4] animate-ping"
                  : coreState === "executing"
                  ? "bg-[#E11D48] animate-pulse"
                  : "bg-emerald-400"
              }`}
            />
            <span className="uppercase text-[9px] font-bold text-slate-300">
              {voiceState === "listening"
                ? "LISTENING"
                : voiceState === "processing"
                ? "PROCESSING"
                : coreState === "thinking"
                ? "PROCESSING"
                : coreState === "executing"
                ? "EXECUTING"
                : "READY"}
            </span>
          </div>

          <div className="h-4 w-px bg-white/10 mr-3" />

          {/* Input field */}
          <input
            type="text"
            value={quickPrompt}
            onChange={(e) => setQuickPrompt(e.target.value)}
            placeholder="Ask ALFRED or dispatch directive..."
            className="flex-1 bg-transparent border-none outline-none text-xs md:text-sm font-sans text-white placeholder-slate-500"
          />

          {/* Microphone & Provider Badge & Keybinding */}
          <div className="flex items-center space-x-2 shrink-0 ml-2">
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-1.5 rounded-full transition-all cursor-pointer ${
                voiceState === "listening"
                  ? "bg-[#E11D48] text-white shadow-[0_0_12px_#E11D48] animate-pulse"
                  : voiceState === "error"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/50"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.08]"
              }`}
              title={
                voiceState === "listening"
                  ? "Listening... Click to conclude speech"
                  : voiceState === "error"
                  ? voiceDetail || "Voice error. Click to retry."
                  : "Voice Input [Click to Speak]"
              }
            >
              {voiceState === "error" ? <MicOff size={13} /> : <Mic size={13} />}
            </button>

            <span className="text-[9px] font-mono text-slate-400 border border-white/[0.08] px-1.5 py-0.5 rounded uppercase hidden sm:inline-block">
              {activeProvider.toUpperCase()}
            </span>
            <span className="text-[9px] font-mono text-slate-500 bg-white/[0.04] px-1.5 py-0.5 rounded hidden md:inline-block">
              Ctrl+K
            </span>
            <button
              type="submit"
              disabled={!quickPrompt.trim()}
              className="w-7 h-7 rounded-full bg-gradient-to-r from-[#E11D48] to-[#BE123C] disabled:opacity-30 flex items-center justify-center text-white transition-all cursor-pointer"
            >
              ➤
            </button>
          </div>
        </form>

        {/* ALFRED WORKSPACE DOCK */}
        <div className="alfred-panel p-2.5 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center space-x-2 px-2">
            <Layers size={13} className="text-[#06B6D4]" />
            <span className="text-[10px] font-header font-bold tracking-widest text-slate-300 uppercase">
              WORKSPACE DOCK
            </span>
          </div>

          <div className="flex items-center space-x-2 flex-wrap">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => openLaunchModal(ws)}
                onMouseEnter={playHoverSound}
                className="flex items-center space-x-1.5 px-3 py-1 rounded bg-white/[0.03] hover:bg-[#E11D48]/15 border border-white/[0.08] hover:border-[#E11D48]/50 text-xs font-sans text-slate-300 hover:text-white transition-all cursor-pointer group"
              >
                <span className="text-slate-400 group-hover:text-[#E11D48] transition-colors">
                  {getWorkspaceIcon(ws.type, 13)}
                </span>
                <span className="font-medium">{ws.name}</span>
                <ArrowRight size={10} className="text-slate-500 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =========================================================================
          BOTTOM ROW (4 METRIC & ACTION PANELS)
          1. Study Streak | 2. Next Best Action | 3. Priority Schedule | 4. Motivation Quote
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10 items-stretch">
        
        {/* Panel 1: STUDY STREAK */}
        <div className="alfred-panel p-4 flex flex-col justify-between space-y-3">
          <div className="flex items-center space-x-2">
            <Flame size={16} className="text-[#E11D48]" />
            <h4 className="font-header text-sm font-bold tracking-widest text-white uppercase">
              STUDY STREAK
            </h4>
          </div>

          <div className="text-center py-1">
            <div className="font-header text-3xl font-extrabold text-white tracking-tight">
              {streakData.currentStreak} <span className="text-sm font-sans font-normal text-slate-400">days</span>
            </div>
            
            {/* 7-Day Dot Sequence */}
            <div className="flex items-center justify-center space-x-2 mt-2">
              {streakDays.map((d, i) => (
                <div key={i} className="flex flex-col items-center space-y-1">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      d.isActive
                        ? "bg-[#E11D48] shadow-[0_0_8px_#E11D48]"
                        : "border border-white/20 bg-white/[0.04]"
                    }`}
                  />
                  <span className="text-[9px] font-mono text-slate-500">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400 font-sans">
            <span>Don&apos;t break the chain.</span>
            <span>›</span>
          </div>
        </div>

        {/* Panel 2: NEXT BEST ACTION */}
        <div className="alfred-panel p-4 flex flex-col justify-between space-y-3 border-t-2 border-t-[#E11D48]">
          <div className="flex items-center space-x-2">
            <Crosshair size={16} className="text-[#E11D48]" />
            <h4 className="font-header text-sm font-bold tracking-widest text-white uppercase">
              NEXT BEST ACTION
            </h4>
          </div>

          {nextAction ? (
            <div className="space-y-2">
              <div className="flex items-start space-x-2.5">
                <CheckCircle size={16} className="text-[#E11D48] shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-semibold text-white leading-snug">
                    {nextAction.title}
                  </h5>
                  <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                    {nextAction.reason}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3 text-[10px] font-mono text-slate-400 pl-6">
                <span>⏱ 35 min</span>
                <span className="text-rose-400 font-semibold">ıll High Priority</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-sans">
              Nothing queued. ALFRED is standing by.
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (nextAction?.taskId) {
                handleTaskToggle(nextAction.taskId, false);
              } else {
                dispatchCommand("Start next priority task", true);
              }
            }}
            className="w-full py-2 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#BE123C] hover:scale-[1.02] text-xs font-semibold text-white tracking-wide shadow-[0_4px_16px_rgba(225,29,72,0.4)] transition-all cursor-pointer flex items-center justify-center space-x-1"
          >
            <span>Start Now</span>
            <span>›</span>
          </button>
        </div>

        {/* Panel 3: PRIORITY SCHEDULE (REAL UNCOMPLETED TASKS / GOALS) */}
        <div className="alfred-panel p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock size={16} className="text-[#E11D48]" />
              <h4 className="font-header text-sm font-bold tracking-widest text-white uppercase">
                PRIORITY TIMELINE
              </h4>
            </div>
            <Link href="/tasks" className="text-[10px] font-sans text-slate-400 hover:text-white">
              View All →
            </Link>
          </div>

          {upcomingItems.length > 0 ? (
            <div className="space-y-1.5 text-xs font-sans">
              {upcomingItems.map((slot, i) => (
                <div key={i} className="flex items-center space-x-2 text-slate-300">
                  <span className={`w-1.5 h-1.5 rounded-full ${slot.color}`} />
                  <span className="font-mono text-[10px] text-[#06B6D4] w-8 shrink-0">{slot.priority}</span>
                  <span className="truncate text-slate-200 flex-1">{slot.title}</span>
                  <span className="text-[8px] font-mono text-slate-500 uppercase">{slot.category}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-mono text-slate-500">
              Nothing queued. ALFRED is standing by.
            </div>
          )}
        </div>

        {/* Panel 4: MOTIVATION & INSPIRATION */}
        <div className="alfred-panel p-4 flex flex-col justify-between space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-[#E11D48] text-sm">❝</span>
              <h4 className="font-header text-sm font-bold tracking-widest text-white uppercase">
                MOTIVATION
              </h4>
            </div>
            <button
              type="button"
              onClick={nextMotivation}
              onMouseEnter={playHoverSound}
              title="Load next inspiration principle"
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer text-xs"
            >
              ↻
            </button>
          </div>

          <div className="text-center my-auto py-2">
            <blockquote className="font-sans text-xs italic text-slate-200 leading-relaxed max-w-[210px] mx-auto min-h-[48px] flex items-center justify-center">
              &quot;{MOTIVATIONS[motivationIndex].quote}&quot;
            </blockquote>
            <p className="font-mono text-[10px] text-[#E11D48] uppercase tracking-widest mt-2 font-bold">
              — {MOTIVATIONS[motivationIndex].author}
            </p>
          </div>

          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 border-t border-white/[0.06]">
            <span>{MOTIVATIONS[motivationIndex].subtitle}</span>
            <button
              type="button"
              onClick={nextMotivation}
              className="text-[#E11D48] hover:underline cursor-pointer"
            >
              NEXT ›
            </button>
          </div>
        </div>
      </div>

      {/* Workspace Deployment Modal */}
      <AnimatePresence>
        {isLaunchModalOpen && activeWorkspace && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-[9999]"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0B0E17] border border-white/[0.15] shadow-2xl rounded-lg w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-[#E11D48] shadow-[0_0_6px_#E11D48]" />
                  <h2 className="font-header text-sm font-bold text-white tracking-wider uppercase">
                    DEPLOY: {activeWorkspace.name}
                  </h2>
                </div>
                <button
                  onClick={() => setIsLaunchModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-3.5 font-mono text-xs">
                {activeWorkspace.applications.length > 0 && (
                  <div>
                    <h4 className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                      Applications:
                    </h4>
                    <div className="space-y-1">
                      {activeWorkspace.applications.map((app, i) => (
                        <div key={i} className="flex items-center text-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] mr-2" />
                          <span>{app}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeWorkspace.websites.length > 0 && (
                  <div>
                    <h4 className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                      Web Endpoints:
                    </h4>
                    <div className="space-y-1">
                      {activeWorkspace.websites.map((url, i) => (
                        <div key={i} className="flex items-center text-slate-300 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] mr-2 shrink-0" />
                          <span className="truncate">{url}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeWorkspace.localFolders.length > 0 && (
                  <div>
                    <h4 className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                      Directories:
                    </h4>
                    <div className="space-y-1">
                      {activeWorkspace.localFolders.map((f, i) => (
                        <div key={i} className="flex items-center text-slate-300 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-2 shrink-0" />
                          <span className="truncate">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {launchMessage && (
                  <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold animate-pulse">
                    {launchMessage}
                  </div>
                )}
              </div>

              <div className="p-3.5 border-t border-white/[0.08] flex space-x-2.5 bg-black/40">
                <button
                  type="button"
                  onClick={() => setIsLaunchModalOpen(false)}
                  className="flex-1 alfred-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeLaunch}
                  className="flex-1 alfred-btn-primary"
                >
                  <Play size={12} fill="currentColor" />
                  <span>Launch</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive Cinematic Product Demonstration */}
      <DemoExperience
        isOpen={isDemoOpen}
        onClose={() => setIsDemoOpen(false)}
        onStartUsing={() => dispatchCommand("Show my workstation directives", false)}
      />
    </div>
  );
}
