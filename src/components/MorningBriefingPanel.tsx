"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  AlertCircle,
  Calendar,
  Layers,
  Target,
  Clock,
  ChevronDown,
  ChevronUp,
  Play,
  X,
} from "lucide-react";
import type { MorningBriefing } from "../../electron/agent/briefing/briefing.types";
import { playClickSound } from "@/utils/audioSystem";

interface MorningBriefingPanelProps {
  onExecuteCommand?: (cmd: string) => void;
  tasksCount?: {
    overdue: number;
    dueToday: number;
    highPriority: number;
  };
  activeProjectsCount?: number;
  activeGoalsCount?: number;
  focusMinutes?: number;
}

export default function MorningBriefingPanel({
  onExecuteCommand,
  tasksCount,
  activeProjectsCount,
  activeGoalsCount,
  focusMinutes,
}: MorningBriefingPanelProps) {
  const [briefing, setBriefing] = useState<MorningBriefing | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const fetchBriefing = useCallback(async () => {
    if (typeof window !== "undefined" && window.electron?.briefing?.get) {
      try {
        const data = await window.electron.briefing.get();
        setBriefing(data);
      } catch (err) {
        console.error("Failed to load morning briefing:", err);
      }
    }
  }, []);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  if (isDismissed) return null;

  // Use factual counts from briefing service if loaded, else fallback to props
  const overdueCount = briefing?.counts.overdueTasks ?? tasksCount?.overdue ?? 0;
  const dueTodayCount = briefing?.counts.dueTodayTasks ?? tasksCount?.dueToday ?? 0;
  const projectsCount = briefing?.counts.activeProjects ?? activeProjectsCount ?? 0;
  const goalsCount = briefing?.counts.activeGoals ?? activeGoalsCount ?? 0;
  const focusMin = briefing?.counts.todayFocusMinutes ?? focusMinutes ?? 0;

  const handleLaunchRoutine = (routineName: string) => {
    playClickSound();
    if (onExecuteCommand) {
      onExecuteCommand(`Start ${routineName.toLowerCase()}`);
    } else if (typeof window !== "undefined" && window.electron?.commandAgent?.execute) {
      window.electron.commandAgent.execute(`Start ${routineName.toLowerCase()}`);
    }
  };

  return (
    <div className="alfred-panel rounded-sm border-l-2 border-l-[#F59E0B] bg-[#0B0E17]/90 backdrop-blur-md shadow-[0_0_18px_rgba(245,158,11,0.08)] relative z-20 overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-white/[0.04]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-sm bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] shrink-0">
            <Sun size={16} className="animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono tracking-widest text-[#F59E0B] uppercase font-bold">
                MORNING BRIEF // OPERATIONAL SNAPSHOT
              </span>
              {briefing && (
                <span className="text-[9px] font-mono text-slate-400">
                  {briefing.timeContext.currentDayOfWeek}, {briefing.timeContext.currentDate}
                </span>
              )}
            </div>
            <h4 className="text-xs font-mono font-bold text-white tracking-wide">
              {briefing ? briefing.greeting : "Good morning"}. Operational telemetry loaded.
            </h4>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsExpanded((prev) => !prev);
            }}
            className="px-2.5 py-1 rounded-sm bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 hover:text-white text-xs font-mono tracking-wider transition-colors cursor-pointer flex items-center space-x-1"
          >
            <span>{isExpanded ? "Collapse" : "Details"}</span>
            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsDismissed(true);
            }}
            className="p-1 rounded-sm text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            title="Dismiss briefing"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 5-Column Operational Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.05] bg-black/20">
        {/* Overdue */}
        <div className="p-3 text-center flex flex-col justify-center items-center">
          <div className="flex items-center space-x-1 text-[10px] font-mono uppercase text-slate-400">
            <AlertCircle size={11} className={overdueCount > 0 ? "text-[#E11D48]" : "text-slate-500"} />
            <span>Overdue</span>
          </div>
          <span
            className={`text-lg font-mono font-bold mt-0.5 ${
              overdueCount > 0 ? "text-[#E11D48]" : "text-slate-400"
            }`}
          >
            {overdueCount}
          </span>
        </div>

        {/* Due Today */}
        <div className="p-3 text-center flex flex-col justify-center items-center">
          <div className="flex items-center space-x-1 text-[10px] font-mono uppercase text-slate-400">
            <Calendar size={11} className={dueTodayCount > 0 ? "text-[#06B6D4]" : "text-slate-500"} />
            <span>Due Today</span>
          </div>
          <span
            className={`text-lg font-mono font-bold mt-0.5 ${
              dueTodayCount > 0 ? "text-[#06B6D4]" : "text-slate-400"
            }`}
          >
            {dueTodayCount}
          </span>
        </div>

        {/* Active Projects */}
        <div className="p-3 text-center flex flex-col justify-center items-center">
          <div className="flex items-center space-x-1 text-[10px] font-mono uppercase text-slate-400">
            <Layers size={11} className="text-slate-400" />
            <span>Active Projects</span>
          </div>
          <span className="text-lg font-mono font-bold mt-0.5 text-white">
            {projectsCount}
          </span>
        </div>

        {/* Goals */}
        <div className="p-3 text-center flex flex-col justify-center items-center">
          <div className="flex items-center space-x-1 text-[10px] font-mono uppercase text-slate-400">
            <Target size={11} className="text-[#10B981]" />
            <span>Goals</span>
          </div>
          <span className="text-lg font-mono font-bold mt-0.5 text-[#10B981]">
            {goalsCount}
          </span>
        </div>

        {/* Focus Minutes */}
        <div className="p-3 text-center flex flex-col justify-center items-center col-span-2 sm:col-span-1">
          <div className="flex items-center space-x-1 text-[10px] font-mono uppercase text-slate-400">
            <Clock size={11} className="text-[#A855F7]" />
            <span>Focus</span>
          </div>
          <span className="text-lg font-mono font-bold mt-0.5 text-[#A855F7]">
            {focusMin} min
          </span>
        </div>
      </div>

      {/* Expandable Bounded Detail Section */}
      <AnimatePresence>
        {isExpanded && briefing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-4 border-t border-white/[0.04] bg-black/40 space-y-4 text-xs font-sans"
          >
            {/* Spoken / High-level Summary */}
            <div className="p-3 rounded-sm bg-white/[0.02] border border-white/[0.06] text-slate-300 leading-relaxed font-mono text-[11px]">
              <span className="text-[#F59E0B] font-bold mr-1">{"// BRIEFING DIRECTIVE:"}</span>
              {briefing.spokenSummary}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Overdue & Due Today Tasks */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
                  Target Tasks
                </span>
                {briefing.overdueTasks.length === 0 && briefing.dueTodayTasks.length === 0 ? (
                  <p className="text-slate-500 font-mono text-[11px]">No overdue or due-today tasks.</p>
                ) : (
                  <div className="space-y-1.5">
                    {briefing.overdueTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-2 rounded-sm bg-[#E11D48]/10 border border-[#E11D48]/30 flex items-center justify-between text-[11px]"
                      >
                        <span className="text-slate-200 font-medium truncate">{t.text}</span>
                        <span className="text-[9px] font-mono text-[#E11D48] uppercase shrink-0 font-bold ml-2">
                          OVERDUE
                        </span>
                      </div>
                    ))}
                    {briefing.dueTodayTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-2 rounded-sm bg-[#06B6D4]/10 border border-[#06B6D4]/30 flex items-center justify-between text-[11px]"
                      >
                        <span className="text-slate-200 font-medium truncate">{t.text}</span>
                        <span className="text-[9px] font-mono text-[#06B6D4] uppercase shrink-0 font-bold ml-2">
                          TODAY
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Projects */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
                  Active Projects
                </span>
                {briefing.activeProjects.length === 0 ? (
                  <p className="text-slate-500 font-mono text-[11px]">No active projects.</p>
                ) : (
                  <div className="space-y-1.5">
                    {briefing.activeProjects.map((p) => (
                      <div
                        key={p.id}
                        className="p-2 rounded-sm bg-white/[0.02] border border-white/[0.06] space-y-1 text-[11px]"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-white font-medium truncate">{p.name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{p.progress}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                          <div
                            className="bg-[#06B6D4] h-full rounded-full transition-all"
                            style={{ width: `${Math.min(p.progress, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ready Daily Routines */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold tracking-wider">
                  Fast Launch Routines
                </span>
                <div className="space-y-1.5">
                  {briefing.availableRoutines.slice(0, 3).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleLaunchRoutine(r.name)}
                      className="w-full p-2 rounded-sm bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-[#06B6D4]/40 flex items-center justify-between text-[11px] font-mono text-left transition-all cursor-pointer group"
                    >
                      <span className="text-slate-200 group-hover:text-[#06B6D4] font-medium">
                        {r.name}
                      </span>
                      <Play size={10} className="text-slate-500 group-hover:text-[#06B6D4]" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
