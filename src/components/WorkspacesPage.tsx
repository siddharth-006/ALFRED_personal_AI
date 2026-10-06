"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Code,
  LineChart,
  Terminal,
  Brain,
  Plus,
  Play,
  X,
  Trash2,
  Edit2,
  Globe,
  Monitor,
  Folder as FolderIcon,
  CheckCircle2,
  Laptop,
} from "lucide-react";
import ApplicationPickerModal from "@/components/ApplicationPickerModal";
import {
  useWorkspaces,
  Workspace,
  WorkspaceType,
} from "@/context/WorkspaceContext";
import {
  playClickSound,
  playHoverSound,
  playSuccessSound,
  AlfredAudioService,
} from "@/utils/audioSystem";

export const getWorkspaceIcon = (type: WorkspaceType, size = 20) => {
  switch (type) {
    case "dsa":
      return <Code size={size} />;
    case "datascience":
      return <LineChart size={size} />;
    case "hackathon":
      return <Terminal size={size} />;
    case "machinelearning":
      return <Brain size={size} />;
    case "custom":
    default:
      return <Briefcase size={size} />;
  }
};

export default function WorkspacesPage() {
  const {
    workspaces,
    addWorkspace,
    updateWorkspace,
    deleteWorkspace,
    launchWorkspace,
  } = useWorkspaces();

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLaunchModalOpen, setIsLaunchModalOpen] = useState(false);
  const [isAppPickerOpen, setIsAppPickerOpen] = useState(false);

  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "custom" as WorkspaceType,
    applications: [] as string[],
    websites: [] as string[],
    localFolders: [] as string[],
  });

  const [formInput, setFormInput] = useState({
    app: "",
    website: "",
    folder: "",
  });

  const [launchMessage, setLaunchMessage] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);

  const totalWorkspaces = workspaces.length;
  const totalApps = workspaces.reduce((acc, ws) => acc + ws.applications.length, 0);
  const totalWebsites = workspaces.reduce((acc, ws) => acc + ws.websites.length, 0);
  const totalFolders = workspaces.reduce((acc, ws) => acc + ws.localFolders.length, 0);

  // Form Handlers
  const openFormModal = (workspace?: Workspace, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    playClickSound();
    if (workspace) {
      setActiveWorkspace(workspace);
      setFormData({
        name: workspace.name,
        description: workspace.description,
        type: workspace.type,
        applications: [...workspace.applications],
        websites: [...workspace.websites],
        localFolders: [...workspace.localFolders],
      });
    } else {
      setActiveWorkspace(null);
      setFormData({
        name: "",
        description: "",
        type: "custom",
        applications: [],
        websites: [],
        localFolders: [],
      });
    }
    setFormInput({ app: "", website: "", folder: "" });
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setActiveWorkspace(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (activeWorkspace) {
      updateWorkspace(activeWorkspace.id, formData);
      playSuccessSound();
    } else {
      addWorkspace(formData);
      playSuccessSound();
    }
    closeFormModal();
  };

  const addItem = (
    field: "applications" | "websites" | "localFolders",
    value: string
  ) => {
    if (!value.trim()) return;
    setFormData((prev) => ({ ...prev, [field]: [...prev[field], value.trim()] }));
    setFormInput((prev) => ({
      ...prev,
      [field === "applications"
        ? "app"
        : field === "websites"
        ? "website"
        : "folder"]: "",
    }));
  };

  const removeItem = (
    field: "applications" | "websites" | "localFolders",
    index: number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  // Delete Handlers
  const confirmDelete = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    playClickSound();
    setActiveWorkspace(workspace);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = () => {
    if (activeWorkspace) {
      deleteWorkspace(activeWorkspace.id);
      playClickSound();
    }
    setIsDeleteModalOpen(false);
    setActiveWorkspace(null);
  };

  // Launch Handlers
  const openLaunchModal = (workspace: Workspace, e: React.MouseEvent) => {
    e.stopPropagation();
    playClickSound();
    setActiveWorkspace(workspace);
    setLaunchMessage("");
    setIsLaunching(false);
    setIsLaunchModalOpen(true);
  };

  const executeLaunch = async () => {
    if (!activeWorkspace) return;
    setIsLaunching(true);
    playClickSound();
    launchWorkspace(activeWorkspace.id);

    if (typeof window !== "undefined") {
      import("@/utils/activityBus").then(({ dispatchAlfredActivity }) => {
        dispatchAlfredActivity({
          type: "workspace_launched",
          state: "executing",
          label: "LAUNCHING WORKSPACE",
          detail: activeWorkspace.name,
        });
      });
    }

    if (typeof window !== "undefined" && window.electron?.workspace) {
      try {
        const result = await Promise.race([
          window.electron.workspace.launch(activeWorkspace),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error("Workspace launch timed out")), 10000)
          ),
        ]);
        if (result?.success) {
          AlfredAudioService.play("workspace");
          setLaunchMessage("Workspace launched successfully.");
        } else {
          const failedItems = Array.isArray(result?.results)
            ? result.results.filter((r: any) => !r.success)
            : [];
          if (failedItems.length > 0) {
            AlfredAudioService.play("error");
            setLaunchMessage(
              `Launched with notices: ${failedItems
                .map((f: any) => `${f.target} (${f.error})`)
                .join(", ")}`
            );
          } else {
            AlfredAudioService.play("workspace");
            setLaunchMessage("Workspace launched successfully.");
          }
        }
      } catch (err: any) {
        AlfredAudioService.play("error");
        setLaunchMessage(`Launch notice: ${err?.message || "Error launching workspace"}`);
      } finally {
        setTimeout(() => {
          setIsLaunchModalOpen(false);
          setActiveWorkspace(null);
          setIsLaunching(false);
        }, 2000);
      }
      return;
    }

    // Fallback: Open websites
    let openedCount = 0;
    activeWorkspace.websites.forEach((url) => {
      const newWin = window.open(url, "_blank");
      if (newWin) openedCount++;
    });

    if (
      openedCount < activeWorkspace.websites.length &&
      activeWorkspace.websites.length > 0
    ) {
      AlfredAudioService.play("error");
      setLaunchMessage(
        "Browser popup blocker detected. Allow popups for multi-tab workspace launching."
      );
    } else {
      AlfredAudioService.play("workspace");
      setLaunchMessage("Deployment sequence finished. Check active tabs.");
    }

    setTimeout(() => {
      setIsLaunchModalOpen(false);
      setActiveWorkspace(null);
      setIsLaunching(false);
    }, 2000);
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

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-transparent min-h-screen relative overflow-hidden text-slate-200 select-none">
      {/* Background Ambient Technical Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(225,29,72,0.06),transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Editorial Header */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 relative z-10 border-b border-white/[0.06] pb-4">
        <div>
          <div className="flex items-baseline space-x-3">
            <h1 className="text-2xl md:text-3xl font-header font-bold text-white tracking-tight">
              Workspaces
            </h1>
            <span className="text-[11px] font-mono text-cyan-400 tracking-wider">
              DIGITAL ENVIRONMENTS
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Automated workstation profiles — orchestrate desktop applications, endpoints, and directories in a single command.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => openAiCommand("Launch my ")}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-sm bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-cyan-500/30 text-xs font-mono text-slate-300 hover:text-white transition-all cursor-pointer"
          >
            <Terminal size={12} className="text-cyan-400" />
            <span>Ask ALFRED</span>
          </button>

          <button
            type="button"
            onClick={() => openFormModal()}
            className="alfred-btn-primary px-3.5 py-1.5 text-xs font-mono flex items-center space-x-1.5 cursor-pointer shadow-md rounded-sm"
          >
            <Plus size={13} />
            <span>Create Profile</span>
          </button>
        </div>
      </header>

      {/* Asymmetric Environment Capacity Banner (Connected node metrics) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6 relative z-10">
        <div className="lg:col-span-8 alfred-panel p-5 border-l-2 border-l-cyan-500/70 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono tracking-widest uppercase text-slate-400">
                Connected Resource Cluster
              </span>
              <span className="text-xs font-mono text-cyan-400 font-bold">
                {totalWorkspaces} READY PROFILES
              </span>
            </div>
            <p className="text-xs text-slate-300 font-sans max-w-lg mb-4">
              ALFRED coordinates native application execution, multi-tab web resources, and file paths into synchronized environments.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 border-t border-white/[0.06] pt-3 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-cyan-500/10 text-cyan-400">
                <Monitor size={14} />
              </div>
              <div>
                <div className="text-white font-bold">{totalApps}</div>
                <div className="text-[10px] text-slate-500 uppercase">Native Apps</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-rose-500/10 text-rose-400">
                <Globe size={14} />
              </div>
              <div>
                <div className="text-white font-bold">{totalWebsites}</div>
                <div className="text-[10px] text-slate-500 uppercase">Websites</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded bg-amber-500/10 text-amber-400">
                <FolderIcon size={14} />
              </div>
              <div>
                <div className="text-white font-bold">{totalFolders}</div>
                <div className="text-[10px] text-slate-500 uppercase">Directories</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Workstation Environment Status */}
        <div className="lg:col-span-4 alfred-panel p-5 flex flex-col justify-between border-t lg:border-t-0 lg:border-r-2 lg:border-r-cyan-500/60">
          <div className="space-y-1">
            <div className="text-[10px] font-mono tracking-wider uppercase text-slate-400">
              Automation Dispatcher
            </div>
            <div className="text-sm font-mono text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              DESKTOP RUNTIME READY
            </div>
          </div>

          <div className="text-xs font-sans text-slate-400 leading-relaxed">
            Issue <span className="font-mono text-cyan-300">&quot;Launch [name]&quot;</span> anywhere via Command Terminal to prepare your active work context.
          </div>
        </div>
      </div>

      {/* Main Console & Profiles Grid */}
      <div className="alfred-panel p-5 relative z-10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <h2 className="text-xs font-mono font-bold tracking-widest text-white/80 uppercase flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            CONFIGURED WORKSPACE ENVIRONMENTS
          </h2>
          <span className="text-[10px] font-mono text-slate-500">
            {totalWorkspaces} PROFILES
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              onMouseEnter={playHoverSound}
              className="p-4 rounded border bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.06] hover:border-white/[0.16] transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-cyan-400 group-hover:text-rose-400 transition-colors">
                      {getWorkspaceIcon(ws.type, 18)}
                    </span>
                    <span className="text-sm font-header font-bold text-white tracking-wide truncate">
                      {ws.name}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.06] uppercase">
                    {ws.type}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed font-sans">
                  {ws.description || "Configured workspace environment profile."}
                </p>

                {/* Connected Environment Diagram Nodes */}
                <div className="mt-3.5 space-y-2 text-[11px] font-mono bg-black/40 p-3 rounded border border-white/[0.05]">
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                    <span className="flex items-center space-x-1.5 text-slate-400">
                      <Monitor size={12} className="text-cyan-400" />
                      <span>Apps:</span>
                    </span>
                    <span className="text-white truncate max-w-[130px] font-sans">
                      {ws.applications.length > 0 ? ws.applications.join(", ") : "None"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-white/[0.04] pb-1.5">
                    <span className="flex items-center space-x-1.5 text-slate-400">
                      <Globe size={12} className="text-rose-400" />
                      <span>Websites:</span>
                    </span>
                    <span className="text-white truncate max-w-[130px] font-mono text-[10px]">
                      {ws.websites.length > 0 ? `${ws.websites.length} endpoints` : "None"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-1.5 text-slate-400">
                      <FolderIcon size={12} className="text-amber-400" />
                      <span>Folders:</span>
                    </span>
                    <span className="text-white truncate max-w-[130px] font-mono text-[10px]">
                      {ws.localFolders.length > 0 ? `${ws.localFolders.length} paths` : "None"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Ribbon */}
              <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center justify-between">
                <div className="text-[10px] font-mono text-slate-500 truncate max-w-[130px]">
                  {ws.lastLaunched
                    ? `Launched ${new Date(ws.lastLaunched).toLocaleDateString()}`
                    : "Never deployed"}
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={(e) => openFormModal(ws, e)}
                    className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
                    title="Configure Profile"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => confirmDelete(ws, e)}
                    className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Purge Profile"
                  >
                    <Trash2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openLaunchModal(ws, e)}
                    className="px-2.5 py-1 rounded bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-mono font-semibold transition-all cursor-pointer flex items-center space-x-1 shadow-sm"
                  >
                    <Play size={11} fill="currentColor" />
                    <span>Launch</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Workspace Deployment Modal */}
      <AnimatePresence>
        {isLaunchModalOpen && activeWorkspace && (
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
                    DEPLOY: {activeWorkspace.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLaunchModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-3.5 font-mono text-xs">
                {activeWorkspace.applications.length > 0 && (
                  <div>
                    <h4 className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                      Applications ({activeWorkspace.applications.length}):
                    </h4>
                    <div className="space-y-1">
                      {activeWorkspace.applications.map((app, i) => (
                        <div key={i} className="flex items-center text-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] mr-2" />
                          <span>{app}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeWorkspace.websites.length > 0 && (
                  <div>
                    <h4 className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                      Web Endpoints ({activeWorkspace.websites.length}):
                    </h4>
                    <div className="space-y-1">
                      {activeWorkspace.websites.map((url, i) => (
                        <div key={i} className="flex items-center text-slate-300 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] mr-2 shrink-0" />
                          <span className="truncate">{url}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeWorkspace.localFolders.length > 0 && (
                  <div>
                    <h4 className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">
                      Target Directories ({activeWorkspace.localFolders.length}):
                    </h4>
                    <div className="space-y-1">
                      {activeWorkspace.localFolders.map((f, i) => (
                        <div key={i} className="flex items-center text-slate-300 truncate">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-2 shrink-0" />
                          <span className="truncate">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {launchMessage && (
                  <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-semibold animate-pulse">
                    {launchMessage}
                  </div>
                )}
              </div>

              <div className="p-3.5 border-t border-white/[0.08] flex space-x-2.5 bg-black/40">
                <button
                  type="button"
                  onClick={() => setIsLaunchModalOpen(false)}
                  className="flex-1 alfred-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isLaunching}
                  onClick={executeLaunch}
                  className="flex-1 alfred-btn-primary"
                >
                  <Play size={12} fill="currentColor" />
                  <span>{isLaunching ? "Deploying..." : "Launch Profile"}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Configure Workspace Profile Modal */}
      <AnimatePresence>
        {isFormModalOpen && (
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
              className="bg-[#0B0E17] border border-white/[0.15] shadow-2xl rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col font-mono text-xs"
            >
              <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-[#E11D48] shadow-[0_0_6px_#E11D48]" />
                  <h2 className="font-header text-sm font-bold text-white tracking-wider uppercase">
                    {activeWorkspace ? "CONFIGURE PROFILE" : "CREATE PROFILE"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="p-5 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                    Profile Identifier:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deep Learning R&D..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="alfred-input w-full"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                    Environment Purpose:
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of workflow..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="alfred-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                    Profile Type:
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as WorkspaceType,
                      })
                    }
                    className="alfred-input w-full bg-[#0B0E17]"
                  >
                    <option value="dsa">DSA</option>
                    <option value="datascience">Data Science</option>
                    <option value="hackathon">Hackathon</option>
                    <option value="machinelearning">Machine Learning</option>
                    <option value="college">College</option>
                    <option value="personal">Personal</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                {/* Applications Section */}
                <div className="pt-2 border-t border-white/[0.06]">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider">
                      Applications (e.g. VS Code, Chrome, Spotify):
                    </label>
                    <button
                      type="button"
                      id="btn-browse-installed-apps"
                      onClick={() => setIsAppPickerOpen(true)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Laptop size={12} />
                      <span>Browse Installed Apps</span>
                    </button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Add application name or alias..."
                      value={formInput.app}
                      onChange={(e) =>
                        setFormInput({ ...formInput, app: e.target.value })
                      }
                      className="alfred-input flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addItem("applications", formInput.app);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => addItem("applications", formInput.app)}
                      className="alfred-btn-secondary px-3 py-1.5"
                    >
                      + Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAppPickerOpen(true)}
                      className="alfred-btn-secondary px-3 py-1.5 text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                    >
                      <Laptop size={12} />
                      <span>Browse</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.applications.map((app, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-300 flex items-center space-x-1"
                      >
                        <span>{app}</span>
                        <X
                          size={11}
                          className="cursor-pointer hover:text-rose-400"
                          onClick={() => removeItem("applications", i)}
                        />
                      </span>
                    ))}
                  </div>
                </div>

                {/* Websites Section */}
                <div className="pt-2 border-t border-white/[0.06]">
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                    Web Endpoints (URLs):
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={formInput.website}
                      onChange={(e) =>
                        setFormInput({ ...formInput, website: e.target.value })
                      }
                      className="alfred-input flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addItem("websites", formInput.website);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => addItem("websites", formInput.website)}
                      className="alfred-btn-secondary px-3 py-1.5"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.websites.map((url, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-300 flex items-center space-x-1 truncate max-w-[260px]"
                      >
                        <span className="truncate">{url}</span>
                        <X
                          size={11}
                          className="cursor-pointer hover:text-rose-400 shrink-0"
                          onClick={() => removeItem("websites", i)}
                        />
                      </span>
                    ))}
                  </div>
                </div>

                {/* Local Folders Section */}
                <div className="pt-2 border-t border-white/[0.06]">
                  <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                    Local Directories:
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="D:\Path\To\Project..."
                      value={formInput.folder}
                      onChange={(e) =>
                        setFormInput({ ...formInput, folder: e.target.value })
                      }
                      className="alfred-input flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addItem("localFolders", formInput.folder);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => addItem("localFolders", formInput.folder)}
                      className="alfred-btn-secondary px-3 py-1.5"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {formData.localFolders.map((f, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-300 flex items-center space-x-1 truncate max-w-[260px]"
                      >
                        <span className="truncate">{f}</span>
                        <X
                          size={11}
                          className="cursor-pointer hover:text-rose-400 shrink-0"
                          onClick={() => removeItem("localFolders", i)}
                        />
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-white/[0.08] flex space-x-2.5">
                  <button
                    type="button"
                    onClick={closeFormModal}
                    className="flex-1 alfred-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!formData.name.trim()}
                    className="flex-1 alfred-btn-primary"
                  >
                    <CheckCircle2 size={13} />
                    <span>{activeWorkspace ? "Save Changes" : "Commit Profile"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && activeWorkspace && (
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
                PURGE WORKSPACE PROFILE
              </h3>
              <p className="text-slate-300 mb-5 leading-relaxed">
                Are you sure you want to purge profile &quot;{activeWorkspace.name}&quot;?
                All application and web configurations will be deleted.
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

      {/* Windows Application Picker Modal */}
      <ApplicationPickerModal
        isOpen={isAppPickerOpen}
        onClose={() => setIsAppPickerOpen(false)}
        onSelectApplication={(appName) => {
          addItem("applications", appName);
        }}
      />
    </div>
  );
}
