"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Folder,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  Search,
  Filter,
  Terminal,
} from "lucide-react";
import {
  useProjects,
  Project,
  ProjectCategory,
  ProjectStatus,
} from "@/context/ProjectContext";
import { playClickSound, playHoverSound, playSuccessSound } from "@/utils/audioSystem";

const CATEGORIES: ProjectCategory[] = [
  "DSA",
  "Data Science",
  "College",
  "Hackathon",
  "Personal",
];

const STATUSES: ProjectStatus[] = ["Not Started", "In Progress", "Completed"];

export default function ProjectsPage() {
  const { projects, addProject, updateProject, deleteProject } = useProjects();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "Personal" as ProjectCategory,
    status: "In Progress" as ProjectStatus,
    progress: 0,
  });

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status !== "Completed").length;
  const completedProjects = projects.filter((p) => p.status === "Completed").length;
  const averageProgress =
    totalProjects > 0
      ? Math.round(
          projects.reduce((acc, curr) => acc + curr.progress, 0) / totalProjects
        )
      : 0;

  const handleOpenModal = (project?: Project) => {
    playClickSound();
    if (project) {
      setEditingProjectId(project.id);
      setFormData({
        name: project.name,
        description: project.description,
        category: project.category,
        status: project.status,
        progress: project.progress,
      });
    } else {
      setEditingProjectId(null);
      setFormData({
        name: "",
        description: "",
        category: "Personal",
        status: "In Progress",
        progress: 0,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProjectId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const clampedProgress = Math.min(100, Math.max(0, Number(formData.progress) || 0));

    if (editingProjectId) {
      updateProject(editingProjectId, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        status: formData.status,
        progress: clampedProgress,
      });
      playSuccessSound();
      if (typeof window !== "undefined") {
        import("@/utils/activityBus").then(({ dispatchAlfredActivity }) => {
          dispatchAlfredActivity({
            type: "tool_executing",
            state: "success",
            label: "PROJECT UPDATED",
            detail: formData.name.trim(),
          });
        });
      }
    } else {
      addProject({
        name: formData.name.trim(),
        description: formData.description.trim(),
        category: formData.category,
        status: formData.status,
        progress: clampedProgress,
        createdDate: new Date().toISOString().split("T")[0],
      });
      playSuccessSound();
      if (typeof window !== "undefined") {
        import("@/utils/activityBus").then(({ dispatchAlfredActivity }) => {
          dispatchAlfredActivity({
            type: "tool_executing",
            state: "success",
            label: "PROJECT CREATED",
            detail: formData.name.trim(),
          });
        });
      }
    }

    handleCloseModal();
  };

  const confirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    playClickSound();
    setProjectToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = () => {
    if (projectToDelete) {
      deleteProject(projectToDelete);
      playClickSound();
    }
    setIsDeleteModalOpen(false);
    setProjectToDelete(null);
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

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case "Completed":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            COMPLETED
          </span>
        );
      case "In Progress":
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#06B6D4]/15 border border-[#06B6D4]/30 text-[#06B6D4]">
            IN PROGRESS
          </span>
        );
      case "Not Started":
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/[0.04] border border-white/[0.08] text-slate-400">
            NOT STARTED
          </span>
        );
    }
  };

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (categoryFilter !== "ALL" && p.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, statusFilter, categoryFilter, searchQuery]);

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-transparent min-h-screen relative overflow-hidden text-slate-200 select-none">
      {/* Background Ambient Technical Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(6,182,212,0.05),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Editorial Header */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative z-10 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-baseline space-x-3">
            <h1 className="text-2xl md:text-3xl font-header font-bold text-white tracking-tight">
              Projects
            </h1>
            <span className="text-[11px] font-mono text-cyan-400 tracking-wider">
              ACTIVE WORKSTREAMS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Strategic deliverables, active technical pipelines, and completion trajectories.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openAiCommand("What is the status of my projects?")}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-sm bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-cyan-500/30 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <Terminal size={12} className="text-cyan-400" />
            <span>Ask ALFRED</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="alfred-btn-primary px-3.5 py-1.5 text-xs font-mono flex items-center space-x-1.5 cursor-pointer shadow-md rounded-sm"
          >
            <Plus size={13} />
            <span>New Initiative</span>
          </button>
        </div>
      </header>

      {/* Project Flow Velocity Horizon (Replacing 4 generic stat boxes with dynamic trajectory flow) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 relative z-10">
        <div className="lg:col-span-8 alfred-panel p-5 border-l-2 border-l-rose-500/70">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-mono tracking-widest uppercase text-slate-400">
              Active Project Trajectories
            </div>
            <div className="text-xs font-mono text-cyan-400">
              {activeProjects} IN PROGRESS
            </div>
          </div>

          {/* Quick Flow Horizontal Progress Bars */}
          <div className="space-y-3">
            {projects.slice(0, 3).map((p) => (
              <div key={p.id} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-header font-semibold text-slate-200 truncate max-w-xs">
                    {p.name}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-white">
                    {p.progress}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-cyan-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Aggregate Trajectory Velocity */}
        <div className="lg:col-span-4 alfred-panel p-5 flex items-center justify-around border-t lg:border-t-0 lg:border-r-2 lg:border-r-rose-500/60">
          <div className="text-center">
            <div className="font-header text-5xl font-black text-white tracking-tighter">
              {averageProgress}%
            </div>
            <div className="text-[10px] font-mono tracking-wider uppercase text-rose-400 font-bold mt-1">
              AVG PROGRESS
            </div>
            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
              Across {totalProjects} projects
            </div>
          </div>

          <div className="h-12 w-px bg-white/[0.08]" />

          <div className="space-y-1.5 text-xs font-mono">
            <div className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {completedProjects} Complete
            </div>
            <div className="text-cyan-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              {activeProjects} Active
            </div>
          </div>
        </div>
      </div>

      {/* Main Console & Filter Bar */}
      <div className="alfred-panel p-5 relative z-10 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          {/* Status Tabs */}
          <div className="flex items-center space-x-1 bg-black/40 p-1 rounded border border-white/[0.08]">
            {["ALL", ...STATUSES].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  playClickSound();
                  setStatusFilter(status);
                }}
                className={`px-3 py-1 rounded text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === status
                    ? "bg-[#06B6D4]/15 border border-[#06B6D4]/40 text-white font-bold"
                    : "text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Search Bar & Sector Filter */}
          <div className="flex items-center gap-2.5 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Search initiatives..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded bg-black/40 border border-white/[0.08] focus:border-[#06B6D4] text-xs font-mono text-white placeholder-slate-500 outline-none"
              />
            </div>

            <div className="flex items-center space-x-1.5 shrink-0">
              <Filter size={13} className="text-slate-500" />
              <select
                value={categoryFilter}
                onChange={(e) => {
                  playClickSound();
                  setCategoryFilter(e.target.value);
                }}
                className="h-8 bg-black/40 border border-white/[0.08] text-white rounded px-2.5 text-xs font-mono focus:border-[#06B6D4] outline-none cursor-pointer"
              >
                <option value="ALL">ALL SECTORS</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Projects Cards Grid */}
        {filteredProjects.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center text-center text-slate-500">
            <div className="w-12 h-12 rounded-full bg-white/[0.02] border border-white/[0.06] flex items-center justify-center mb-3 text-slate-600">
              <Folder size={22} />
            </div>
            <h4 className="text-xs font-mono font-bold tracking-wider text-slate-300 uppercase mb-1">
              NO INITIATIVES FOUND
            </h4>
            <p className="text-[11px] font-mono text-slate-500 max-w-sm mb-4">
              {searchQuery.trim()
                ? "No projects match your search query."
                : "No strategic initiatives found in this sector. Deploy a new project to track progress."}
            </p>
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="alfred-btn-primary px-4 py-1.5 text-xs font-mono"
            >
              + Create Initiative
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleOpenModal(project)}
                onMouseEnter={playHoverSound}
                className="p-4 rounded border bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.06] hover:border-white/[0.16] transition-all flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.06] uppercase">
                      {project.category}
                    </span>
                    {getStatusBadge(project.status)}
                  </div>

                  <h3 className="text-sm font-header font-bold text-white tracking-wide group-hover:text-[#06B6D4] transition-colors truncate">
                    {project.name}
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {project.description || "No tactical details recorded."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.05]">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1.5">
                    <span>Initiative Progress</span>
                    <span className="text-white font-bold">{project.progress}%</span>
                  </div>
                  <div className="w-full bg-white/[0.06] rounded-full h-1.5 overflow-hidden p-[1px]">
                    <div
                      className="bg-gradient-to-r from-[#06B6D4] to-[#E11D48] h-full rounded-full transition-all duration-300"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-slate-500">
                      Created: {project.createdDate}
                    </span>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenModal(project);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                        title="Configure Project"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => confirmDelete(project.id, e)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Purge Project"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Project Modal */}
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
              className="bg-[#0B0E17] border border-white/[0.15] shadow-2xl rounded-lg w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-[#06B6D4] shadow-[0_0_6px_#06B6D4]" />
                  <h2 className="font-header text-sm font-bold text-white tracking-wider uppercase">
                    {editingProjectId ? "MODIFY INITIATIVE" : "INITIALIZE INITIATIVE"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5 space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                    Initiative Title:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Neural Architecture Search..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="alfred-input w-full"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                    Strategic Description:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe operational scope and milestones..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="alfred-input w-full resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                      Sector:
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          category: e.target.value as ProjectCategory,
                        })
                      }
                      className="alfred-input w-full bg-[#0B0E17]"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                      Deployment Status:
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          status: e.target.value as ProjectStatus,
                        })
                      }
                      className="alfred-input w-full bg-[#0B0E17]"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider">
                      Completion Progress:
                    </label>
                    <span className="text-white font-bold">{formData.progress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={(e) =>
                      setFormData({ ...formData, progress: Number(e.target.value) })
                    }
                    className="w-full h-2 bg-white/[0.08] rounded-lg appearance-none cursor-pointer accent-[#06B6D4]"
                  />
                </div>

                <div className="pt-3 border-t border-white/[0.08] flex space-x-2.5">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 alfred-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.name.trim()}
                    className="flex-1 alfred-btn-primary"
                  >
                    <CheckCircle size={13} />
                    <span>{editingProjectId ? "Save Changes" : "Deploy Initiative"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0B0E17] border border-rose-500/30 shadow-2xl rounded-lg w-full max-w-sm overflow-hidden p-5 font-mono text-xs"
            >
              <h3 className="font-header text-sm font-bold text-white uppercase mb-2 text-rose-400">
                PURGE INITIATIVE CONFIRMATION
              </h3>
              <p className="text-slate-300 mb-5 leading-relaxed">
                Are you sure you want to purge this project initiative? All tracking
                metrics will be permanently deleted.
              </p>
              <div className="flex space-x-2.5">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 alfred-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeDelete}
                  className="flex-1 py-1.5 px-3 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold transition-all cursor-pointer text-center"
                >
                  Confirm Purge
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
