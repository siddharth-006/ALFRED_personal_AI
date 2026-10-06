"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  Clock,
  Briefcase,
  Target,
  Layers,
  Activity,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import AlfredEmblem from "./AlfredEmblem";
import { useTasks } from "@/context/TaskContext";
import { useFocus } from "@/context/FocusContext";
import { useProjects } from "@/context/ProjectContext";
import { useGoals } from "@/context/GoalContext";
import { useWorkspaces } from "@/context/WorkspaceContext";
import {
  getRecordedActivities,
  subscribeToAlfredActivity,
  AlfredActivityEventDetail,
} from "@/utils/activityBus";
import { playClickSound, playHoverSound } from "@/utils/audioSystem";

type TimeRange = "today" | "7d" | "30d" | "all";

export default function AnalyticsPage() {
  const router = useRouter();

  // Real context data sources
  const { tasks } = useTasks();
  const { stats: focusStats } = useFocus();
  const { projects } = useProjects();
  const { goals } = useGoals();
  const { workspaces, launchWorkspace } = useWorkspaces();

  // State
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [activities, setActivities] = useState<AlfredActivityEventDetail[]>([]);

  // Load persistent activities & subscribe to real-time events
  useEffect(() => {
    setActivities(getRecordedActivities());

    const unsubscribe = subscribeToAlfredActivity((newEvent) => {
      setActivities((prev) => [newEvent, ...prev.filter((a) => a.timestamp !== newEvent.timestamp)].slice(0, 100));
    });

    return () => unsubscribe();
  }, []);

  // Time boundary timestamps based on timeRange
  const now = Date.now();
  const timeThreshold = useMemo(() => {
    if (timeRange === "today") {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return startOfToday.getTime();
    }
    if (timeRange === "7d") return now - 7 * 24 * 60 * 60 * 1000;
    if (timeRange === "30d") return now - 30 * 24 * 60 * 60 * 1000;
    return 0; // "all"
  }, [timeRange, now]);

  // =========================================================================
  // 1. TASK ANALYTICS (Real data from TaskContext)
  // =========================================================================
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => set.add(t.category));
    return Array.from(set);
  }, [tasks]);

  const filteredTasksByCategory = useMemo(() => {
    if (selectedCategory === "ALL") return tasks;
    return tasks.filter((t) => t.category.toLowerCase() === selectedCategory.toLowerCase());
  }, [tasks, selectedCategory]);

  const taskMetrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.completed).length;
    const pending = total - completed;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Filtered by time range if task has completedAt
    const completedInWindow = tasks.filter(
      (t) => t.completed && (!t.completedAt || t.completedAt >= timeThreshold)
    ).length;

    // Category breakdown
    const categoryStats = allCategories.map((cat) => {
      const catTasks = tasks.filter((t) => t.category === cat);
      const catCompleted = catTasks.filter((t) => t.completed).length;
      return {
        category: cat,
        total: catTasks.length,
        completed: catCompleted,
        rate: catTasks.length > 0 ? Math.round((catCompleted / catTasks.length) * 100) : 0,
      };
    });

    return {
      total,
      completed,
      pending,
      rate,
      completedInWindow,
      categoryStats,
    };
  }, [tasks, allCategories, timeThreshold]);

  // =========================================================================
  // 2. FOCUS ANALYTICS (Real data from FocusContext)
  // =========================================================================
  const focusMetrics = useMemo(() => {
    const todayMin = focusStats.todayFocusMinutes || 0;
    const totalMin = focusStats.totalFocusMinutes || 0;
    const sessionsCount = focusStats.completedSessionsCount || 0;
    const avgSession = sessionsCount > 0 ? Math.round(totalMin / sessionsCount) : 0;

    const history = focusStats.sessionHistory || [];
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const sessionsThisWeek = history.filter((s) => s.timestamp >= oneWeekAgo);
    const weeklyMinutes = sessionsThisWeek.reduce((acc, s) => acc + s.durationMinutes, 0);

    // Filter history by time range
    const filteredHistory = history.filter((s) => s.timestamp >= timeThreshold);

    return {
      todayMin,
      totalMin,
      sessionsCount,
      avgSession,
      weeklyMinutes: weeklyMinutes > 0 ? weeklyMinutes : todayMin,
      history: filteredHistory,
      rawHistoryCount: history.length,
    };
  }, [focusStats, timeThreshold, now]);

  // =========================================================================
  // 3. PROJECT ANALYTICS (Real data from ProjectContext)
  // =========================================================================
  const projectMetrics = useMemo(() => {
    const total = projects.length;
    const active = projects.filter((p) => p.status === "In Progress").length;
    const completed = projects.filter((p) => p.status === "Completed").length;
    const notStarted = projects.filter((p) => p.status === "Not Started").length;
    const totalProgress = projects.reduce((acc, p) => acc + p.progress, 0);
    const avgProgress = total > 0 ? Math.round(totalProgress / total) : 0;

    return {
      total,
      active,
      completed,
      notStarted,
      avgProgress,
    };
  }, [projects]);

  // =========================================================================
  // 4. GOAL ANALYTICS (Real data from GoalContext)
  // =========================================================================
  const goalMetrics = useMemo(() => {
    const total = goals.length;
    const weekly = goals.filter((g) => g.type === "Weekly").length;
    const monthly = goals.filter((g) => g.type === "Monthly").length;
    const completed = goals.filter((g) => g.completed).length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      weekly,
      monthly,
      completed,
      rate,
    };
  }, [goals]);

  // =========================================================================
  // 5. WORKSPACE ACTIVITY (Real data from WorkspaceContext)
  // =========================================================================
  const workspaceMetrics = useMemo(() => {
    const total = workspaces.length;
    const totalLaunches = workspaces.reduce((acc, w) => acc + (w.launchCount || 0), 0);
    const sortedByLaunch = [...workspaces].sort((a, b) => (b.launchCount || 0) - (a.launchCount || 0));
    const mostLaunched = sortedByLaunch[0]?.launchCount > 0 ? sortedByLaunch[0] : null;

    // Recently launched
    const launchedWorkspaces = workspaces.filter((w) => w.lastLaunched !== null);
    launchedWorkspaces.sort(
      (a, b) => new Date(b.lastLaunched!).getTime() - new Date(a.lastLaunched!).getTime()
    );
    const recentlyLaunched = launchedWorkspaces[0] || null;

    return {
      total,
      totalLaunches,
      mostLaunched,
      recentlyLaunched,
      list: workspaces,
    };
  }, [workspaces]);

  // =========================================================================
  // 6. 7-DAY ACTIVITY HISTORY (Calculated from real recorded activities)
  // =========================================================================
  const sevenDayBreakdown = useMemo(() => {
    // Generate dates for the last 7 days (from today backward)
    const days: { dateKey: string; label: string; count: number; dayName: string }[] = [];
    const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split("T")[0];
      const dayName = dayNames[d.getDay()];
      const label = `${d.getMonth() + 1}/${d.getDate()}`;

      // Count real activities matching this dateKey
      const count = activities.filter((act) => {
        if (!act.timestamp) return false;
        const actDateKey = new Date(act.timestamp).toISOString().split("T")[0];
        return actDateKey === dateKey;
      }).length;

      days.push({ dateKey, label, count, dayName });
    }

    return days;
  }, [activities]);

  const maxDayCount = useMemo(() => {
    const counts = sevenDayBreakdown.map((d) => d.count);
    const max = Math.max(...counts, 1);
    return max;
  }, [sevenDayBreakdown]);

  // Filtered activity stream
  const filteredActivities = useMemo(() => {
    let result = activities.filter((a) => (a.timestamp ? a.timestamp >= timeThreshold : true));
    if (selectedDayKey) {
      result = result.filter((a) => {
        if (!a.timestamp) return false;
        return new Date(a.timestamp).toISOString().split("T")[0] === selectedDayKey;
      });
    }
    return result;
  }, [activities, timeThreshold, selectedDayKey]);

  return (
    <div className="flex-1 min-h-screen bg-[#07090E] text-slate-100 p-6 md:p-8 space-y-8 select-none relative overflow-y-auto">
      {/* Background Ambience & Technical Grid */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(225,29,72,0.06),transparent)]" />
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* =====================================================================
          HEADER & TELEMETRY BAR
          ===================================================================== */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div className="flex items-center space-x-4">
          <AlfredEmblem size={44} pulsing={true} />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono tracking-widest text-[#E11D48] uppercase font-bold">
                SYSTEM TELEMETRY // METRICS
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
              <span className="text-[9px] font-mono text-emerald-400 font-semibold tracking-wider uppercase">
                VERIFIED REAL DATA
              </span>
            </div>
            <h1 className="font-header text-3xl font-extrabold tracking-wider text-white uppercase mt-0.5">
              PERSONAL ANALYTICS
            </h1>
            <p className="text-xs text-slate-400 font-sans">
              Authentic productivity telemetry derived from ALFRED operating state. Zero fabricated data.
            </p>
          </div>
        </div>

        {/* Time Range Filter Pills */}
        <div className="flex items-center bg-black/60 border border-white/[0.08] p-1 rounded-xl">
          {(
            [
              { id: "today", label: "TODAY" },
              { id: "7d", label: "7 DAYS" },
              { id: "30d", label: "30 DAYS" },
              { id: "all", label: "ALL TIME" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                playClickSound();
                setTimeRange(item.id);
                setSelectedDayKey(null);
              }}
              onMouseEnter={() => playHoverSound()}
              className={`px-3.5 py-1.5 text-xs font-mono tracking-wider font-semibold rounded-lg transition-all cursor-pointer ${
                timeRange === item.id
                  ? "bg-[#E11D48] text-white shadow-[0_0_12px_rgba(225,29,72,0.4)]"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          TOP-LEVEL METRIC TILES (Authentic High-Signal Readouts)
          ===================================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
        {/* Metric 1: Tasks Rate */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] relative overflow-hidden group hover:border-[#E11D48]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
              TASK COMPLETION
            </span>
            <CheckSquare size={16} className="text-[#E11D48]" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="font-header text-3xl font-extrabold text-white tracking-wide">
              {taskMetrics.rate}%
            </span>
            <span className="text-xs font-mono text-slate-400">
              ({taskMetrics.completed} / {taskMetrics.total})
            </span>
          </div>
          <div className="mt-2 w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#E11D48] to-[#06B6D4] transition-all duration-500"
              style={{ width: `${taskMetrics.rate}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Focus Minutes */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] relative overflow-hidden group hover:border-[#06B6D4]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
              FOCUS TIME
            </span>
            <Clock size={16} className="text-[#06B6D4]" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="font-header text-3xl font-extrabold text-white tracking-wide">
              {timeRange === "today" ? focusMetrics.todayMin : focusMetrics.totalMin}m
            </span>
            <span className="text-xs font-mono text-slate-400">
              {timeRange === "today" ? "TODAY" : "ACCUMULATED"}
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-400 mt-2">
            {focusMetrics.sessionsCount} session{focusMetrics.sessionsCount !== 1 ? "s" : ""} completed
          </p>
        </div>

        {/* Metric 3: Active Projects */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] relative overflow-hidden group hover:border-[#E11D48]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
              ACTIVE PROJECTS
            </span>
            <Briefcase size={16} className="text-[#E11D48]" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="font-header text-3xl font-extrabold text-white tracking-wide">
              {projectMetrics.active}
            </span>
            <span className="text-xs font-mono text-slate-400">/ {projectMetrics.total} TOTAL</span>
          </div>
          <p className="text-[10px] font-mono text-slate-400 mt-2">
            Avg Progress: <span className="text-white font-semibold">{projectMetrics.avgProgress}%</span>
          </p>
        </div>

        {/* Metric 4: Goals Completed */}
        <div className="p-4 rounded-xl bg-black/40 border border-white/[0.08] relative overflow-hidden group hover:border-[#06B6D4]/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
              GOAL ATTAINMENT
            </span>
            <Target size={16} className="text-[#06B6D4]" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="font-header text-3xl font-extrabold text-white tracking-wide">
              {goalMetrics.rate}%
            </span>
            <span className="text-xs font-mono text-slate-400">
              ({goalMetrics.completed} / {goalMetrics.total})
            </span>
          </div>
          <p className="text-[10px] font-mono text-slate-400 mt-2">
            {goalMetrics.weekly} Weekly · {goalMetrics.monthly} Monthly
          </p>
        </div>
      </div>

      {/* =====================================================================
          SECTION: 7-DAY RECORDED ACTIVITY VISUALIZATION (HONEST HISTORICAL STREAM)
          ===================================================================== */}
      <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.08] relative z-10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <Activity size={16} className="text-[#E11D48]" />
              <h2 className="font-header text-base font-bold text-white tracking-wider uppercase">
                7-DAY ACTIVITY TELEMETRY
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Click a day to inspect recorded events. If a day has no activity, &quot;NO DATA&quot; is shown honestly.
            </p>
          </div>

          {selectedDayKey && (
            <button
              type="button"
              onClick={() => setSelectedDayKey(null)}
              className="text-xs font-mono text-[#06B6D4] hover:underline flex items-center space-x-1"
            >
              <span>Showing filtered date: {selectedDayKey}</span>
              <span className="text-slate-400 font-bold ml-1">✕ Reset</span>
            </button>
          )}
        </div>

        {/* 7-Day Visual Bars */}
        <div className="grid grid-cols-7 gap-2 pt-2">
          {sevenDayBreakdown.map((item) => {
            const isSelected = selectedDayKey === item.dateKey;
            const barHeightPct = item.count > 0 ? Math.max(18, Math.round((item.count / maxDayCount) * 100)) : 6;

            return (
              <button
                key={item.dateKey}
                type="button"
                onClick={() => {
                  playClickSound();
                  setSelectedDayKey(isSelected ? null : item.dateKey);
                }}
                onMouseEnter={() => playHoverSound()}
                className={`p-3 rounded-xl border flex flex-col items-center justify-between transition-all cursor-pointer h-32 ${
                  isSelected
                    ? "bg-[#E11D48]/15 border-[#E11D48] shadow-[0_0_15px_rgba(225,29,72,0.3)]"
                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.15]"
                }`}
              >
                <div className="text-[10px] font-mono text-slate-400 font-semibold">{item.dayName}</div>
                <div className="text-[9px] font-mono text-slate-400">{item.label}</div>

                {/* Vertical Bar */}
                <div className="w-full flex-1 flex items-end justify-center py-1">
                  <div
                    className={`w-4 rounded-t transition-all duration-300 ${
                      item.count > 0
                        ? isSelected
                          ? "bg-[#E11D48] shadow-[0_0_10px_#E11D48]"
                          : "bg-[#06B6D4]"
                        : "bg-white/[0.06]"
                    }`}
                    style={{ height: `${barHeightPct}%` }}
                  />
                </div>

                <div className="text-[10px] font-mono font-bold">
                  {item.count > 0 ? (
                    <span className="text-white">{item.count} evt</span>
                  ) : (
                    <span className="text-slate-400 text-[8px] font-semibold">NO DATA</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          MIDDLE GRID: TASK ANALYTICS + FOCUS ANALYTICS
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
        
        {/* TASK ANALYTICS (7 Columns) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-black/40 border border-white/[0.08] space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckSquare size={18} className="text-[#E11D48]" />
              <h2 className="font-header text-lg font-bold text-white tracking-wider uppercase">
                TASK BREAKDOWN &amp; CATEGORIES
              </h2>
            </div>
            <Link
              href="/tasks"
              className="text-xs font-mono text-[#E11D48] hover:text-white flex items-center space-x-1 group"
            >
              <span>MANAGE TASKS</span>
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Interactive Category Filter Pills */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setSelectedCategory("ALL");
              }}
              className={`px-3 py-1 text-xs font-mono rounded-lg border transition-all ${
                selectedCategory === "ALL"
                  ? "bg-[#E11D48] text-white border-[#E11D48]"
                  : "bg-white/[0.02] text-slate-400 border-white/[0.06] hover:text-white"
              }`}
            >
              ALL ({tasks.length})
            </button>
            {allCategories.map((cat) => {
              const catTotal = tasks.filter((t) => t.category === cat).length;
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setSelectedCategory(cat);
                  }}
                  className={`px-3 py-1 text-xs font-mono rounded-lg border transition-all ${
                    isSelected
                      ? "bg-[#E11D48] text-white border-[#E11D48]"
                      : "bg-white/[0.02] text-slate-400 border-white/[0.06] hover:text-white"
                  }`}
                >
                  {cat} ({catTotal})
                </button>
              );
            })}
          </div>

          {/* Category Progress Rails */}
          <div className="space-y-3 pt-2">
            {taskMetrics.categoryStats.map((item) => (
              <div key={item.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-sans font-medium text-slate-300">{item.category}</span>
                  <span className="font-mono text-slate-400">
                    <span className="text-white font-bold">{item.completed}</span> / {item.total} completed ({item.rate}%)
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#E11D48] to-[#BE123C] rounded-full transition-all duration-300"
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Tasks in Current Filter (Real Task Listing) */}
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              DISPLAYING {filteredTasksByCategory.length} TASK{filteredTasksByCategory.length !== 1 ? "S" : ""}:
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
              {filteredTasksByCategory.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        t.completed ? "bg-[#10B981]" : "bg-[#E11D48]"
                      }`}
                    />
                    <span
                      className={`truncate font-sans ${
                        t.completed ? "line-through text-slate-400" : "text-slate-200"
                      }`}
                    >
                      {t.text}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-slate-400 shrink-0 ml-2">
                    {t.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FOCUS ANALYTICS (5 Columns) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-black/40 border border-white/[0.08] space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock size={18} className="text-[#06B6D4]" />
              <h2 className="font-header text-lg font-bold text-white tracking-wider uppercase">
                FOCUS TELEMETRY
              </h2>
            </div>
            <Link
              href="/"
              className="text-xs font-mono text-[#06B6D4] hover:text-white flex items-center space-x-1 group"
            >
              <span>CORE TIMER</span>
              <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {/* Quick Focus Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-[10px] font-mono text-slate-400 uppercase">TODAY</div>
              <div className="text-2xl font-header font-bold text-white mt-1">
                {focusMetrics.todayMin} <span className="text-xs text-slate-400 font-mono">MIN</span>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-[10px] font-mono text-slate-400 uppercase">THIS WEEK</div>
              <div className="text-2xl font-header font-bold text-white mt-1">
                {focusMetrics.weeklyMinutes} <span className="text-xs text-slate-400 font-mono">MIN</span>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-[10px] font-mono text-slate-400 uppercase">AVG DURATION</div>
              <div className="text-2xl font-header font-bold text-white mt-1">
                {focusMetrics.avgSession} <span className="text-xs text-slate-400 font-mono">MIN</span>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-[10px] font-mono text-slate-400 uppercase">ALL-TIME TOTAL</div>
              <div className="text-2xl font-header font-bold text-white mt-1">
                {focusMetrics.totalMin} <span className="text-xs text-slate-400 font-mono">MIN</span>
              </div>
            </div>
          </div>

          {/* Focus Session History */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              RECENT COMPLETED SESSIONS:
            </div>

            {focusMetrics.history.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {focusMetrics.history.slice(0, 5).map((sess) => (
                  <div
                    key={sess.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs font-mono"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4]" />
                      <span className="text-white font-semibold">{sess.durationMinutes} min session</span>
                    </div>
                    <span className="text-slate-400 text-[10px]">{sess.completedAt}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08] text-center space-y-1">
                <p className="text-xs font-mono text-slate-400">NO RECORDED SESSIONS YET</p>
                <p className="text-[10px] text-slate-400">
                  Focus statistics will log sessions here as you complete countdown cycles on the Dashboard.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          BOTTOM SECTION: PROJECTS + GOALS + WORKSPACES
          ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
        
        {/* PROJECTS (Col 1) */}
        <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Briefcase size={16} className="text-[#E11D48]" />
              <h2 className="font-header text-base font-bold text-white tracking-wider uppercase">
                PROJECT STATUS
              </h2>
            </div>
            <Link
              href="/projects"
              className="text-xs font-mono text-[#E11D48] hover:text-white flex items-center space-x-1"
            >
              <span>VIEW ALL</span>
              <ArrowRight size={10} />
            </Link>
          </div>

          <div className="space-y-3">
            {projects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => router.push("/projects")}
                className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.15] transition-all cursor-pointer space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-sans font-semibold text-white group-hover:text-[#E11D48] transition-colors truncate">
                    {proj.name}
                  </span>
                  <span className="text-[10px] font-mono text-[#E11D48] font-bold">
                    {proj.progress}%
                  </span>
                </div>
                <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#E11D48] rounded-full"
                    style={{ width: `${proj.progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>{proj.category}</span>
                  <span>{proj.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GOALS (Col 2) */}
        <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target size={16} className="text-[#06B6D4]" />
              <h2 className="font-header text-base font-bold text-white tracking-wider uppercase">
                GOAL ATTAINMENT
              </h2>
            </div>
            <Link
              href="/goals"
              className="text-xs font-mono text-[#06B6D4] hover:text-white flex items-center space-x-1"
            >
              <span>VIEW ALL</span>
              <ArrowRight size={10} />
            </Link>
          </div>

          <div className="space-y-3">
            {goals.map((g) => {
              const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
              return (
                <div
                  key={g.id}
                  onClick={() => router.push("/goals")}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.15] transition-all cursor-pointer space-y-2 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-sans font-semibold text-white group-hover:text-[#06B6D4] transition-colors truncate">
                      {g.title}
                    </span>
                    <span className="text-[10px] font-mono text-[#06B6D4] font-bold">
                      {g.current}/{g.target} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#06B6D4] rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>{g.type}</span>
                    <span className={g.completed ? "text-[#10B981]" : "text-slate-400"}>
                      {g.completed ? "COMPLETED" : "IN PROGRESS"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* WORKSPACES (Col 3) */}
        <div className="p-5 rounded-2xl bg-black/40 border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers size={16} className="text-[#E11D48]" />
              <h2 className="font-header text-base font-bold text-white tracking-wider uppercase">
                WORKSPACE USAGE
              </h2>
            </div>
            <Link
              href="/workspaces"
              className="text-xs font-mono text-[#E11D48] hover:text-white flex items-center space-x-1"
            >
              <span>MANAGE</span>
              <ArrowRight size={10} />
            </Link>
          </div>

          <div className="space-y-3">
            {workspaceMetrics.list.map((ws) => (
              <div
                key={ws.id}
                className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between text-xs"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-sans font-semibold text-white truncate">{ws.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                    {ws.launchCount} launch{ws.launchCount !== 1 ? "es" : ""} · {ws.applications.join(", ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    launchWorkspace(ws.id);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-[#E11D48] text-slate-300 hover:text-white text-[10px] font-mono tracking-wider transition-all cursor-pointer shrink-0"
                >
                  LAUNCH
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================================
          PERSISTED ACTIVITY STREAM (Full Log with Real Timestamps)
          ===================================================================== */}
      <div className="p-6 rounded-2xl bg-black/40 border border-white/[0.08] relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity size={18} className="text-[#06B6D4]" />
            <h2 className="font-header text-lg font-bold text-white tracking-wider uppercase">
              PERSISTED ACTIVITY EVENT STREAM
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {filteredActivities.length} REAL EVENT{filteredActivities.length !== 1 ? "S" : ""}
          </span>
        </div>

        {filteredActivities.length > 0 ? (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
            {filteredActivities.map((act, idx) => {
              const timeStr = act.timestamp
                ? new Date(act.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                : "--:--:--";
              const dateStr = act.timestamp
                ? new Date(act.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })
                : "";

              return (
                <div
                  key={`${act.timestamp || idx}-${idx}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs font-mono group hover:bg-white/[0.04] transition-all"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="text-slate-400 text-[10px] shrink-0 font-semibold">
                      {dateStr} {timeStr}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[#E11D48] font-bold text-[10px] shrink-0">
                      {act.label || act.type}
                    </span>
                    <span className="text-slate-300 font-sans truncate">
                      {act.detail || "System action processed"}
                    </span>
                  </div>
                  {act.state && (
                    <span className="text-[9px] uppercase tracking-wider text-emerald-400 shrink-0 ml-2">
                      ● {act.state}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-white/[0.02] border border-dashed border-white/[0.08] text-center space-y-2">
            <AlertCircle size={24} className="mx-auto text-slate-400" />
            <h3 className="font-header text-sm font-bold text-white tracking-widest uppercase">
              NO HISTORICAL DATA
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              ALFRED will begin building your activity history from this point forward. Activities occur when you complete tasks, launch workspaces, complete focus sessions, or run AI directives.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
