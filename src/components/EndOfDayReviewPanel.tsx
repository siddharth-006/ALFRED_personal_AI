"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Moon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Target,
} from "lucide-react";
import type { EndOfDayReview } from "../../electron/agent/review/review.types";
import { playClickSound } from "@/utils/audioSystem";

export default function EndOfDayReviewPanel() {
  const [review, setReview] = useState<EndOfDayReview | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const fetchReview = useCallback(async () => {
    if (typeof window !== "undefined" && window.electron?.review?.get) {
      try {
        const data = await window.electron.review.get();
        setReview(data);
      } catch (err) {
        console.error("Failed to load end-of-day review:", err);
      }
    }
  }, []);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  if (isDismissed || !review) return null;

  const completedCount = review.counts.completedTodayTasks;
  const unfinishedCount = review.counts.unfinishedTasks;
  const overdueCount = review.counts.overdueTasks;
  const focusMin = review.counts.todayFocusMinutes;

  return (
    <div className="alfred-panel rounded-sm border-l-2 border-l-[#06B6D4] bg-[#0B0E17]/90 backdrop-blur-md shadow-[0_0_18px_rgba(6,182,212,0.08)] relative z-20 overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-white/[0.04]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-sm bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4] shrink-0">
            <Moon size={16} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono tracking-widest text-[#06B6D4] uppercase font-bold">
                END-OF-DAY REVIEW // DAILY SYNTHESIS
              </span>
              <span className="text-[9px] font-mono text-slate-400">
                {review.timeContext.currentDayOfWeek}, {review.timeContext.currentDate}
              </span>
            </div>
            <h4 className="text-xs font-mono font-bold text-white tracking-wide">
              {completedCount > 0
                ? `${completedCount} task${completedCount === 1 ? "" : "s"} completed today (${focusMin}m focus logged)`
                : `Operational review loaded (${focusMin}m focus logged)`}
            </h4>
          </div>
        </div>

        {/* Telemetry Chips & Action Controls */}
        <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
          {/* Completed Chip */}
          <div
            title="Tasks completed today"
            className={`flex items-center space-x-1.5 px-2 py-1 rounded text-[11px] font-mono font-bold border ${
              completedCount > 0
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-white/[0.03] border-white/[0.08] text-slate-400"
            }`}
          >
            <CheckCircle2 size={12} />
            <span>{completedCount} DONE</span>
          </div>

          {/* Unfinished / Overdue Chip */}
          {(unfinishedCount > 0 || overdueCount > 0) && (
            <div
              title="Pending due today or overdue"
              className="flex items-center space-x-1.5 px-2 py-1 rounded text-[11px] font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400"
            >
              <AlertTriangle size={12} />
              <span>
                {overdueCount > 0 ? `${overdueCount} OVERDUE` : `${unfinishedCount} UNFINISHED`}
              </span>
            </div>
          )}

          {/* Focus Time Chip */}
          <div
            title="Focus duration today"
            className="flex items-center space-x-1.5 px-2 py-1 rounded text-[11px] font-mono font-bold bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4]"
          >
            <Clock size={12} />
            <span>{focusMin}m FOCUS</span>
          </div>

          {/* Expand/Collapse Toggle */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsExpanded((prev) => !prev);
            }}
            className="p-1.5 rounded hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? "Collapse review" : "Expand review"}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Dismiss Button */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsDismissed(true);
            }}
            className="p-1.5 rounded hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            title="Dismiss review panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Expandable Detailed Dossier */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/[0.04] bg-black/40 p-4 space-y-4 text-xs font-sans"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Card 1: Completed Today */}
              <div className="p-3 rounded bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold">
                  <span className="flex items-center space-x-1.5">
                    <CheckCircle2 size={12} />
                    <span>Completed Today</span>
                  </span>
                  <span>{completedCount}</span>
                </div>
                {review.completedTasks.length > 0 ? (
                  <ul className="space-y-1 text-slate-300">
                    {review.completedTasks.map((t) => (
                      <li key={t.id} className="truncate flex items-center space-x-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                        <span className="truncate">{t.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 text-[11px] italic">No tasks completed today.</p>
                )}
              </div>

              {/* Card 2: Unfinished & Overdue */}
              <div className="p-3 rounded bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-amber-400 uppercase tracking-wider font-bold">
                  <span className="flex items-center space-x-1.5">
                    <AlertTriangle size={12} />
                    <span>Unfinished / Overdue</span>
                  </span>
                  <span>{unfinishedCount + overdueCount}</span>
                </div>
                {review.unfinishedTasks.length > 0 || review.overdueTasks.length > 0 ? (
                  <ul className="space-y-1 text-slate-300">
                    {review.overdueTasks.map((t) => (
                      <li key={t.id} className="truncate flex items-center space-x-1.5 text-rose-300">
                        <span className="w-1 h-1 rounded-full bg-rose-400 shrink-0" />
                        <span className="truncate">{t.text} (overdue)</span>
                      </li>
                    ))}
                    {review.unfinishedTasks.map((t) => (
                      <li key={t.id} className="truncate flex items-center space-x-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                        <span className="truncate">{t.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500 text-[11px] italic">No unfinished tasks due today.</p>
                )}
              </div>

              {/* Card 3: Focus & Projects */}
              <div className="p-3 rounded bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#06B6D4] uppercase tracking-wider font-bold">
                  <span className="flex items-center space-x-1.5">
                    <Clock size={12} />
                    <span>Focus & Projects</span>
                  </span>
                  <span>{focusMin}m</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {review.focusSummary.description}
                </p>
                {review.projectActivity.length > 0 && (
                  <div className="pt-1 border-t border-white/[0.04] space-y-1">
                    {review.projectActivity.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="truncate">{p.name}</span>
                        <span className="font-mono text-cyan-400">{p.progress}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Tactical Recommendations for Tomorrow */}
            {review.recommendations.length > 0 && (
              <div className="pt-2 border-t border-white/[0.04] space-y-2">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold flex items-center space-x-1.5">
                  <Target size={12} className="text-[#06B6D4]" />
                  <span>Tactical Next Actions for Tomorrow</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {review.recommendations.map((r, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded bg-white/[0.02] border border-white/[0.06] space-y-1"
                    >
                      <h5 className="text-[11px] font-mono font-bold text-white tracking-wide truncate">
                        {r.title}
                      </h5>
                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                        {r.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
