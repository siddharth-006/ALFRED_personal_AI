"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { playScanSound, playClickSound } from "@/utils/audioSystem";
import { useWorkspaces } from "@/context/WorkspaceContext";
import { useTasks } from "@/context/TaskContext";

interface PendingConfirmationState {
  id: string;
  risk?: any;
  plan?: any;
  summary?: string;
}

export default function CommandTerminal() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmationState | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "ALFRED TERMINAL OS v2.0",
    "Type 'help' for available commands or enter natural commands (e.g. 'Open VS Code', 'Go to missions', 'System status')."
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { workspaces, launchWorkspace, setFocus } = useWorkspaces();
  const { tasks } = useTasks();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        if (!isOpen) {
          playScanSound();
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const rawInput = input.trim();
    setLogs(prev => [...prev, `> ${rawInput}`]);
    playClickSound();

    const currentPrompt = rawInput;
    setInput("");

    setTimeout(() => {
      processCommand(currentPrompt);
    }, 300);
  };

  const handleExecutionResult = async (result: any) => {
    if (!result) return;

    if (result.cancelled) {
      setLogs(prev => [...prev, `ALFRED: ${result.explanation || "Action execution cancelled by user."}`]);
      return;
    }

    // Check for AI Answer Mode response
    if (result.answerText || result.responseType === "answer" || result.intent === "answer") {
      const providerTag = result.providerId ? `ALFRED (${result.providerId.toUpperCase()})` : "ALFRED";
      setLogs(prev => [
        ...prev,
        `${providerTag}: ${result.answerText || result.explanation || "Informational answer provided."}`
      ]);
      return;
    }

    // Multi-step summary or general explanation display
    if (result.explanation && (result.steps?.length > 1 || result.totalSteps > 1)) {
      const lines = result.explanation.split("\n");
      setLogs(prev => [...prev, ...lines.map((l: string) => `ALFRED: ${l}`)]);
    }

    if (result.intent === "launch_application") {
      if (result.success && result.appName) {
        setLogs(prev => [
          ...prev,
          `ALFRED: Command recognized. Launching ${result.appName}...`
        ]);
        return;
      } else {
        const failureMsg = result.error || `I understood the command, but ${result.appName || "application"} could not be launched.`;
        setLogs(prev => [...prev, `ALFRED: ${failureMsg}`]);
        return;
      }
    }

    if (result.intent === "navigate") {
      const navTarget = result.appName?.toLowerCase();
      if (navTarget === "missions" || navTarget === "tasks") {
        router.push("/tasks");
        setLogs(prev => [...prev, "ALFRED: Navigating to Mission Control..."]);
      } else if (navTarget === "goals") {
        router.push("/goals");
        setLogs(prev => [...prev, "ALFRED: Navigating to Tactical Goals..."]);
      } else if (navTarget === "projects") {
        router.push("/projects");
        setLogs(prev => [...prev, "ALFRED: Navigating to Archives..."]);
      } else if (navTarget === "workspaces") {
        router.push("/workspaces");
        setLogs(prev => [...prev, "ALFRED: Navigating to Workspaces..."]);
      } else if (navTarget === "dashboard" || navTarget === "home") {
        router.push("/");
        setLogs(prev => [...prev, "ALFRED: Navigating to Dashboard..."]);
      } else {
        router.push("/");
        setLogs(prev => [...prev, "ALFRED: Navigating to Home..."]);
      }
      setTimeout(() => setIsOpen(false), 1000);
      return;
    }

    if (result.intent === "system_status") {
      if (typeof window !== "undefined" && window.electron?.system?.getInfo) {
        const info = await window.electron.system.getInfo();
        setLogs(prev => [
          ...prev,
          "ALFRED SYSTEM STATUS REPORT:",
          `• Platform: ${info.platform} (${info.arch})`,
          `• CPUs: ${info.cpus} cores`,
          `• Memory: ${info.freeMemoryMB} MB free / ${info.totalMemoryMB} MB total`,
          "• Status: ALL SYSTEMS NOMINAL"
        ]);
      } else {
        setLogs(prev => [...prev, "AI CORE: ONLINE", "MEMORY: NOMINAL", "NETWORK: SECURE", "VITALS: 100%"]);
      }
      return;
    }

    if (result.intent === "start_deep_work") {
      setFocus("dsa");
      setLogs(prev => [...prev, "ALFRED: Deep Work sequence initiated. Stay locked in, Commander."]);
      return;
    }

    if (result.intent === "launch_workspace" && result.appName) {
      const targetName = result.appName.toLowerCase();
      const ws = workspaces.find(
        w => w.name.toLowerCase().includes(targetName) || w.type.toLowerCase() === targetName
      );

      if (ws) {
        setLogs(prev => [...prev, `ALFRED: Initiating workspace: ${ws.name}...`]);
        launchWorkspace(ws.id);
        if (window.electron?.workspace) {
          await window.electron.workspace.launch(ws);
        } else {
          ws.websites.forEach(url => window.open(url, "_blank"));
        }
        setTimeout(() => setIsOpen(false), 1000);
      } else {
        setLogs(prev => [...prev, `ALFRED: Workspace '${result.appName}' not found.`]);
      }
      return;
    }

    if (result.intent === "show_tasks") {
      const pendingCount = tasks.filter(t => !t.completed).length;
      setLogs(prev => [
        ...prev,
        `ALFRED: You have ${pendingCount} active mission(s). Navigating to Mission Control...`
      ]);
      router.push("/tasks");
      setTimeout(() => setIsOpen(false), 1200);
      return;
    }

    if (result.intent === "create_task") {
      const taskObj = (result.task as any) || (result.data as any)?.task;
      const taskName = taskObj?.text || result.appName || "New task";
      const category = taskObj?.category ? ` [${taskObj.category}]` : "";
      setLogs(prev => [
        ...prev,
        `ALFRED: Task created -> "${taskName}"${category}. Mission Control updated.`
      ]);
      return;
    }

    if (result.intent === "complete_task") {
      const taskObj = (result.task as any) || (result.data as any)?.task;
      const taskName = taskObj?.text || (result.appName ? `ID: ${result.appName}` : "Task");
      setLogs(prev => [
        ...prev,
        `ALFRED: Mission completed -> "${taskName}". Protocol updated.`
      ]);
      return;
    }

    if (result.intent === "create_goal") {
      const goalObj = (result.goal as any) || (result.data as any)?.goal;
      const goalTitle = goalObj?.title || result.appName || "New goal";
      const target = goalObj?.target ? ` (Target: ${goalObj.target})` : "";
      setLogs(prev => [
        ...prev,
        `ALFRED: Goal initialized -> "${goalTitle}"${target}. Mission Control updated.`
      ]);
      return;
    }

    if (result.intent === "update_goal") {
      const goalObj = (result.goal as any) || (result.data as any)?.goal;
      const goalTitle = goalObj?.title || (result.appName ? `ID: ${result.appName}` : "Goal");
      const status = goalObj?.completed ? "Completed" : `Progress: ${goalObj?.current ?? "?"}/${goalObj?.target ?? "?"}`;
      setLogs(prev => [
        ...prev,
        `ALFRED: Goal updated -> "${goalTitle}" [${status}].`
      ]);
      return;
    }

    if (result.intent === "update_project") {
      const projObj = (result.project as any) || (result.data as any)?.project;
      const projName = projObj?.name || (result.appName ? `ID: ${result.appName}` : "Project");
      const progress = projObj?.progress !== undefined ? ` [${projObj.progress}% - ${projObj.status}]` : "";
      setLogs(prev => [
        ...prev,
        `ALFRED: Project updated -> "${projName}"${progress}.`
      ]);
      return;
    }

    if (result.error && !result.success) {
      setLogs(prev => [...prev, `ALFRED: ${result.explanation || result.error}`]);
      return;
    }
  };

  const handleConfirm = async () => {
    if (!pendingConfirmation || !window.electron?.commandAgent?.confirm) return;
    const id = pendingConfirmation.id;
    setPendingConfirmation(null);
    playClickSound();
    setLogs(prev => [...prev, "> [CONFIRM]"]);
    try {
      const result = await window.electron.commandAgent.confirm(id);
      await handleExecutionResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogs(prev => [...prev, `ALFRED: Confirmation error: ${msg}`]);
    }
  };

  const handleCancel = async () => {
    if (!pendingConfirmation || !window.electron?.commandAgent?.cancel) return;
    const id = pendingConfirmation.id;
    setPendingConfirmation(null);
    playClickSound();
    setLogs(prev => [...prev, "> [CANCEL]"]);
    try {
      const result = await window.electron.commandAgent.cancel(id);
      setLogs(prev => [...prev, `ALFRED: ${result.explanation || "Action execution cancelled by user."}`]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogs(prev => [...prev, `ALFRED: Cancellation error: ${msg}`]);
    }
  };

  const processCommand = async (rawInput: string) => {
    const cmd = rawInput.toLowerCase();

    // Check for conversational confirm/cancel if a confirmation is active
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

    // 1. Command Agent Execution & Intent Resolution Bridge
    if (typeof window !== "undefined" && window.electron?.commandAgent) {
      try {
        const result = await window.electron.commandAgent.execute(rawInput);

        // Phase 4.16: Confirmation Gate handling
        if (result.requiresConfirmation && result.confirmationId) {
          setPendingConfirmation({
            id: result.confirmationId,
            risk: result.risk,
            plan: result.plan,
            summary: result.explanation,
          });
          setLogs(prev => [
            ...prev,
            "ALFRED requires confirmation before executing these actions."
          ]);
          return;
        }

        await handleExecutionResult(result);
        return;
      } catch (err: unknown) {
        console.error("Command Agent IPC Error:", err);
      }
    }

    // 2. Static Terminal Commands & Browser Fallback
    if (cmd === "help") {
      setLogs(prev => [
        ...prev,
        "Available commands:",
        "• Applications: 'Open VS Code', 'Launch Chrome', 'Start Spotify'",
        "• Navigation: 'open missions', 'show goals', 'go to projects', 'open workspaces'",
        "• System & Focus: 'system status', 'start deep work', 'show today's tasks'",
        "• Workspaces: 'launch hackathon workspace', 'open coding workspace'",
        "• Terminal Controls: 'clear', 'exit'"
      ]);
    } else if (cmd === "clear") {
      setLogs([]);
    } else if (cmd === "exit") {
      setIsOpen(false);
    } else {
      setLogs(prev => [...prev, `Command not recognized: ${rawInput}`]);
    }
  };

  useEffect(() => {
    // scroll to bottom
    const terminalDiv = document.getElementById("terminal-logs");
    if (terminalDiv) {
      terminalDiv.scrollTop = terminalDiv.scrollHeight;
    }
  }, [logs, pendingConfirmation]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-12 left-1/2 -translate-x-1/2 w-full max-w-2xl z-[9000] p-4"
        >
          <div className="hud-panel p-4 flex flex-col h-80 rounded-t-lg border-b-0 shadow-2xl shadow-[#00BFFF]/20">
            <div className="flex items-center space-x-2 border-b border-[#00BFFF]/30 pb-2 mb-2">
              <Terminal size={16} className="text-[#00BFFF]" />
              <span className="font-header text-[#00BFFF] text-sm tracking-widest text-glow">COMMAND TERMINAL</span>
            </div>
            <div id="terminal-logs" className="flex-1 overflow-y-auto font-data text-xs text-[#A8C7FA] space-y-1 mb-2">
              {logs.map((log, i) => (
                <div key={i} className={log.startsWith(">") ? "text-[#00E5FF]" : ""}>
                  {log}
                </div>
              ))}
            </div>
            {pendingConfirmation && (
              <div className="bg-[#051329]/90 border border-[#FFB300]/70 rounded p-2.5 mb-2 font-data text-xs shadow-lg shadow-[#FFB300]/10">
                <div className="flex items-center space-x-2 text-[#FFB300] font-bold mb-1">
                  <ShieldAlert size={15} className="text-[#FFB300] animate-pulse" />
                  <span className="tracking-wide">ALFRED requires confirmation before executing these actions.</span>
                </div>
                <div className="text-[#A8C7FA] space-y-0.5 mb-2.5 pl-6 text-[11px]">
                  <div>• Mutations: <span className="text-[#00E5FF] font-semibold">{pendingConfirmation.risk?.mutationCount || 1}</span> action(s)</div>
                  {pendingConfirmation.risk?.affectedEntities && pendingConfirmation.risk.affectedEntities.length > 0 && (
                    <div className="flex flex-wrap gap-x-2">
                      {pendingConfirmation.risk.affectedEntities.map((ent: any, i: number) => (
                        <span key={i} className="text-[#8AB4F8]">• {ent.type.toUpperCase()}: <span className="text-[#E8EAED]">{ent.name}</span></span>
                      ))}
                    </div>
                  )}
                  {pendingConfirmation.risk?.summary && (
                    <div className="text-[#9AA0A6] italic">• {pendingConfirmation.risk.summary}</div>
                  )}
                </div>
                <div className="flex items-center space-x-3 pl-6">
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="px-3 py-1 bg-[#00E5FF]/15 hover:bg-[#00E5FF]/25 border border-[#00E5FF] text-[#00E5FF] rounded text-xs font-semibold tracking-wider transition-all cursor-pointer shadow-sm hover:shadow-[#00E5FF]/20"
                  >
                    [ CONFIRM ]
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1 bg-red-500/15 hover:bg-red-500/25 border border-red-400 text-red-300 rounded text-xs font-semibold tracking-wider transition-all cursor-pointer shadow-sm hover:shadow-red-500/20"
                  >
                    [ CANCEL ]
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={handleCommand} className="flex items-center border-t border-[#00BFFF]/30 pt-2 relative">
              <span className="text-[#00BFFF] mr-2 font-data text-sm">&gt;</span>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[#DFF6FF] font-data text-sm"
                placeholder="Enter command (e.g., 'Open VS Code', 'Go to missions')..."
              />
              <div className="absolute right-0 top-3 w-2 h-4 bg-[#00E5FF] animate-pulse"></div>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
