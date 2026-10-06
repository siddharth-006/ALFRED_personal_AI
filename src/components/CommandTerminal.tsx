"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  CornerDownLeft,
  Cpu,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  Radio,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  playScanSound,
  playClickSound,
  playSuccessSound,
  AlfredAudioService,
} from "@/utils/audioSystem";
import { useWorkspaces } from "@/context/WorkspaceContext";
import { useTasks } from "@/context/TaskContext";
import AlfredCore, { CoreState } from "./AlfredCore";
import AlfredEmblem from "./AlfredEmblem";
import { VoiceInputService, VoiceState } from "@/utils/voiceInputService";
import { WakeWordService, WakeWordStatusState } from "@/utils/wakeWordService";
import { TtsClientService, TtsStatusState } from "@/utils/ttsService";
import { formatSpokenResponse } from "@/utils/responseSpeechFormatter";
import type { AgentToolCallResult } from "../../electron/agent/orchestrator/types";

interface PendingConfirmationState {
  id: string;
  risk?: {
    mutationCount?: number;
    affectedEntities?: Array<{ type: string; name?: string }>;
    summary?: string;
  };
  plan?: {
    toolCalls?: Array<{ tool: string; arguments?: Record<string, unknown> }>;
    explanation?: string;
  };
  agenticPlan?: {
    id: string;
    objective: string;
    explanation: string;
    previewSummary: string;
    steps: Array<{
      id: string;
      index: number;
      description: string;
      actionType: string;
      tool: string;
    }>;
  };
  memoryProposal?: {
    type: "create" | "update" | "delete" | "delete_all";
    memory: {
      category: string;
      content: string;
    };
    promptPreview: string;
    spokenPrompt: string;
  };
  summary?: string;
}

interface ActivityItem {
  id: string;
  timestamp: string;
  command: string;
  outcome: string;
  status: "success" | "info" | "warning" | "error";
  intent?: string;
}

interface StepDisplay {
  index: number;
  label: string;
  detail?: string;
  status: "completed" | "executing" | "queued" | "failed";
}

export default function CommandTerminal() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [coreState, setCoreState] = useState<CoreState>("idle");
  const [activeIntent, setActiveIntent] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<string | null>(null);

  // Execution & Answer visualization state
  const [answerResult, setAnswerResult] = useState<{
    text: string;
    provider?: string;
    recommendations?: Array<{
      id: string;
      title: string;
      rationale: string;
      category: string;
      suggestedAction?: string;
    }>;
  } | null>(null);
  const [executionTimeline, setExecutionTimeline] = useState<StepDisplay[] | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmationState | null>(null);

  // Tactical Command Progression Flow (Input -> Understanding -> Plan -> Confirmation -> Execution -> Result)
  const [commandStage, setCommandStage] = useState<
    "idle" | "input" | "understanding" | "plan" | "confirmation" | "execution" | "result"
  >("idle");

  // Raw logs and recent session activities
  const [logs, setLogs] = useState<string[]>([
    "ALFRED WORKSTATION OS // COMMAND CENTER ONLINE",
    "Enter natural commands (e.g. 'Open VS Code', 'Start my DSA workspace', 'Which workspaces do I have?').",
  ]);
  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: "act-init-1",
      timestamp: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
      command: "System Initialized",
      outcome: "All workstation services online",
      status: "info",
    },
  ]);
  const [showRawLogs, setShowRawLogs] = useState(false);

  // System telemetry readouts
  const [activeProvider, setActiveProvider] = useState<string>("MOCK");
  const [telemetry, setTelemetry] = useState<{
    platform: string;
    arch: string;
    cpus: number;
    totalMem: number;
    freeMem: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { workspaces, launchWorkspace, setFocus } = useWorkspaces();
  const { tasks } = useTasks();

  // Voice Input Foundation State
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceDetail, setVoiceDetail] = useState<string>("");
  const [wakeWordState, setWakeWordState] = useState<WakeWordStatusState>("disabled");
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [ttsState, setTtsState] = useState<TtsStatusState>("ready");
  const [ttsEnabled, setTtsEnabled] = useState(true);

  const processCommandRef = useRef<(cmd: string) => Promise<void>>(async () => {});

  // Load telemetry and active provider status
  const refreshSystemMetadata = useCallback(async () => {
    if (typeof window !== "undefined") {
      if (window.electron?.aiProvider) {
        try {
          const provider = await window.electron.aiProvider.getActive();
          setActiveProvider(provider.toUpperCase());
        } catch {
          // ignore
        }
      }
      if (window.electron?.system?.getInfo) {
        try {
          const info = await window.electron.system.getInfo();
          setTelemetry({
            platform: info.platform,
            arch: info.arch,
            cpus: info.cpus,
            totalMem: info.totalMemoryMB,
            freeMem: info.freeMemoryMB,
          });
        } catch {
          // ignore
        }
      }
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => {
          const next = !prev;
          if (next) {
            playScanSound();
            refreshSystemMetadata();
            setTimeout(() => inputRef.current?.focus(), 120);
          }
          return next;
        });
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    const handleOpenEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        mode?: string;
        initialCommand?: string;
        autoExecute?: boolean;
      }>;
      setIsOpen(true);
      playScanSound();
      refreshSystemMetadata();
      if (customEvent.detail?.mode === "assistant") {
        setLogs((prev) => [
          ...prev,
          "ALFRED: AI Assistant Mode ready. Ask any question or request workflow assistance.",
        ]);
      }
      if (customEvent.detail?.initialCommand) {
        const cmdToSet = customEvent.detail.initialCommand;
        setInput(cmdToSet);
        if (customEvent.detail.autoExecute) {
          setTimeout(() => {
            processCommandRef.current(cmdToSet);
            setInput("");
          }, 180);
        }
      }
      setTimeout(() => inputRef.current?.focus(), 120);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-terminal", handleOpenEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-terminal", handleOpenEvent);
    };
  }, [isOpen, refreshSystemMetadata]);

  // Subscribe to VoiceInputService events
  useEffect(() => {
    const unsubState = VoiceInputService.subscribeState((vState, detail) => {
      setVoiceState(vState);
      if (detail) setVoiceDetail(detail);

      // Synchronize Core presence with voice state without triggering 'executing'
      if (vState === "listening") {
        setCoreState("listening");
        setActiveIntent("Voice Directive Capture");
      } else if (vState === "processing") {
        setCoreState("thinking");
        setActiveIntent("Transcribing Speech...");
      } else if (vState === "idle" && coreState === "listening") {
        if (WakeWordService.isListening()) {
          setCoreState("wake_monitoring");
          setActiveIntent(`Listening for "${WakeWordService.getWakePhrase()}"`);
        } else {
          setCoreState("idle");
        }
      }
    });

    const unsubTranscript = VoiceInputService.subscribeTranscript((transcript) => {
      if (transcript) {
        setInput(transcript);
        inputRef.current?.focus();
      }
    });

    return () => {
      unsubState();
      unsubTranscript();
    };
  }, [coreState]);

  // Subscribe to WakeWordService events
  useEffect(() => {
    setWakeWordEnabled(WakeWordService.isFeatureEnabled());
    const unsubWakeState = WakeWordService.subscribeStatus((wState) => {
      setWakeWordState(wState);
      setWakeWordEnabled(WakeWordService.isFeatureEnabled());

      if (wState === "listening") {
        if (VoiceInputService.getState() === "idle") {
          setCoreState("wake_monitoring");
          setActiveIntent(`Listening for "${WakeWordService.getWakePhrase()}"`);
        }
      } else if (wState === "wake_detected") {
        setCoreState("wake_detected");
        setActiveIntent("Wake Word Detected // Opening Microphone");
        setIsOpen(true);
      } else if (wState === "disabled" || wState === "ready") {
        if (coreState === "wake_monitoring" || coreState === "wake_detected") {
          setCoreState("idle");
          setActiveIntent(null);
        }
      }
    });

    return () => {
      unsubWakeState();
    };
  }, [coreState]);

  // Subscribe to TtsClientService events
  useEffect(() => {
    setTtsEnabled(TtsClientService.isFeatureEnabled());
    const unsub = TtsClientService.subscribeStatus((state) => {
      setTtsState(state);
      setTtsEnabled(TtsClientService.isFeatureEnabled());
      if (state === "speaking") {
        setCoreState("speaking");
      } else if (state === "ready" && coreState === "speaking") {
        setCoreState("idle");
      }
    });
    return unsub;
  }, [coreState]);

  // Subscribe to Global Desktop Hotkey Summon from Electron
  useEffect(() => {
    if (typeof window !== "undefined" && window.electron?.hotkey?.onSummon) {
      const unsub = window.electron.hotkey.onSummon(() => {
        setIsOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      });
      return () => unsub();
    }
  }, []);

  const handleToggleWakeWord = async () => {
    playClickSound();
    const willEnable = !WakeWordService.isFeatureEnabled();
    setWakeWordEnabled(willEnable);
    await WakeWordService.setEnabled(willEnable);
  };

  const handleToggleTts = async () => {
    playClickSound();
    const willEnable = !TtsClientService.isFeatureEnabled();
    setTtsEnabled(willEnable);
    await TtsClientService.setEnabled(willEnable);
  };

  const handleToggleVoice = async () => {
    playClickSound();
    if (VoiceInputService.isListening()) {
      await VoiceInputService.stopListening();
    } else {
      try {
        await VoiceInputService.startListening();
      } catch {
        // error state is automatically displayed
      }
    }
  };

  // Record an action into session activity log
  const recordActivity = (
    command: string,
    outcome: string,
    status: "success" | "info" | "warning" | "error",
    intent?: string
  ) => {
    const now = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });
    setActivities((prev) => [
      {
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        timestamp: now,
        command,
        outcome,
        status,
        intent,
      },
      ...prev.slice(0, 14),
    ]);
  };

  // Convert raw tool execution steps into visual timeline items
  const formatStepsTimeline = (
    steps: AgentToolCallResult[] | undefined,
    fallbackTool?: string,
    fallbackAppName?: string | null
  ): StepDisplay[] => {
    if (steps && steps.length > 0) {
      return steps.map((s, idx) => {
        let label = s.tool.replace(/_/g, " ").toUpperCase();
        const detail = s.summary;

        if (s.tool === "launch_application") {
          label = `LAUNCH APPLICATION (${(s.arguments?.appName as string) || (s.arguments?.application as string) || "App"})`;
        } else if (s.tool === "launch_workspace") {
          label = `LAUNCH WORKSPACE (${(s.arguments?.workspaceId as string) || (s.arguments?.name as string) || "Workspace"})`;
        } else if (s.tool === "create_task") {
          label = `CREATE TASK DIRECTIVE (${(s.arguments?.taskText as string) || "Task"})`;
        } else if (s.tool === "create_goal") {
          label = `INITIALIZE GOAL (${(s.arguments?.title as string) || "Goal"})`;
        } else if (s.tool === "update_project") {
          label = `UPDATE PROJECT (${(s.arguments?.projectName as string) || "Project"})`;
        }

        return {
          index: idx + 1,
          label,
          detail,
          status: s.success ? "completed" : "failed",
        };
      });
    }

    return [
      {
        index: 1,
        label: "VALIDATE DIRECTIVE & RISK EVALUATION",
        detail: "Security check passed — Low tactical risk",
        status: "completed",
      },
      {
        index: 2,
        label: fallbackTool ? fallbackTool.replace(/_/g, " ").toUpperCase() : "EXECUTE ACTION",
        detail: fallbackAppName ? `Target: ${fallbackAppName}` : undefined,
        status: "completed",
      },
    ];
  };

  const handleExecutionResult = async (result: any, rawPrompt: string) => {
    if (!result) return;

    // Trigger local spoken voice response safely via local TTS
    try {
      const speech = formatSpokenResponse(result, rawPrompt);
      if (speech) {
        TtsClientService.speak(speech).catch(() => {});
      }
    } catch {}

    if (result.cancelled) {
      setCoreState("idle");
      setActiveIntent("cancelled");
      setLogs((prev) => [
        ...prev,
        `ALFRED: ${result.explanation || "Action execution cancelled by user."}`,
      ]);
      recordActivity(rawPrompt, "Execution cancelled by operator", "warning", "cancelled");
      return;
    }

    // AI Answer / Recommendation / Morning Briefing Mode response
    if (
      result.answerText ||
      result.responseType === "answer" ||
      result.intent === "answer" ||
      result.intent === "recommendation" ||
      result.intent === "briefing" ||
      result.intent === "review" ||
      result.briefing ||
      result.review ||
      result.recommendations
    ) {
      setCoreState("success");
      playSuccessSound();
      const text =
        result.answerText ||
        result.explanation ||
        (result.intent === "briefing"
          ? "Morning briefing compiled."
          : result.intent === "review"
          ? "End-of-day review compiled."
          : result.intent === "recommendation"
          ? "Tactical recommendations formulated based on current workstation state."
          : "Informational answer provided.");
      const provider = result.providerId || activeProvider;
      setAnswerResult({
        text,
        provider,
        recommendations: result.recommendations,
      });
      setExecutionTimeline(null);

      const providerTag = provider ? `ALFRED (${provider.toUpperCase()})` : "ALFRED";
      setLogs((prev) => [...prev, `${providerTag}: ${text}`]);
      recordActivity(
        rawPrompt,
        result.intent === "briefing"
          ? "Morning briefing generated"
          : result.intent === "review"
          ? "End-of-day review generated"
          : result.intent === "recommendation"
          ? "Tactical recommendations formulated"
          : "Answer generated via local intelligence",
        "info",
        result.intent || "answer"
      );

      setTimeout(() => setCoreState("idle"), 4000);
      return;
    }

    setAnswerResult(null);

    // Multi-step summary or general explanation display
    if (result.explanation && (result.steps?.length > 1 || result.totalSteps > 1)) {
      const lines = result.explanation.split("\n");
      setLogs((prev) => [...prev, ...lines.map((l: string) => `ALFRED: ${l}`)]);
    }

    // Timeline construction
    const timeline = formatStepsTimeline(result.steps, result.intent, result.appName);
    setExecutionTimeline(timeline);

    // Handle standard actions
    if (result.intent === "launch_application") {
      if (result.success && result.appName) {
        setCoreState("success");
        playSuccessSound();
        setLogs((prev) => [
          ...prev,
          `ALFRED: Command recognized. Launching ${result.appName}...`,
        ]);
        recordActivity(rawPrompt, `Launched ${result.appName}`, "success", "launch_application");
      } else {
        setCoreState("error");
        const failureMsg =
          result.error ||
          `I understood the command, but ${result.appName || "application"} could not be launched.`;
        setLogs((prev) => [...prev, `ALFRED: ${failureMsg}`]);
        recordActivity(rawPrompt, `Failed to launch ${result.appName || "application"}`, "error");
      }
      setTimeout(() => setCoreState("idle"), 3500);
      return;
    }

    if (result.intent === "navigate") {
      setCoreState("success");
      playSuccessSound();
      const navTarget = result.appName?.toLowerCase();
      let destination = "/";
      let destName = "Dashboard";

      if (navTarget === "missions" || navTarget === "tasks") {
        destination = "/tasks";
        destName = "Tasks";
      } else if (navTarget === "goals") {
        destination = "/goals";
        destName = "Goals";
      } else if (navTarget === "projects") {
        destination = "/projects";
        destName = "Projects";
      } else if (navTarget === "workspaces") {
        destination = "/workspaces";
        destName = "Workspaces";
      }

      router.push(destination);
      setLogs((prev) => [...prev, `ALFRED: Navigating to ${destName}...`]);
      recordActivity(rawPrompt, `Navigated to ${destName}`, "success", "navigate");
      setTimeout(() => {
        setCoreState("idle");
        setIsOpen(false);
      }, 900);
      return;
    }

    if (result.intent === "system_status") {
      setCoreState("success");
      playSuccessSound();
      if (typeof window !== "undefined" && window.electron?.system?.getInfo) {
        const info = await window.electron.system.getInfo();
        setLogs((prev) => [
          ...prev,
          "ALFRED SYSTEM STATUS REPORT:",
          `• Platform: ${info.platform} (${info.arch})`,
          `• CPUs: ${info.cpus} cores`,
          `• Memory: ${info.freeMemoryMB} MB free / ${info.totalMemoryMB} MB total`,
          "• Status: ALL SYSTEMS NOMINAL",
        ]);
      } else {
        setLogs((prev) => [
          ...prev,
          "AI CORE: ONLINE",
          "MEMORY: NOMINAL",
          "NETWORK: SECURE",
          "VITALS: 100%",
        ]);
      }
      recordActivity(rawPrompt, "System status report dispatched", "info", "system_status");
      setTimeout(() => setCoreState("idle"), 3500);
      return;
    }

    if (result.intent === "start_deep_work") {
      setCoreState("success");
      playSuccessSound();
      setFocus("dsa");
      setLogs((prev) => [
        ...prev,
        "ALFRED: Deep Work session initiated. Focus mode engaged.",
      ]);
      recordActivity(rawPrompt, "Deep Work mode initialized", "success", "start_deep_work");
      setTimeout(() => setCoreState("idle"), 3500);
      return;
    }

    if (result.intent === "launch_workspace" && result.appName) {
      const targetName = result.appName.toLowerCase();
      const ws = workspaces.find(
        (w) =>
          w.name.toLowerCase().includes(targetName) ||
          w.type.toLowerCase() === targetName
      );

      if (ws) {
        setCoreState("success");
        playSuccessSound();
        setLogs((prev) => [...prev, `ALFRED: Launching workspace: ${ws.name}...`]);
        launchWorkspace(ws.id);
        if (window.electron?.workspace) {
          await window.electron.workspace.launch(ws);
        } else {
          ws.websites.forEach((url) => window.open(url, "_blank"));
        }
        recordActivity(rawPrompt, `Launched workspace '${ws.name}'`, "success", "launch_workspace");
        setTimeout(() => {
          setCoreState("idle");
          setIsOpen(false);
        }, 1200);
      } else {
        setCoreState("error");
        setLogs((prev) => [...prev, `ALFRED: Workspace '${result.appName}' not found.`]);
        recordActivity(rawPrompt, `Workspace '${result.appName}' not found`, "error");
        setTimeout(() => setCoreState("idle"), 3500);
      }
      return;
    }

    if (result.intent === "show_tasks") {
      setCoreState("success");
      playSuccessSound();
      const pendingCount = tasks.filter((t) => !t.completed).length;
      setLogs((prev) => [
        ...prev,
        `ALFRED: You have ${pendingCount} active task(s). Navigating to Tasks...`,
      ]);
      recordActivity(rawPrompt, `Retrieved ${pendingCount} active tasks`, "info", "show_tasks");
      router.push("/tasks");
      setTimeout(() => {
        setCoreState("idle");
        setIsOpen(false);
      }, 1000);
      return;
    }

    if (result.intent === "create_task") {
      setCoreState("success");
      playSuccessSound();
      const taskObj = (result.task as any) || (result.data as any)?.task;
      const taskName = taskObj?.text || result.appName || "New task";
      const category = taskObj?.category ? ` [${taskObj.category}]` : "";
      setLogs((prev) => [
        ...prev,
        `ALFRED: Task created -> "${taskName}"${category}. Mission list updated.`,
      ]);
      recordActivity(rawPrompt, `Created task "${taskName}"`, "success", "create_task");
      setTimeout(() => setCoreState("idle"), 3500);
      return;
    }

    if (result.intent === "complete_task") {
      setCoreState("success");
      playSuccessSound();
      const taskObj = (result.task as any) || (result.data as any)?.task;
      const taskName = taskObj?.text || (result.appName ? `ID: ${result.appName}` : "Task");
      setLogs((prev) => [
        ...prev,
        `ALFRED: Mission completed -> "${taskName}". Protocol updated.`,
      ]);
      recordActivity(rawPrompt, `Completed task "${taskName}"`, "success", "complete_task");
      setTimeout(() => setCoreState("idle"), 3500);
      return;
    }

    if (result.intent === "create_goal") {
      setCoreState("success");
      playSuccessSound();
      const goalObj = (result.goal as any) || (result.data as any)?.goal;
      const goalTitle = goalObj?.title || result.appName || "New goal";
      const target = goalObj?.target ? ` (Target: ${goalObj.target})` : "";
      setLogs((prev) => [
        ...prev,
        `ALFRED: Goal initialized -> "${goalTitle}"${target}. Goals updated.`,
      ]);
      recordActivity(rawPrompt, `Initialized goal "${goalTitle}"`, "success", "create_goal");
      setTimeout(() => setCoreState("idle"), 3500);
      return;
    }

    if (result.intent === "update_goal") {
      setCoreState("success");
      playSuccessSound();
      const goalObj = (result.goal as any) || (result.data as any)?.goal;
      const goalTitle = goalObj?.title || (result.appName ? `ID: ${result.appName}` : "Goal");
      const status = goalObj?.completed
        ? "Completed"
        : `Progress: ${goalObj?.current ?? "?"}/${goalObj?.target ?? "?"}`;
      setLogs((prev) => [
        ...prev,
        `ALFRED: Goal updated -> "${goalTitle}" [${status}].`,
      ]);
      recordActivity(rawPrompt, `Updated goal "${goalTitle}"`, "success", "update_goal");
      setTimeout(() => setCoreState("idle"), 3500);
      return;
    }

    if (result.intent === "update_project") {
      setCoreState("success");
      playSuccessSound();
      const projObj = (result.project as any) || (result.data as any)?.project;
      const projName = projObj?.name || (result.appName ? `ID: ${result.appName}` : "Project");
      const progress =
        projObj?.progress !== undefined
          ? ` [${projObj.progress}% - ${projObj.status}]`
          : "";
      setLogs((prev) => [
        ...prev,
        `ALFRED: Project updated -> "${projName}"${progress}.`,
      ]);
      recordActivity(rawPrompt, `Updated project "${projName}"`, "success", "update_project");
      setTimeout(() => setCoreState("idle"), 3500);
      return;
    }

    if (result.error && !result.success) {
      setCoreState("error");
      setLogs((prev) => [...prev, `ALFRED: ${result.explanation || result.error}`]);
      recordActivity(rawPrompt, result.explanation || result.error, "error");
      setTimeout(() => setCoreState("idle"), 3500);
      return;
    }

    setCoreState("success");
    playSuccessSound();
    setCommandStage("result");
    setTimeout(() => {
      setCoreState("idle");
      setCommandStage("idle");
    }, 4000);
  };

  const handleConfirm = async () => {
    if (!pendingConfirmation || !window.electron?.commandAgent?.confirm) return;
    const id = pendingConfirmation.id;
    setPendingConfirmation(null);
    setCoreState("executing");
    setCommandStage("execution");
    playClickSound();
    setLogs((prev) => [...prev, "> [CONFIRM EXECUTION]"]);
    try {
      const result = await window.electron.commandAgent.confirm(id);
      await handleExecutionResult(result, "Confirmed Execution");
    } catch (err: unknown) {
      setCoreState("error");
      const msg = err instanceof Error ? err.message : String(err);
      setLogs((prev) => [...prev, `ALFRED: Confirmation error: ${msg}`]);
    }
  };

  const handleCancel = async () => {
    if (!pendingConfirmation || !window.electron?.commandAgent?.cancel) return;
    const id = pendingConfirmation.id;
    setPendingConfirmation(null);
    setCoreState("idle");
    setCommandStage("result");
    playClickSound();
    setLogs((prev) => [...prev, "> [ABORT EXECUTION]"]);
    try {
      const result = await window.electron.commandAgent.cancel(id);
      setLogs((prev) => [
        ...prev,
        `ALFRED: ${result.explanation || "Action execution cancelled by user."}`,
      ]);
      recordActivity("Aborted Execution", "Action cancelled by operator", "warning");
      TtsClientService.speak("Action cancelled.").catch(() => {});
      setTimeout(() => setCommandStage("idle"), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogs((prev) => [...prev, `ALFRED: Cancellation error: ${msg}`]);
    }
  };

  const processCommand = async (rawInput: string) => {
    const cmd = rawInput.toLowerCase();
    setActiveTarget(rawInput);
    setCommandStage("input");
    AlfredAudioService.play("command");

    if (pendingConfirmation) {
      if (cmd === "confirm" || cmd === "yes" || cmd === "y" || cmd === "execute") {
        await handleConfirm();
        return;
      }
      if (cmd === "cancel" || cmd === "no" || cmd === "n" || cmd === "abort") {
        await handleCancel();
        return;
      }
    }

    setCoreState("thinking");
    setCommandStage("understanding");
    if (typeof window !== "undefined") {
      import("@/utils/activityBus").then(({ dispatchAlfredActivity }) => {
        dispatchAlfredActivity({
          type: "ai_thinking",
          state: "thinking",
          label: "ANALYZING COMMAND",
          detail: rawInput,
        });
      });
    }

    // 1. Command Agent Execution & Intent Resolution Bridge
    if (typeof window !== "undefined" && window.electron?.commandAgent) {
      try {
        let focusSnapshot: any = undefined;
        try {
          const rawFocus = localStorage.getItem("alfred_focus_stats_v1");
          if (rawFocus) {
            const parsedFocus = JSON.parse(rawFocus);
            focusSnapshot = {
              todayFocusMinutes: parsedFocus.todayFocusMinutes || 0,
              totalFocusMinutes: parsedFocus.totalFocusMinutes || 0,
              completedSessionsCount: parsedFocus.completedSessionsCount || 0,
            };
          }
        } catch {}

        let streakSnapshot: any = undefined;
        try {
          const rawStreak = localStorage.getItem("alfred_streak");
          if (rawStreak) {
            streakSnapshot = JSON.parse(rawStreak);
          }
        } catch {}

        let activitySnapshot: any = undefined;
        try {
          const rawAct = localStorage.getItem("alfred_activity_history_v1");
          if (rawAct) {
            activitySnapshot = JSON.parse(rawAct).slice(0, 10);
          }
        } catch {}

        const result = await window.electron.commandAgent.execute(rawInput, {
          context: {
            focus: focusSnapshot,
            streak: streakSnapshot,
            activity: activitySnapshot,
          },
        });

        if (result.intent) {
          setActiveIntent(result.intent);
        }

        // Confirmation Gate handling
        if (result.requiresConfirmation && result.confirmationId) {
          setCoreState("waiting_for_confirmation");
          setCommandStage(result.agenticPlan ? "plan" : "confirmation");
          if (typeof window !== "undefined") {
            import("@/utils/activityBus").then(({ dispatchAlfredActivity }) => {
              dispatchAlfredActivity({
                type: "confirmation_requested",
                state: "waiting_for_confirmation",
                label: "CONFIRMATION REQUIRED",
                detail: result.explanation || "Authorization required",
              });
            });
          }
          setPendingConfirmation({
            id: result.confirmationId,
            risk: result.risk,
            plan: result.plan,
            agenticPlan: result.agenticPlan,
            memoryProposal: result.memoryProposal,
            summary: result.explanation,
          });
          setLogs((prev) => [
            ...prev,
            result.memoryProposal
              ? `ALFRED: Memory proposal awaiting operator confirmation (${result.memoryProposal.type.toUpperCase()}).`
              : result.agenticPlan
              ? `ALFRED: Execution plan proposed (${result.agenticPlan.steps.length} steps). Awaiting operator authorization.`
              : "ALFRED: Action requires user authorization before execution.",
          ]);
          recordActivity(rawInput, "Confirmation required for execution", "warning");
          // Prompt user via TTS that confirmation is required before proceeding
          const spoken = formatSpokenResponse(result);
          if (spoken) {
            TtsClientService.speak(spoken).catch(() => {});
          }
          return;
        }

        setCoreState("executing");
        setCommandStage("execution");
        if (typeof window !== "undefined") {
          import("@/utils/activityBus").then(({ dispatchAlfredActivity }) => {
            dispatchAlfredActivity({
              type: "tool_executing",
              state: "executing",
              label: "EXECUTING ACTION",
              detail: result.intent || rawInput,
            });
          });
        }
        await handleExecutionResult(result, rawInput);
        setCommandStage("result");
        setTimeout(() => setCommandStage("idle"), 5000);
        return;
      } catch (err: unknown) {
        console.error("Command Agent IPC Error:", err);
        setCoreState("error");
      }
    }

    // 2. Static Terminal Commands & Browser Fallback
    if (cmd === "help") {
      setCoreState("success");
      setAnswerResult({
        text: "Available Directives:\n• Workspaces: 'start my dsa workspace', 'launch ml workspace'\n• Applications: 'open VS Code', 'launch Chrome', 'start Spotify'\n• Navigation: 'open missions', 'show goals', 'go to projects'\n• Tasks: 'create a task called study CNNs', 'mark task completed'\n• Queries: 'which workspaces do I have?', 'what should I work on now?'",
        provider: "SYSTEM MANUAL",
      });
      setLogs((prev) => [
        ...prev,
        "Available commands: workspaces, applications, tasks, navigation, queries.",
      ]);
      TtsClientService.speak("Displaying available workstation directives.").catch(() => {});
    } else if (cmd === "clear") {
      setLogs([]);
      setAnswerResult(null);
      setExecutionTimeline(null);
      setCoreState("idle");
      TtsClientService.stop().catch(() => {});
    } else if (cmd === "exit") {
      setIsOpen(false);
      TtsClientService.stop().catch(() => {});
    } else if (cmd === "settings" || cmd === "preferences") {
      setCoreState("success");
      setIsOpen(false);
      window.dispatchEvent(new CustomEvent("open-settings-modal"));
    } else if (cmd === "setup" || cmd === "onboarding" || cmd === "wizard") {
      setCoreState("success");
      setIsOpen(false);
      window.dispatchEvent(new CustomEvent("open-onboarding-modal"));
    } else {
      setCoreState("error");
      setLogs((prev) => [...prev, `Command not recognized: ${rawInput}`]);
      recordActivity(rawInput, "Command not recognized", "error");
      TtsClientService.speak("Command not recognized.").catch(() => {});
      setTimeout(() => setCoreState("idle"), 3000);
    }
  };

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const rawInput = input.trim();
    setLogs((prev) => [...prev, `> ${rawInput}`]);
    playClickSound();

    const currentPrompt = rawInput;
    setInput("");

    setTimeout(() => {
      processCommand(currentPrompt);
    }, 200);
  };

  const executeQuickCommand = (prompt: string) => {
    playClickSound();
    setLogs((prev) => [...prev, `> ${prompt}`]);
    processCommand(prompt);
  };

  processCommandRef.current = processCommand;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed inset-0 z-[9000] flex flex-col bg-[#05070B]/95 backdrop-blur-2xl overflow-y-auto selection:bg-[#E11D48]/30"
        >
          {/* Top HUD Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-black/40 shrink-0">
            <div className="flex items-center space-x-3">
              <AlfredEmblem size={24} pulsing={coreState === "thinking" || coreState === "executing"} />
              <div>
                <div className="font-header text-sm font-bold text-white tracking-wide flex items-center space-x-2">
                  <span>Command Console</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono">
                    v2.5
                  </span>
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  TACTICAL DIRECTIVES & AI PROCESSING
                </div>
              </div>
            </div>

            {/* Provider and Controls */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 px-3 py-1 rounded-sm bg-white/[0.03] border border-white/[0.08]">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
                <span className="font-mono text-xs text-white/80 font-semibold tracking-wider">
                  {activeProvider}
                </span>
                <span className="text-[9px] font-mono text-white/40">ONLINE</span>
              </div>

              <div className="flex items-center space-x-2">
                <kbd className="hidden sm:inline-block px-2 py-0.5 rounded-sm bg-black/60 border border-white/10 text-[10px] font-mono text-white/40">
                  ESC TO DISMISS
                </kbd>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-sm text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  title="Close Command Center"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Main Visual Centerpiece Area */}
          <div className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 md:py-8 flex flex-col items-center justify-start space-y-6">
            {/* ALFRED Core Display */}
            <AlfredCore
              state={coreState}
              intent={activeIntent}
              target={activeTarget}
              className="my-2"
            />

            {/* Dynamic Status Directive Subtitle */}
            <div className="text-center max-w-lg">
              <p className="text-sm font-mono text-white/70 tracking-wide">
                {coreState === "thinking"
                  ? "ANALYZING DIRECTIVE // Synthesizing plan graph..."
                  : coreState === "executing"
                  ? "EXECUTING // Runtime orchestrating actions..."
                  : coreState === "waiting_for_confirmation"
                  ? "CONFIRMATION GATE // Review proposed mutations below."
                  : coreState === "success"
                  ? "DIRECTIVE COMPLETE // Ready for next instruction."
                  : coreState === "error"
                  ? "EXCEPTION ENCOUNTERED // Review diagnostics below."
                  : "What directive can I execute for you, Commander?"}
              </p>
            </div>

            {/* Primary Command Input Bar */}
            <div className="w-full max-w-3xl">
              <form
                onSubmit={handleCommand}
                className="relative flex items-center bg-[#090C14] border border-white/[0.14] focus-within:border-[#E11D48]/70 focus-within:shadow-[0_0_20px_rgba(225,29,72,0.25)] rounded-sm p-2 px-4 transition-all duration-200"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-[#E11D48] mr-3 animate-pulse shadow-[0_0_8px_#E11D48]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask ALFRED anything or issue a directive (e.g. 'Start DSA workspace', 'Open VS Code')..."
                  className="flex-1 bg-transparent border-none outline-none text-sm md:text-base font-mono text-white placeholder-white/30 tracking-wide"
                  autoComplete="off"
                  spellCheck={false}
                />

                {/* Voice Input & Wake Word Controls */}
                <div className="flex items-center space-x-1.5 ml-2 mr-1">
                  {/* Wake Word Mode Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleWakeWord}
                    className={`px-2 py-1 rounded-sm flex items-center space-x-1 text-[9px] font-mono tracking-wider uppercase transition-all cursor-pointer ${
                      !wakeWordEnabled || wakeWordState === "disabled"
                        ? "bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/80 hover:bg-white/[0.08]"
                        : wakeWordState === "listening"
                        ? "bg-[#06B6D4]/20 border border-[#06B6D4] text-[#06B6D4] shadow-[0_0_10px_rgba(6,182,212,0.3)] animate-pulse"
                        : wakeWordState === "wake_detected"
                        ? "bg-rose-500/30 border border-rose-500 text-rose-300 shadow-[0_0_14px_rgba(244,63,94,0.6)]"
                        : wakeWordState === "error"
                        ? "bg-amber-500/20 border border-amber-500 text-amber-400"
                        : "bg-[#06B6D4]/10 border border-[#06B6D4]/40 text-[#06B6D4]"
                    }`}
                    title={
                      wakeWordEnabled
                        ? `Wake Word active ("${WakeWordService.getWakePhrase()}"). Click to disable.`
                        : `Enable Wake Word ("${WakeWordService.getWakePhrase()}"). Click to turn on.`
                    }
                  >
                    <Radio size={11} className={wakeWordEnabled && wakeWordState === "listening" ? "animate-pulse" : ""} />
                    <span>
                      {!wakeWordEnabled || wakeWordState === "disabled"
                        ? "WAKE: OFF"
                        : wakeWordState === "listening"
                        ? "WAKE: ACTIVE"
                        : wakeWordState === "wake_detected"
                        ? "WAKE DETECTED"
                        : wakeWordState === "error"
                        ? "WAKE ERROR"
                        : "WAKE: READY"}
                    </span>
                  </button>

                  {/* TTS Voice Output Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleTts}
                    className={`px-2 py-1 rounded-sm flex items-center space-x-1 text-[9px] font-mono tracking-wider uppercase transition-all cursor-pointer ${
                      !ttsEnabled || ttsState === "disabled"
                        ? "bg-white/[0.04] border border-white/[0.08] text-white/40 hover:text-white/80 hover:bg-white/[0.08]"
                        : ttsState === "speaking"
                        ? "bg-[#06B6D4]/20 border border-[#06B6D4] text-[#06B6D4] shadow-[0_0_10px_rgba(6,182,212,0.3)] animate-pulse"
                        : ttsState === "error"
                        ? "bg-rose-500/20 border border-rose-500/50 text-rose-300"
                        : "bg-white/[0.04] border border-[#06B6D4]/40 text-[#06B6D4] hover:bg-[#06B6D4]/10"
                    }`}
                    title={
                      ttsEnabled
                        ? ttsState === "speaking"
                          ? "ALFRED is speaking. Click to toggle voice responses."
                          : "Voice responses active (Local Windows TTS). Click to mute."
                        : "Voice responses muted. Click to enable local TTS."
                    }
                  >
                    {!ttsEnabled || ttsState === "disabled" ? (
                      <VolumeX size={11} />
                    ) : (
                      <Volume2 size={11} className={ttsState === "speaking" ? "animate-pulse" : ""} />
                    )}
                    <span>
                      {!ttsEnabled || ttsState === "disabled"
                        ? "TTS: OFF"
                        : ttsState === "speaking"
                        ? "SPEAKING"
                        : ttsState === "error"
                        ? "TTS ERR"
                        : "TTS: ON"}
                    </span>
                  </button>

                  {/* Manual Voice Input Microphone Control */}
                  {voiceState === "listening" ? (
                    <button
                      type="button"
                      onClick={handleToggleVoice}
                      className="px-2.5 py-1.5 rounded-sm bg-[#E11D48]/20 border border-[#E11D48] text-[#E11D48] shadow-[0_0_12px_rgba(225,29,72,0.4)] transition-all cursor-pointer flex items-center space-x-1.5 animate-pulse"
                      title="Listening... Click to conclude speech"
                    >
                      <Mic size={14} />
                      <span className="text-[10px] font-mono tracking-wider font-bold">LISTENING</span>
                      {/* Audio waveform activity indicator */}
                      <span className="flex items-end space-x-0.5 h-3 ml-1">
                        <span className="w-0.5 h-2 bg-[#E11D48] animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-0.5 h-3 bg-[#E11D48] animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-0.5 h-1.5 bg-[#E11D48] animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    </button>
                  ) : voiceState === "processing" ? (
                    <div
                      className="px-2.5 py-1.5 rounded-sm bg-[#06B6D4]/20 border border-[#06B6D4] text-[#06B6D4] flex items-center space-x-1.5 text-[10px] font-mono"
                      title="Synthesizing transcript..."
                    >
                      <Radio size={13} className="animate-spin" />
                      <span>PROCESSING...</span>
                    </div>
                  ) : voiceState === "error" ? (
                    <button
                      type="button"
                      onClick={handleToggleVoice}
                      className="px-2 py-1 rounded-sm bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center space-x-1 text-[10px] font-mono cursor-pointer"
                      title={voiceDetail || "Voice input error. Click to retry."}
                    >
                      <MicOff size={13} />
                      <span className="truncate max-w-[120px]">{voiceDetail || "VOICE ERROR"}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleToggleVoice}
                      className="p-1.5 rounded-sm text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer group"
                      title="Voice Input (Local STT)"
                    >
                      <Mic size={16} className="group-hover:text-[#E11D48] transition-colors" />
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="ml-2 px-3 py-1.5 alfred-btn-primary disabled:opacity-30 rounded-sm text-xs font-mono uppercase tracking-wider flex items-center space-x-1"
                >
                  <span>Execute</span>
                  <CornerDownLeft size={13} />
                </button>
              </form>
            </div>

            {/* Quick Command Suggestions */}
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl">
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/40 mr-1">
                TACTICAL PRESETS:
              </span>
              {[
                { label: "💻 Open VS Code", cmd: "open VS Code" },
                { label: "🚀 Start DSA Workspace", cmd: "start my DSA workspace" },
                { label: "📋 Show My Tasks", cmd: "show tasks" },
                { label: "🎯 Deep Work Mode", cmd: "start deep work" },
                { label: "🔍 Available Workspaces", cmd: "which workspaces do I have?" },
                { label: "📊 System Status", cmd: "system status" },
              ].map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => executeQuickCommand(item.cmd)}
                  className="px-2.5 py-1 rounded-sm bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20 text-white/70 hover:text-white text-xs font-mono transition-all duration-150 cursor-pointer"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Tactical Command Flow Pipeline Indicator */}
            {commandStage !== "idle" && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="w-full max-w-3xl flex items-center justify-between p-2 px-3.5 rounded-xl bg-black/40 border border-white/10 font-mono text-[10px] tracking-wider overflow-x-auto gap-2 shadow-inner"
              >
                {[
                  { stage: "input", label: "1. INPUT" },
                  { stage: "understanding", label: "2. UNDERSTAND" },
                  { stage: "plan", label: "3. PLAN" },
                  { stage: "confirmation", label: "4. CONFIRM" },
                  { stage: "execution", label: "5. EXECUTE" },
                  { stage: "result", label: "6. RESULT" },
                ].map(({ stage, label }, idx) => {
                  const stages = ["input", "understanding", "plan", "confirmation", "execution", "result"];
                  const currentIdx = stages.indexOf(commandStage);
                  const thisIdx = stages.indexOf(stage);
                  const isCurrent = commandStage === stage;
                  const isPast = currentIdx > thisIdx;
                  return (
                    <React.Fragment key={stage}>
                      <div
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded transition-all whitespace-nowrap ${
                          isCurrent
                            ? "bg-[#06B6D4]/20 text-[#06B6D4] font-bold border border-[#06B6D4]/40 shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                            : isPast
                            ? "text-emerald-400 font-medium"
                            : "text-gray-600"
                        }`}
                      >
                        {isPast && <CheckCircle2 size={11} className="text-emerald-400" />}
                        <span>{label}</span>
                      </div>
                      {idx < 5 && <span className="text-gray-600 text-[10px]">→</span>}
                    </React.Fragment>
                  );
                })}
              </motion.div>
            )}

            {/* Middle Section: Confirmation Gate OR Execution Timeline OR Answer Readout */}
            <div className="w-full max-w-3xl space-y-4">
              {/* Tactical Confirmation Gate / Agentic Execution Plan Preview */}
              {pendingConfirmation && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="alfred-panel rounded-sm border-cyan-500/40 p-5 shadow-[0_0_24px_rgba(6,182,212,0.15)] bg-[#080C14]/95"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-3">
                    <div className="flex items-center space-x-2 text-[#06B6D4] font-mono text-xs font-bold uppercase tracking-wider">
                      <Layers size={16} />
                      <span>
                        {pendingConfirmation.memoryProposal
                          ? pendingConfirmation.memoryProposal.type === "delete" || pendingConfirmation.memoryProposal.type === "delete_all"
                            ? "ALFRED // FORGET MEMORY"
                            : "ALFRED // REMEMBER PREFERENCE"
                          : "ALFRED // EXECUTION PLAN"}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase font-semibold">
                      Awaiting Operator Approval
                    </span>
                  </div>

                  {pendingConfirmation.memoryProposal ? (
                    <div className="bg-black/40 rounded-sm p-4 border border-cyan-500/20 space-y-3 mb-4">
                      <div className="text-xs font-mono uppercase tracking-wider text-[#06B6D4] font-bold">
                        {pendingConfirmation.memoryProposal.type === "delete" || pendingConfirmation.memoryProposal.type === "delete_all"
                          ? "MEMORY REMOVAL PROPOSAL"
                          : pendingConfirmation.memoryProposal.type === "update"
                          ? "PREFERENCE UPDATE PROPOSAL"
                          : "NEW PREFERENCE PROPOSAL"}
                      </div>
                      <div className="text-sm font-sans font-medium text-white/90 whitespace-pre-line leading-relaxed">
                        {pendingConfirmation.memoryProposal.promptPreview}
                      </div>
                      {pendingConfirmation.memoryProposal.memory?.category && (
                        <div className="text-[11px] font-mono text-white/40 pt-1 border-t border-white/[0.04]">
                          Category:{" "}
                          <span className="text-white/70">
                            {pendingConfirmation.memoryProposal.memory.category}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : pendingConfirmation.agenticPlan ? (
                    <div>
                      <div className="text-sm font-sans font-semibold text-white mb-2">
                        {pendingConfirmation.agenticPlan.objective}
                      </div>
                      <div className="text-xs font-mono text-white/50 mb-3">
                        {pendingConfirmation.agenticPlan.explanation}
                      </div>

                      <div className="space-y-2 mb-4">
                        {pendingConfirmation.agenticPlan.steps.map((step, idx) => (
                          <div
                            key={step.id || idx}
                            className="flex items-center justify-between p-2.5 rounded-sm bg-white/[0.02] border border-white/[0.06] hover:border-white/15 transition-colors"
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-[10px] font-mono font-bold text-[#06B6D4] bg-[#06B6D4]/10 border border-[#06B6D4]/20 px-1.5 py-0.5 rounded-sm">
                                0{idx + 1}
                              </span>
                              <span className="text-xs font-mono text-white/90">
                                {step.description}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-white/40 uppercase">
                              QUEUED
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-black/40 rounded-sm p-3 border border-white/[0.08] space-y-2 mb-4">
                      <div className="text-xs font-mono text-white/80">
                        • Planned Mutations:{" "}
                        <span className="text-[#06B6D4] font-bold">
                          {pendingConfirmation.risk?.mutationCount || 1}
                        </span>{" "}
                        entity action(s)
                      </div>

                      {pendingConfirmation.risk?.affectedEntities &&
                        pendingConfirmation.risk.affectedEntities.length > 0 && (
                          <div className="flex flex-wrap gap-2 text-xs font-mono text-white/70">
                            {pendingConfirmation.risk.affectedEntities.map((ent, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-sm bg-white/[0.05] border border-white/10"
                              >
                                {ent.type.toUpperCase()}:{" "}
                                <span className="text-white font-semibold">{ent.name}</span>
                              </span>
                            ))}
                          </div>
                        )}

                      {pendingConfirmation.risk?.summary && (
                        <div className="text-xs font-mono text-white/50 italic">
                          • {pendingConfirmation.risk.summary}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center space-x-3 pt-1">
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className="flex-1 py-2.5 bg-[#06B6D4] hover:bg-[#0891B2] text-black font-mono font-bold rounded-sm text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
                    >
                      {pendingConfirmation.memoryProposal
                        ? pendingConfirmation.memoryProposal.type === "delete" || pendingConfirmation.memoryProposal.type === "delete_all"
                          ? "[ Forget ]"
                          : pendingConfirmation.memoryProposal.type === "update"
                          ? "[ Update ]"
                          : "[ Save ]"
                        : "[ Proceed ]"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-6 py-2.5 alfred-btn-secondary rounded-sm text-xs font-mono uppercase tracking-wider text-white/60 hover:text-white cursor-pointer"
                    >
                      [ Cancel ]
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Tool Execution Timeline Visualization */}
              {executionTimeline && executionTimeline.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="alfred-panel rounded-sm p-5 border-white/15"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 mb-4">
                    <div className="flex items-center space-x-2">
                      <Layers size={15} className="text-[#06B6D4]" />
                      <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                        EXECUTION SEQUENCE TIMELINE
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-white/40">
                      {executionTimeline.length} ACTION NODES
                    </span>
                  </div>

                  <div className="space-y-3">
                    {executionTimeline.map((step) => (
                      <div
                        key={step.index}
                        className="flex items-start space-x-3 p-2.5 rounded-sm bg-white/[0.02] border border-white/[0.05]"
                      >
                        <div className="px-2 py-0.5 rounded-sm bg-white/[0.05] border border-white/10 text-[10px] font-mono text-white/60 font-bold shrink-0">
                          0{step.index}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono font-semibold text-white truncate">
                            {step.label}
                          </div>
                          {step.detail && (
                            <div className="text-[11px] font-mono text-white/50 truncate mt-0.5">
                              {step.detail}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center space-x-1.5">
                          {step.status === "completed" ? (
                            <span className="inline-flex items-center text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-sm">
                              <CheckCircle2 size={12} className="mr-1" /> DONE
                            </span>
                          ) : step.status === "executing" ? (
                            <span className="inline-flex items-center text-[10px] font-mono font-bold text-[#06B6D4] bg-[#06B6D4]/10 border border-[#06B6D4]/30 px-2 py-0.5 rounded-sm animate-pulse">
                              ACTIVE
                            </span>
                          ) : step.status === "failed" ? (
                            <span className="inline-flex items-center text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-sm">
                              FAILED
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-white/30">QUEUED</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Answer / Recommendation Mode Intelligence Readout Card */}
              {answerResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="alfred-panel rounded-sm p-5 border-[#06B6D4]/30 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                >
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-3">
                    <div className="flex items-center space-x-2">
                      <Sparkles size={16} className="text-[#06B6D4]" />
                      <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                        {answerResult.recommendations && answerResult.recommendations.length > 0
                          ? "ALFRED TACTICAL RECOMMENDATIONS"
                          : "ALFRED INTELLIGENCE READOUT"}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-[10px] font-mono">
                      <span className="text-white/40">SOURCE: SESSION CONTEXT</span>
                      <span className="text-[#06B6D4] font-semibold">
                        PROVIDER: {answerResult.provider}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm font-sans text-white/90 leading-relaxed whitespace-pre-line">
                    {answerResult.text}
                  </div>

                  {/* Recommendations List */}
                  {answerResult.recommendations && answerResult.recommendations.length > 0 && (
                    <div className="mt-4 space-y-2.5 pt-3 border-t border-white/[0.08]">
                      {answerResult.recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          className="p-3 rounded-sm bg-white/[0.02] border border-white/[0.08] hover:border-[#06B6D4]/40 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-mono font-bold text-white tracking-wide">
                              {rec.title}
                            </span>
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-sm bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4] shrink-0">
                              {rec.category.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-white/60 leading-relaxed">
                            {rec.rationale}
                          </p>
                          {rec.suggestedAction && (
                            <button
                              type="button"
                              onClick={() => {
                                setInput(rec.suggestedAction!);
                                inputRef.current?.focus();
                              }}
                              className="mt-2 inline-flex items-center space-x-1.5 px-2 py-1 rounded-sm bg-[#06B6D4]/10 hover:bg-[#06B6D4]/20 border border-[#06B6D4]/30 hover:border-[#06B6D4] text-[#06B6D4] text-[11px] font-mono transition-all cursor-pointer"
                              title="Load directive into input box"
                            >
                              <CornerDownLeft size={11} />
                              <span>ACT: &quot;{rec.suggestedAction}&quot;</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Lower Telemetry & Session Activity Grid */}
            <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Recent Activity Card */}
              <div className="alfred-panel rounded-sm p-4 flex flex-col h-56">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-3">
                  <div className="flex items-center space-x-2">
                    <Clock size={13} className="text-[#06B6D4]" />
                    <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                      RECENT DIRECTIVES & ACTIVITY
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-white/40">THIS SESSION</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {activities.map((act) => (
                    <div
                      key={act.id}
                      className="p-2 rounded-sm bg-white/[0.02] border border-white/[0.04] flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center space-x-2 truncate mr-2">
                        <span className="text-white/30 text-[10px]">{act.timestamp}</span>
                        <span className="text-white font-medium truncate">{act.command}</span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm shrink-0 uppercase ${
                          act.status === "success"
                            ? "text-emerald-400 bg-emerald-500/10"
                            : act.status === "error"
                            ? "text-rose-400 bg-rose-500/10"
                            : act.status === "warning"
                            ? "text-amber-400 bg-amber-500/10"
                            : "text-[#06B6D4] bg-[#06B6D4]/10"
                        }`}
                      >
                        {act.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* System Telemetry & Controls Card */}
              <div className="alfred-panel rounded-sm p-4 flex flex-col justify-between h-56">
                <div>
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-3">
                    <div className="flex items-center space-x-2">
                      <Cpu size={13} className="text-[#E11D48]" />
                      <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                        HOST SYSTEM TELEMETRY
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-emerald-400">NOMINAL</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-sm bg-white/[0.02] border border-white/[0.04]">
                      <div className="text-[9px] text-white/40 uppercase">ARCHITECTURE</div>
                      <div className="text-white font-semibold text-xs mt-0.5">
                        {telemetry ? `${telemetry.platform.toUpperCase()} (${telemetry.arch})` : "WIN32 (X64)"}
                      </div>
                    </div>
                    <div className="p-2 rounded-sm bg-white/[0.02] border border-white/[0.04]">
                      <div className="text-[9px] text-white/40 uppercase">CPU CORES</div>
                      <div className="text-white font-semibold text-xs mt-0.5">
                        {telemetry ? `${telemetry.cpus} LOGICAL CORES` : "16 CORES"}
                      </div>
                    </div>
                    <div className="p-2 rounded-sm bg-white/[0.02] border border-white/[0.04]">
                      <div className="text-[9px] text-white/40 uppercase">AVAILABLE RAM</div>
                      <div className="text-white font-semibold text-xs mt-0.5">
                        {telemetry ? `${Math.round(telemetry.freeMem / 1024)} GB FREE` : "12 GB FREE"}
                      </div>
                    </div>
                    <div className="p-2 rounded-sm bg-white/[0.02] border border-white/[0.04]">
                      <div className="text-[9px] text-white/40 uppercase">SECURITY MODE</div>
                      <div className="text-[#06B6D4] font-semibold text-xs mt-0.5">
                        AIR-GAPPED LOCAL
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowRawLogs(!showRawLogs)}
                    className="flex items-center space-x-1.5 text-[10px] font-mono text-white/50 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>{showRawLogs ? "HIDE RAW LOGS" : "SHOW RAW TERMINAL LOGS"}</span>
                    {showRawLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <span className="text-[9px] font-mono text-white/30">
                    {logs.length} LOG LINES
                  </span>
                </div>
              </div>
            </div>

            {/* Collapsible Raw Terminal Output Logs */}
            {showRawLogs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full max-w-3xl alfred-panel rounded-sm p-4 overflow-hidden border-white/10"
              >
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2 mb-2">
                  <span className="text-[10px] font-mono text-white/50 uppercase">
                    RAW IPC TELEMETRY LOG STREAM
                  </span>
                  <button
                    type="button"
                    onClick={() => setLogs([])}
                    className="text-[10px] font-mono text-white/40 hover:text-white"
                  >
                    Clear Stream
                  </button>
                </div>
                <div className="h-40 overflow-y-auto font-mono text-xs text-slate-300 space-y-1 bg-black/40 p-2.5 rounded-sm">
                  {logs.map((log, i) => (
                    <div
                      key={i}
                      className={
                        log.startsWith(">")
                          ? "text-[#38BDF8] font-semibold"
                          : log.startsWith("ALFRED")
                          ? "text-slate-200"
                          : "text-slate-400"
                      }
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
