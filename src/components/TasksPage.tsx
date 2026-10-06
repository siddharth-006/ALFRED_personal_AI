"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Circle,
  Save,
  X,
  Search,
  Filter,
  CheckSquare,
  Terminal,
} from "lucide-react";
import { useTasks, TaskCategory, Task } from "@/context/TaskContext";
import { playClickSound, playHoverSound, playSuccessSound } from "@/utils/audioSystem";

const CATEGORIES: TaskCategory[] = ["DSA", "Data Science", "College", "Hackathon", "Personal"];

export default function TasksPage() {
  const { tasks, addTask, toggleTask, deleteTask, editTask } = useTasks();

  const allCategories = Array.from(
    new Set([...CATEGORIES, ...tasks.map((t) => t.category)])
  );

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<"all" | "active" | "completed">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // New task creation
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<string>("Personal");
  const [customNewCategory, setCustomNewCategory] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Edit task
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTempText, setEditTempText] = useState("");
  const [editTempCategory, setEditTempCategory] = useState<string>("Personal");
  const [customEditCategory, setCustomEditCategory] = useState("");

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const finalCategory =
      newTaskCategory === "Custom"
        ? customNewCategory.trim() || "Personal"
        : newTaskCategory;
    addTask(newTaskText.trim(), finalCategory);
    playSuccessSound();
    if (typeof window !== "undefined") {
      import("@/utils/activityBus").then(({ dispatchAlfredActivity }) => {
        dispatchAlfredActivity({
          type: "task_created",
          state: "success",
          label: "TASK CREATED",
          detail: newTaskText.trim(),
        });
      });
    }
    setNewTaskText("");
    setCustomNewCategory("");
    setNewTaskCategory("Personal");
    setIsCreateModalOpen(false);
  };

  const startEdit = (task: Task) => {
    playClickSound();
    setEditingId(task.id);
    setEditTempText(task.text);
    if (allCategories.includes(task.category)) {
      setEditTempCategory(task.category);
      setCustomEditCategory("");
    } else {
      setEditTempCategory("Custom");
      setCustomEditCategory(task.category);
    }
  };

  const saveEdit = () => {
    if (editingId && editTempText.trim()) {
      const finalCategory =
        editTempCategory === "Custom"
          ? customEditCategory.trim() || "Personal"
          : editTempCategory;
      editTask(editingId, editTempText.trim(), finalCategory);
      playSuccessSound();
      setEditingId(null);
    }
  };

  const handleTaskToggle = (taskId: string, wasCompleted: boolean) => {
    if (!wasCompleted) {
      playSuccessSound();
      if (typeof window !== "undefined") {
        import("@/utils/activityBus").then(({ dispatchAlfredActivity }) => {
          dispatchAlfredActivity({
            type: "task_completed",
            state: "success",
            label: "TASK COMPLETED",
          });
        });
      }
    } else {
      playClickSound();
    }
    toggleTask(taskId);
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

  const completedCount = tasks.filter((t) => t.completed).length;
  const pendingCount = tasks.length - completedCount;
  const completionPercentage =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  // Filtered tasks computation
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Tab filter
      if (activeTab === "active" && task.completed) return false;
      if (activeTab === "completed" && !task.completed) return false;

      // Category filter
      if (
        selectedCategory !== "ALL" &&
        task.category.toLowerCase() !== selectedCategory.toLowerCase()
      ) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          task.text.toLowerCase().includes(query) ||
          task.category.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [tasks, activeTab, selectedCategory, searchQuery]);

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-transparent min-h-screen relative overflow-hidden text-slate-200 select-none">
      {/* Background Ambient Technical Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(6,182,212,0.05),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Header with editorial typography and active workload highlight */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative z-10 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-baseline space-x-3">
            <h1 className="text-2xl md:text-3xl font-header font-bold text-white tracking-tight">
              Tasks
            </h1>
            <span className="text-[11px] font-mono text-cyan-400 tracking-wider">
              YOUR CURRENT WORKLOAD
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Prioritize execution directives, track completion velocity, and assign focus areas.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openAiCommand("Create a task called ")}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-sm bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-cyan-500/30 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <Terminal size={12} className="text-cyan-400" />
            <span>Ask ALFRED</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              setIsCreateModalOpen(true);
            }}
            className="alfred-btn-primary px-3.5 py-1.5 text-xs font-mono flex items-center space-x-1.5 cursor-pointer shadow-md rounded-sm"
          >
            <Plus size={13} />
            <span>Add Task</span>
          </button>
        </div>
      </header>

      {/* Asymmetric Workload Hero Banner (Oversized numbers & radial rhythm instead of 4 generic cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 relative z-10">
        {/* Left: Oversized Active Task Anchor */}
        <div className="lg:col-span-8 alfred-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-l-2 border-l-cyan-500/70">
          <div className="flex items-baseline space-x-5">
            <div className="font-header text-5xl md:text-6xl font-black text-white tracking-tighter">
              {String(pendingCount).padStart(2, "0")}
            </div>
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold">
                ACTIVE DIRECTIVES
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5 max-w-sm">
                {pendingCount === 0
                  ? "All planned directives completed. Ready for next workload input."
                  : `${pendingCount} actionable items remaining across ${allCategories.length} workstation categories.`}
              </p>
            </div>
          </div>

          {/* Quick Category Horizon Strip */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {CATEGORIES.slice(0, 3).map((cat) => {
              const count = tasks.filter((t) => !t.completed && t.category === cat).length;
              return (
                <div
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? "ALL" : cat)}
                  className={`px-3 py-1.5 rounded-sm border cursor-pointer transition-all ${
                    selectedCategory === cat
                      ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300"
                      : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-white"
                  }`}
                >
                  <div className="text-[9px] font-mono tracking-widest uppercase">{cat}</div>
                  <div className="text-xs font-mono font-bold text-white mt-0.5">{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Radial Workload Completion Gauge */}
        <div className="lg:col-span-4 alfred-panel p-5 flex items-center justify-around border-t lg:border-t-0 lg:border-r-2 lg:border-r-emerald-500/60">
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
                className="text-emerald-400"
                strokeDasharray={`${completionPercentage}, 100`}
                strokeWidth="3.2"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="font-header text-sm font-bold text-white">
                {completionPercentage}%
              </span>
              <span className="font-mono text-[8px] uppercase tracking-wider text-slate-400">
                DONE
              </span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
              Velocity Summary
            </div>
            <div className="text-sm font-mono text-emerald-400 font-bold">
              {completedCount} <span className="text-xs text-slate-400 font-normal">of</span> {tasks.length} <span className="text-xs text-slate-400 font-normal">completed</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500">
              {pendingCount} remaining today
            </div>
          </div>
        </div>
      </div>

      {/* Main Console Container */}
      <div className="alfred-panel p-5 relative z-10 space-y-4">
        {/* Controls: Search, Tabs, Categories */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          {/* Status Tabs */}
          <div className="flex items-center space-x-1 bg-black/40 p-1 rounded border border-white/[0.08]">
            {(["all", "active", "completed"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  playClickSound();
                  setActiveTab(tab);
                }}
                className={`px-3 py-1 rounded text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === tab
                    ? "bg-[#06B6D4]/15 border border-[#06B6D4]/40 text-white font-bold"
                    : "text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Bar & Category Filter */}
          <div className="flex items-center gap-2.5 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search directives by name or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded bg-black/40 border border-white/[0.08] focus:border-[#06B6D4] text-xs font-mono text-white placeholder-slate-500 outline-none"
              />
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <Filter size={13} className="text-slate-500" />
              <select
                value={selectedCategory}
                onChange={(e) => {
                  playClickSound();
                  setSelectedCategory(e.target.value);
                }}
                className="h-8 bg-black/40 border border-white/[0.08] text-white rounded px-2.5 text-xs font-mono focus:border-[#06B6D4] outline-none cursor-pointer"
              >
                <option value="ALL">ALL CATEGORIES</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        {filteredTasks.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center text-slate-500">
            <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-3 text-slate-600">
              <CheckSquare size={22} />
            </div>
            <h4 className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase mb-1">
              NO TASKS FOUND
            </h4>
            <p className="text-[11px] font-mono text-slate-500 max-w-sm mb-4">
              {searchQuery.trim()
                ? "No tasks match your query filter. Clear search to view full queue."
                : activeTab === "completed"
                ? "No completed tasks yet. Mark active items as complete."
                : "Task queue is empty. Add a new task to begin."}
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="alfred-btn-primary px-4 py-1.5 text-xs font-mono"
            >
              + Add Task
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => {
              const isEditing = editingId === task.id;

              return (
                <div
                  key={task.id}
                  className={`p-3 rounded border transition-all duration-150 flex items-center justify-between gap-3 group ${
                    task.completed
                      ? "bg-white/[0.01] border-white/[0.04] opacity-55"
                      : "bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.06] hover:border-white/[0.14]"
                  }`}
                >
                  {isEditing ? (
                    <div className="flex-1 flex flex-col md:flex-row gap-2 items-start md:items-center">
                      <input
                        type="text"
                        value={editTempText}
                        onChange={(e) => setEditTempText(e.target.value)}
                        className="flex-1 alfred-input text-xs font-mono"
                        autoFocus
                      />
                      <select
                        value={editTempCategory}
                        onChange={(e) => setEditTempCategory(e.target.value)}
                        className="bg-black/50 border border-white/[0.12] text-xs font-mono rounded px-2 py-1 text-white"
                      >
                        {allCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="Custom">Custom...</option>
                      </select>
                      {editTempCategory === "Custom" && (
                        <input
                          type="text"
                          value={customEditCategory}
                          onChange={(e) => setCustomEditCategory(e.target.value)}
                          placeholder="Category..."
                          className="alfred-input w-28 text-xs font-mono"
                        />
                      )}
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="p-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 cursor-pointer"
                          title="Save Changes"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 cursor-pointer"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        onClick={() => handleTaskToggle(task.id, task.completed)}
                        onMouseEnter={playHoverSound}
                        className="flex items-center space-x-3 flex-1 min-w-0 cursor-pointer"
                      >
                        <div
                          className={`shrink-0 ${
                            task.completed
                              ? "text-emerald-400"
                              : "text-slate-500 group-hover:text-[#06B6D4] transition-colors"
                          }`}
                        >
                          {task.completed ? (
                            <CheckCircle size={16} />
                          ) : (
                            <Circle size={16} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs tracking-wide truncate ${
                              task.completed
                                ? "text-slate-500 line-through"
                                : "text-slate-200 group-hover:text-white"
                            }`}
                          >
                            {task.text}
                          </p>
                        </div>
                        <span className="shrink-0 text-[9px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.06] uppercase">
                          {task.category}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => startEdit(task)}
                          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                          title="Modify Directive"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            deleteTask(task.id);
                          }}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Purge Directive"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Directive Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
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
                  <div className="w-2 h-2 rounded-full bg-[#06B6D4] shadow-[0_0_6px_#06B6D4]" />
                  <h2 className="font-header text-sm font-bold text-white tracking-wider uppercase">
                    CREATE NEW TASK
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleAddTask} className="p-5 space-y-4">
                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    Task Description:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Study Neural Network Architecture..."
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    className="alfred-input w-full text-xs font-mono"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                    Category:
                  </label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                    className="alfred-input w-full text-xs font-mono bg-[#0B0E17]"
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="Custom">Custom Category...</option>
                  </select>
                </div>

                {newTaskCategory === "Custom" && (
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                      New Category Name:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Deep Learning..."
                      value={customNewCategory}
                      onChange={(e) => setCustomNewCategory(e.target.value)}
                      className="alfred-input w-full text-xs font-mono"
                    />
                  </div>
                )}

                <div className="pt-3 border-t border-white/[0.08] flex space-x-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 alfred-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newTaskText.trim()}
                    className="flex-1 alfred-btn-primary"
                  >
                    <Plus size={13} />
                    <span>Save Task</span>
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
