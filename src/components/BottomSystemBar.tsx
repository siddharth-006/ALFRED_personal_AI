"use client";

import React, { useEffect, useState } from "react";
import { Cpu, Database, ShieldCheck, Terminal, FolderGit2, Layers } from "lucide-react";
import { useProjects } from "@/context/ProjectContext";
import { useWorkspaces } from "@/context/WorkspaceContext";

export default function BottomSystemBar() {
  const { projects } = useProjects();
  const { workspaces, currentFocus } = useWorkspaces();

  const [systemInfo, setSystemInfo] = useState<{
    platform: string;
    arch: string;
    cpus: number;
    totalMemoryMB: number;
    freeMemoryMB: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.electron?.system?.getInfo) {
      window.electron.system.getInfo().then((info) => {
        setSystemInfo(info);
      }).catch(() => {});
    }
  }, []);

  const openTerminal = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-command-terminal"));
    }
  };

  const activeProjectsCount = projects.filter((p) => p.status !== "Completed").length;

  return (
    <footer className="w-full h-7 bg-[#07090E]/95 border-t border-white/[0.08] flex items-center justify-between px-4 z-50 shrink-0 text-[10px] font-mono text-slate-400 select-none">
      {/* Left: Real System Telemetry & Workstation Metrics */}
      <div className="flex items-center space-x-5">
        {systemInfo ? (
          <>
            {/* CPU Cores */}
            <div className="flex items-center space-x-1.5">
              <Cpu size={11} className="text-slate-400" />
              <span className="text-slate-500">CORES:</span>
              <span className="text-slate-200 font-semibold">{systemInfo.cpus}</span>
            </div>

            {/* RAM (Real system memory from Electron) */}
            <div className="flex items-center space-x-1.5 hidden sm:flex">
              <Database size={11} className="text-slate-400" />
              <span className="text-slate-500">MEM:</span>
              <span className="text-slate-200 font-semibold">
                {Math.round((systemInfo.totalMemoryMB - systemInfo.freeMemoryMB) / 1024 * 10) / 10} /{" "}
                {Math.round(systemInfo.totalMemoryMB / 1024 * 10) / 10} GB
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
            <span className="text-slate-300 font-semibold">RUNTIME CONNECTED</span>
          </div>
        )}

        {/* Real Projects Count */}
        <div className="flex items-center space-x-1.5">
          <FolderGit2 size={11} className="text-[#06B6D4]" />
          <span className="text-slate-500">PROJECTS:</span>
          <span className="text-slate-200 font-semibold">{activeProjectsCount}</span>
        </div>

        {/* Real Workspaces Count */}
        <div className="flex items-center space-x-1.5 hidden md:flex">
          <Layers size={11} className="text-[#E11D48]" />
          <span className="text-slate-500">WORKSPACES:</span>
          <span className="text-slate-200 font-semibold">{workspaces.length}</span>
        </div>

        {/* Real Focus Mode */}
        {currentFocus && (
          <div className="flex items-center space-x-1.5 hidden lg:flex">
            <span className="text-slate-500">FOCUS:</span>
            <span className="text-[#06B6D4] font-semibold uppercase">{currentFocus}</span>
          </div>
        )}
      </div>

      {/* Right: Security & Terminal Action */}
      <div className="flex items-center space-x-5">
        <div className="flex items-center space-x-1.5 hidden md:flex" title="Persistent Desktop Presence Active (Minimizes to Tray)">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#06B6D4]" />
          <span className="text-slate-500">DESKTOP:</span>
          <span className="text-cyan-400 font-semibold">PERSISTENT</span>
        </div>

        <div className="flex items-center space-x-1.5 hidden lg:flex">
          <ShieldCheck size={11} className="text-[#10B981]" />
          <span className="text-slate-400">IPC ENCLAVE:</span>
          <span className="text-slate-200">ACTIVE</span>
        </div>

        <div className="hidden sm:flex items-center space-x-1">
          <span className="text-slate-500">ENV:</span>
          <span className="text-slate-300">DESKTOP WORKSTATION</span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("open-alfred-demo"));
            }
          }}
          className="flex items-center space-x-1 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
          title="Interactive Product Tour"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
          <span className="text-[9px] font-mono tracking-wider font-semibold text-cyan-400 hover:text-cyan-200">
            DEMO TOUR
          </span>
        </button>

        <button
          type="button"
          onClick={openTerminal}
          className="flex items-center space-x-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <Terminal size={11} className="text-[#E11D48]" />
          <span className="text-slate-400 font-semibold hover:text-[#E11D48] transition-colors">
            CTRL+K
          </span>
        </button>
      </div>
    </footer>
  );
}
