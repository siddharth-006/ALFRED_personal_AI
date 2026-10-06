"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  Plus,
  Minus,
  CheckCircle2,
  Trash2,
  Edit2,
  Save,
  X,
  Terminal,
} from "lucide-react";
import { useGoals, GoalType, Goal } from "@/context/GoalContext";
import { playClickSound, playSuccessSound } from "@/utils/audioSystem";

export default function GoalsPage() {
  const { goals, addGoal, updateProgress, deleteGoal, editGoal } = useGoals();

  const [activeTab, setActiveTab] = useState<"ALL" | "Weekly" | "Monthly">("ALL");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalType, setNewGoalType] = useState<GoalType>("Weekly");
  const [newGoalTarget, setNewGoalTarget] = useState("");

  // Edit states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTempTitle, setEditTempTitle] = useState("");
  const [editTempTarget, setEditTempTarget] = useState("");

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim() || !newGoalTarget) return;
    addGoal(newGoalTitle.trim(), newGoalType, Number(newGoalTarget));
    playSuccessSound();
    if (typeof window !== "undefined") {
      import("@/utils/activityBus").then(({ dispatchAlfredActivity }) => {
        dispatchAlfredActivity({
          type: "tool_executing",
          state: "success",
          label: "GOAL INITIALIZED",
          detail: newGoalTitle.trim(),
        });
      });
    }
    setNewGoalTitle("");
    setNewGoalTarget("");
    setIsModalOpen(false);
  };

  const startEdit = (goal: Goal, e: React.MouseEvent) => {
    e.stopPropagation();
    playClickSound();
    setEditingId(goal.id);
    setEditTempTitle(goal.title);
    setEditTempTarget(goal.target.toString());
  };

  const saveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingId && editTempTitle.trim() && editTempTarget) {
      editGoal(editingId, editTempTitle.trim(), Number(editTempTarget));
      playSuccessSound();
      setEditingId(null);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playClickSound();
    if (window.confirm("Remove this goal?")) {
      deleteGoal(id);
    }
  };

  const handleProgressChange = (id: string, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (delta > 0) playSuccessSound();
    else playClickSound();
    updateProgress(id, delta);
  };

  const openAiCommand = (prompt: string) => {
    playClickSound();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("open-command-terminal", {
          detail: { initialCommand: prompt, autoExecute: false },
        })
      );
    }
  };

  // Groupings & Stats
  const weeklyGoals = goals.filter((g) => g.type === "Weekly");
  const monthlyGoals = goals.filter((g) => g.type === "Monthly");

  const completedTotal = goals.filter((g) => g.completed).length;
  const totalGoals = goals.length;
  const overallPercentage =
    totalGoals > 0 ? Math.round((completedTotal / totalGoals) * 100) : 0;

  const filteredGoals = useMemo(() => {
    if (activeTab === "ALL") return goals;
    return goals.filter((g) => g.type === activeTab);
  }, [goals, activeTab]);

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-transparent min-h-screen relative overflow-hidden text-slate-200 select-none">
      {/* Background Ambient Technical Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(225,29,72,0.05),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Editorial Header */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative z-10 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-baseline space-x-3">
            <h1 className="text-2xl md:text-3xl font-header font-bold text-white tracking-tight">
              Goals
            </h1>
            <span className="text-[11px] font-mono text-rose-400 tracking-wider">
              TARGET OBJECTIVES
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Calibrate milestones, track target velocity, and review weekly & monthly progress horizons.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openAiCommand("What are my current goals?")}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-sm bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-rose-500/30 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <Terminal size={12} className="text-rose-400" />
            <span>Ask ALFRED</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsModalOpen(true);
            }}
            className="alfred-btn-primary px-3.5 py-1.5 text-xs font-mono flex items-center space-x-1.5 cursor-pointer shadow-md rounded-sm"
          >
            <Plus size={13} />
            <span>New Goal</span>
          </button>
        </div>
      </header>

      {/* Measurable Objective Trajectories (Asymmetric visual rhythm replacing 4 cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 relative z-10">
        <div className="lg:col-span-8 alfred-panel p-5 border-l-2 border-l-rose-500/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono tracking-widest uppercase text-slate-400">
                Milestone Horizons
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {completedTotal} / {totalGoals} ACHIEVED
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-sm">
                <div className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                  Weekly Sprint Horizon
                </div>
                <div className="text-2xl font-header font-bold text-white mt-1">
                  {weeklyGoals.filter((g) => g.completed).length} <span className="text-xs font-mono text-slate-400 font-normal">/ {weeklyGoals.length} targets</span>
                </div>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-sm">
                <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                  Monthly Macro Horizon
                </div>
                <div className="text-2xl font-header font-bold text-white mt-1">
                  {monthlyGoals.filter((g) => g.completed).length} <span className="text-xs font-mono text-slate-400 font-normal">/ {monthlyGoals.length} targets</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Radial Horizon Completion Ring */}
        <div className="lg:col-span-4 alfred-panel p-5 flex items-center justify-around border-t lg:border-t-0 lg:border-r-2 lg:border-r-rose-500/60">
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-white/[0.08]"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-rose-500"
                strokeDasharray={`${overallPercentage}, 100`}
                strokeWidth="3.2"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="font-header text-sm font-bold text-white">
                {overallPercentage}%
              </span>
              <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400">
                RATE
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
              Total Progress
            </div>
            <div className="text-sm font-mono text-white font-bold">
              {completedTotal} <span className="text-xs text-slate-400 font-normal">of</span> {totalGoals}
            </div>
            <div className="text-[10px] font-mono text-rose-400">
              {totalGoals - completedTotal} active objectives
            </div>
          </div>
        </div>
      </div>

      {/* Main Console & Horizon Filter */}
      <div className="alfred-panel p-5 relative z-10 space-y-5">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
          <div className="flex items-center space-x-1 bg-black/40 p-1 rounded border border-white/[0.08]">
            {(["ALL", "Weekly", "Monthly"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  playClickSound();
                  setActiveTab(tab);
                }}
                className={`px-3 py-1 rounded text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-[#E11D48]/15 border border-[#E11D48]/40 text-white font-bold"
                    : "text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                {tab === "ALL" ? "All Horizons" : `${tab} Objectives`}
              </button>
            ))}
          </div>

          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            {filteredGoals.length} ACTIVE TARGETS
          </span>
        </div>

        {/* Goals Grid */}
        {filteredGoals.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center text-slate-500">
            <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-3 text-slate-600">
              <Target size={22} />
            </div>
            <h4 className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase mb-1">
              NO OBJECTIVES RECORDED
            </h4>
            <p className="text-[11px] font-mono text-slate-500 max-w-sm mb-4">
              Set weekly or monthly target goals to monitor productivity milestones.
            </p>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="alfred-btn-primary px-4 py-1.5 text-xs font-mono"
            >
              + Create Objective
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredGoals.map((goal) => {
              const isEditing = editingId === goal.id;
              const percentage =
                Math.min(100, Math.round((goal.current / goal.target) * 100)) || 0;

              return (
                <div
                  key={goal.id}
                  className={`p-4 rounded border transition-all flex flex-col justify-between ${
                    goal.completed
                      ? "bg-white/[0.01] border-emerald-500/25"
                      : "bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.06] hover:border-white/[0.14]"
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-3 font-mono text-xs">
                      <input
                        type="text"
                        value={editTempTitle}
                        onChange={(e) => setEditTempTitle(e.target.value)}
                        className="alfred-input w-full text-xs font-mono"
                        placeholder="Objective Title"
                        autoFocus
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={editTempTarget}
                          onChange={(e) => setEditTempTarget(e.target.value)}
                          className="alfred-input w-28 text-xs font-mono"
                          placeholder="Target"
                        />
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 cursor-pointer"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase ${
                              goal.type === "Weekly"
                                ? "bg-[#06B6D4]/10 border-[#06B6D4]/25 text-[#06B6D4]"
                                : "bg-[#E11D48]/10 border-[#E11D48]/25 text-[#E11D48]"
                            }`}
                          >
                            {goal.type}
                          </span>
                          {goal.completed ? (
                            <span className="flex items-center space-x-1 text-[10px] font-mono text-emerald-400 font-semibold">
                              <CheckCircle2 size={12} />
                              <span>COMPLETED</span>
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono font-bold text-white">
                              {percentage}%
                            </span>
                          )}
                        </div>

                        <h3
                          className={`text-sm font-header font-bold tracking-wide ${
                            goal.completed
                              ? "text-slate-400 line-through"
                              : "text-white"
                          }`}
                        >
                          {goal.title}
                        </h3>
                      </div>

                      <div className="mt-4 pt-3 border-t border-white/[0.05]">
                        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
                          <span>
                            Progress:{" "}
                            <span className="text-white font-bold">{goal.current}</span> /{" "}
                            {goal.target}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {goal.target - goal.current > 0
                              ? `${goal.target - goal.current} to go`
                              : "Target Met"}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden p-[1px] mb-3">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              goal.completed
                                ? "bg-emerald-400"
                                : "bg-gradient-to-r from-[#06B6D4] to-[#E11D48]"
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>

                        {/* Increment / Decrement & Management Controls */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleProgressChange(goal.id, -1, e)}
                              disabled={goal.current <= 0}
                              className="p-1 rounded bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white cursor-pointer transition-colors"
                              title="Decrement Progress"
                            >
                              <Minus size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleProgressChange(goal.id, 1, e)}
                              className="p-1 rounded bg-[#06B6D4]/15 hover:bg-[#06B6D4]/30 text-[#06B6D4] hover:text-white cursor-pointer transition-colors"
                              title="Increment Progress"
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={(e) => startEdit(goal, e)}
                              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                              title="Modify Goal"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(goal.id, e)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              title="Purge Goal"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Initialize Goal Modal */}
      <AnimatePresence>
        {isModalOpen && (
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
                    INITIALIZE STRATEGIC OBJECTIVE
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddGoal} className="p-5 space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                    Objective Title:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Solve 20 LeetCode Problems..."
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    className="alfred-input w-full"
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                      Target Horizon:
                    </label>
                    <select
                      value={newGoalType}
                      onChange={(e) => setNewGoalType(e.target.value as GoalType)}
                      className="alfred-input w-full bg-[#0B0E17]"
                    >
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                      Target Units:
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      placeholder="e.g. 20"
                      value={newGoalTarget}
                      onChange={(e) => setNewGoalTarget(e.target.value)}
                      className="alfred-input w-full"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.08] flex space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 alfred-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newGoalTitle.trim() || !newGoalTarget}
                    className="flex-1 alfred-btn-primary"
                  >
                    <Plus size={13} />
                    <span>Commit Target</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
