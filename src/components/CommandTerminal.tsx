"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal } from "lucide-react";
import { useRouter } from "next/navigation";
import { playScanSound, playClickSound } from "@/utils/audioSystem";
import { useWorkspaces } from "@/context/WorkspaceContext";

export default function CommandTerminal() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [logs, setLogs] = useState<string[]>([
    "ALFRED TERMINAL OS v2.0",
    "Type 'help' for available commands."
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { workspaces, launchWorkspace } = useWorkspaces();

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

    const cmd = input.trim().toLowerCase();
    setLogs(prev => [...prev, `> ${cmd}`]);
    playClickSound();

    setTimeout(() => {
      processCommand(cmd);
    }, 300);

    setInput("");
  };

  const processCommand = (cmd: string) => {
    if (cmd === "help") {
      setLogs(prev => [...prev, "Available commands:", "open missions", "open goals", "open archives", "start [workspace]", "system status", "clear", "exit"]);
    } else if (cmd === "open missions") {
      router.push("/tasks");
      setLogs(prev => [...prev, "Navigating to Mission Control..."]);
      setTimeout(() => setIsOpen(false), 1000);
    } else if (cmd === "open goals") {
      router.push("/goals");
      setLogs(prev => [...prev, "Navigating to Tactical Goals..."]);
      setTimeout(() => setIsOpen(false), 1000);
    } else if (cmd === "open archives") {
      router.push("/projects");
      setLogs(prev => [...prev, "Navigating to Archives..."]);
      setTimeout(() => setIsOpen(false), 1000);
    } else if (cmd.startsWith("start ")) {
      const targetName = cmd.replace("start ", "").trim();
      const ws = workspaces.find(w => w.name.toLowerCase().includes(targetName) || w.type.toLowerCase() === targetName);
      if (ws) {
        setLogs(prev => [...prev, `Initiating workspace: ${ws.name}...`]);
        launchWorkspace(ws.id);
        ws.websites.forEach(url => window.open(url, "_blank"));
        setTimeout(() => setIsOpen(false), 1000);
      } else {
        setLogs(prev => [...prev, `Error: Workspace '${targetName}' not found.`]);
      }
    } else if (cmd === "system status") {
      setLogs(prev => [...prev, "AI CORE: ONLINE", "MEMORY: NOMINAL", "NETWORK: SECURE", "VITALS: 100%"]);
    } else if (cmd === "clear") {
      setLogs([]);
    } else if (cmd === "exit") {
      setIsOpen(false);
    } else {
      setLogs(prev => [...prev, `Command not recognized: ${cmd}`]);
    }
  };

  useEffect(() => {
    // scroll to bottom
    const terminalDiv = document.getElementById("terminal-logs");
    if (terminalDiv) {
      terminalDiv.scrollTop = terminalDiv.scrollHeight;
    }
  }, [logs]);

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
            <form onSubmit={handleCommand} className="flex items-center border-t border-[#00BFFF]/30 pt-2 relative">
              <span className="text-[#00BFFF] mr-2 font-data text-sm">&gt;</span>
              <input 
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[#DFF6FF] font-data text-sm"
                placeholder="Enter command..."
              />
              <div className="absolute right-0 top-3 w-2 h-4 bg-[#00E5FF] animate-pulse"></div>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
