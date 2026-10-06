"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarRange,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Sparkles,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import type { WeeklyReview } from "../../electron/agent/review/weekly-review.types";
import { playClickSound } from "@/utils/audioSystem";

interface WeeklyReviewPanelProps {
  onExecuteCommand?: (cmd: string) => void;
}

export default function WeeklyReviewPanel({ onExecuteCommand }: WeeklyReviewPanelProps) {
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const fetchReview = useCallback(async () => {
    if (typeof window !== "undefined" && window.electron?.weeklyReview?.get) {
      try {
        const data = await window.electron.weeklyReview.get();
        setReview(data);
      } catch (err) {
        console.error("Failed to load weekly review:", err);
      }
    }
  }, []);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  if (isDismissed || !review) return null;

  const counts = review.counts;
  const focusHours = (counts.totalFocusMinutes / 60).toFixed(1);

  return (
    <div className="alfred-panel rounded-sm border-l-2 border-l-[#06B6D4] bg-[#07090E]/95 backdrop-blur-xl border border-white/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.6)] relative z-20 overflow-hidden">
      {/* Top Banner Bar */}
      <div className="p-4 flex items-center justify-between gap-4 border-b border-white/[0.06] bg-white/[0.01]">
        <div className="flex items-center space-x-3.5 min-w-0">
          <div className="p-2 rounded-sm bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4] shrink-0">
            <CalendarRange size={16} />
          </div>
          <div className="space-y-0.5 truncate">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono tracking-widest text-[#06B6D4] uppercase font-bold">
                WEEKLY INTELLIGENCE // {review.timeContext.currentWeekStart} TO {review.timeContext.currentWeekEnd}
              </span>
            </div>
            <h4 className="text-xs font-mono font-bold text-white tracking-wide truncate">
              {review.isEmpty
                ? "Weekly Overview Ready (No focus sessions or completed tasks recorded)"
                : `Week in Review: ${counts.completedThisWeekTasks} tasks completed • ${focusHours}h focus logged`}
            </h4>
          </div>
        </div>

        {/* Quick summary metrics & controls */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="hidden sm:flex items-center space-x-3 text-xs font-mono pr-2">
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> {counts.completedThisWeekTasks}
            </span>
            <span className="text-[#06B6D4] font-bold flex items-center gap-1">
              <Clock size={13} /> {focusHours}h
            </span>
            {counts.overdueTasks > 0 && (
              <span className="text-amber-400 font-bold">
                {counts.overdueTasks} Overdue
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsExpanded((prev) => !prev);
            }}
            className="p-1.5 rounded-sm bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isExpanded ? "Collapse" : "Expand Details"}
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsDismissed(true);
            }}
            className="p-1.5 rounded-sm bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Dismiss Panel"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Expanded Intelligence Body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-5 space-y-5 border-t border-white/[0.04] bg-black/40 text-xs font-mono"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Completed Tasks */}
              <div className="p-3.5 rounded-sm bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                  <CheckCircle2 size={14} />
                  <span>COMPLETED WORK ({review.completedTasks.length})</span>
                </div>
                {review.completedTasks.length === 0 ? (
                  <p className="text-slate-500 italic">No tasks completed this week.</p>
                ) : (
                  <ul className="space-y-1 text-slate-300">
                    {review.completedTasks.slice(0, 4).map((t) => (
                      <li key={t.id} className="truncate">
                        • {t.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Focus Time */}
              <div className="p-3.5 rounded-sm bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center space-x-2 text-[#06B6D4] font-bold">
                  <Clock size={14} />
                  <span>FOCUS METRICS</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {review.focusSummary.description}
                </p>
                <div className="text-[11px] text-slate-400">
                  Primary workspace: {review.focusSummary.topWorkspace || "DSA"}
                </div>
              </div>

              {/* Active Projects */}
              <div className="p-3.5 rounded-sm bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex items-center space-x-2 text-white font-bold">
                  <TrendingUp size={14} />
                  <span>ACTIVE PROJECTS</span>
                </div>
                {review.projectActivity.length === 0 ? (
                  <p className="text-slate-500 italic">No active projects.</p>
                ) : (
                  <ul className="space-y-1 text-slate-300">
                    {review.projectActivity.slice(0, 3).map((p) => (
                      <li key={p.id} className="flex justify-between truncate">
                        <span>• {p.name}</span>
                        <span className="text-[#06B6D4] font-bold">{p.progress}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Strategic Recommendations */}
            {review.recommendations.length > 0 && (
              <div className="p-3.5 rounded-sm bg-[#06B6D4]/5 border border-[#06B6D4]/20 space-y-2">
                <div className="flex items-center space-x-2 text-[#06B6D4] font-bold">
                  <Sparkles size={14} />
                  <span>STRATEGIC RECOMMENDATIONS</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                  {review.recommendations.map((r) => (
                    <div key={r.id} className="p-2 rounded bg-black/40 border border-white/[0.04]">
                      <div className="font-bold text-white text-[11px]">{r.title}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{r.rationale}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  if (onExecuteCommand) {
                    onExecuteCommand("Plan my week");
                  } else if (typeof window !== "undefined") {
                    window.dispatchEvent(
                      new CustomEvent("open-command-terminal", { detail: { prompt: "Plan my week" } })
                    );
                  }
                }}
                className="px-3.5 py-1.5 rounded-sm bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4] text-[#06B6D4] hover:text-white font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
              >
                <span>Plan Upcoming Week</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
