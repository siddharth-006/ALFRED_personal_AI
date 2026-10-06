"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  RefreshCw,
  CheckCircle,
  Plus,
  Shield,
  AlertTriangle,
  X,
  Laptop,
  Check,
} from "lucide-react";
import { playClickSound, playSuccessSound } from "@/utils/audioSystem";

export interface DiscoveredApp {
  id: string;
  name: string;
  executablePath: string;
  arguments?: string[];
  workingDirectory?: string;
  isPWA?: boolean;
  publisher?: string;
  version?: string;
  source: string;
  aliases: string[];
}

export interface ApprovedApp {
  id: string;
  name: string;
  executablePath: string;
  arguments?: string[];
  workingDirectory?: string;
  isPWA?: boolean;
  publisher?: string;
  version?: string;
  source: string;
  approvedAt: string;
  aliases: string[];
  isBuiltIn?: boolean;
}

interface ApplicationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectApplication: (appName: string) => void;
}

export default function ApplicationPickerModal({
  isOpen,
  onClose,
  onSelectApplication,
}: ApplicationPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "approved" | "available">("all");
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredApps, setDiscoveredApps] = useState<DiscoveredApp[]>([]);
  const [approvedApps, setApprovedApps] = useState<ApprovedApp[]>([]);
  const [pendingApprovalApp, setPendingApprovalApp] = useState<DiscoveredApp | null>(null);
  const [customAliasesInput, setCustomAliasesInput] = useState("");

  const loadData = async () => {
    if (typeof window === "undefined" || !window.electron?.apps) return;
    try {
      const [discovered, approved] = await Promise.all([
        window.electron.apps.getDiscovered(),
        window.electron.apps.getApproved(),
      ]);
      setApprovedApps(approved || []);
      if (discovered && discovered.length > 0) {
        setDiscoveredApps(discovered);
      } else {
        // Automatically scan if no cached apps exist yet
        handleScan();
      }
    } catch (err) {
      console.error("[AppPicker] Failed loading applications:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleScan = async () => {
    if (typeof window === "undefined" || !window.electron?.apps?.discover) return;
    setIsScanning(true);
    playClickSound();
    try {
      const discovered = await window.electron.apps.discover();
      setDiscoveredApps(discovered || []);
      const approved = await window.electron.apps.getApproved();
      setApprovedApps(approved || []);
      playSuccessSound();
    } catch (err) {
      console.error("[AppPicker] Scan failed:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const handleApprove = async () => {
    if (!pendingApprovalApp || typeof window === "undefined" || !window.electron?.apps?.approve) return;
    playClickSound();
    const extraAliases = customAliasesInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const result = await window.electron.apps.approve(pendingApprovalApp, extraAliases);
      if (result.success && result.app) {
        setApprovedApps((prev) => [...prev.filter((a) => a.id !== result.app.id), result.app]);
        playSuccessSound();
        setPendingApprovalApp(null);
        setCustomAliasesInput("");
      }
    } catch (err) {
      console.error("[AppPicker] Approval failed:", err);
    }
  };

  const isAppApproved = (app: DiscoveredApp) => {
    if (approvedApps.some((a) => a.id === app.id)) return true;
    const baseExe = app.executablePath.split(/[/\\]/).pop()?.toLowerCase() || "";
    if (baseExe === "chrome_proxy.exe" || baseExe === "msedge_proxy.exe") {
      return approvedApps.some(
        (a) => a.name.toLowerCase() === app.name.toLowerCase() &&
               a.executablePath.toLowerCase() === app.executablePath.toLowerCase()
      );
    }
    return approvedApps.some(
      (a) => a.name.toLowerCase() === app.name.toLowerCase() ||
             a.executablePath.toLowerCase() === app.executablePath.toLowerCase()
    );
  };

  const combinedList: (DiscoveredApp & { isApproved: boolean })[] = [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();

  for (const disc of discoveredApps) {
    const approved = isAppApproved(disc);
    combinedList.push({
      ...disc,
      isApproved: approved,
    });
    seenIds.add(disc.id);
    seenNames.add(disc.name.toLowerCase());
  }

  // Include approved apps that might not have been discovered in start menu scan (e.g. built-ins)
  for (const app of approvedApps) {
    if (!seenIds.has(app.id) && !seenNames.has(app.name.toLowerCase())) {
      combinedList.push({
        id: app.id,
        name: app.name,
        executablePath: app.executablePath,
        arguments: app.arguments,
        workingDirectory: app.workingDirectory,
        isPWA: app.isPWA,
        publisher: app.publisher,
        version: app.version,
        source: app.source,
        aliases: app.aliases,
        isApproved: true,
      });
      seenIds.add(app.id);
      seenNames.add(app.name.toLowerCase());
    }
  }

  const filteredApps = combinedList.filter((app) => {
    if (filterTab === "approved" && !app.isApproved) return false;
    if (filterTab === "available" && app.isApproved) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      app.name.toLowerCase().includes(q) ||
      (app.publisher && app.publisher.toLowerCase().includes(q)) ||
      (app.aliases && app.aliases.some((a) => a.toLowerCase().includes(q)))
    );
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[99999] select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#0B0E17] border border-white/[0.15] shadow-2xl rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col font-mono text-xs overflow-hidden"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center space-x-2">
              <Laptop size={16} className="text-cyan-400" />
              <div>
                <h3 className="font-header text-sm font-bold text-white uppercase tracking-wider">
                  Windows Applications Picker
                </h3>
                <p className="text-[10px] text-slate-400 font-sans">
                  Approved applications can be orchestrated into workspaces and summoned by ALFRED.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer p-1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Search, Filter, and Scan Controls */}
          <div className="p-4 border-b border-white/[0.06] bg-black/30 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search installed applications by name, alias..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121624] border border-white/[0.1] rounded pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-[#121624] p-0.5 rounded border border-white/[0.08]">
                <button
                  onClick={() => setFilterTab("all")}
                  className={`px-2.5 py-1 text-[11px] rounded transition-all cursor-pointer ${
                    filterTab === "all" ? "bg-white/[0.12] text-white font-bold" : "text-slate-400"
                  }`}
                >
                  All ({combinedList.length})
                </button>
                <button
                  onClick={() => setFilterTab("approved")}
                  className={`px-2.5 py-1 text-[11px] rounded transition-all cursor-pointer ${
                    filterTab === "approved" ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-400"
                  }`}
                >
                  Approved ({approvedApps.length})
                </button>
                <button
                  onClick={() => setFilterTab("available")}
                  className={`px-2.5 py-1 text-[11px] rounded transition-all cursor-pointer ${
                    filterTab === "available" ? "bg-white/[0.12] text-white font-bold" : "text-slate-400"
                  }`}
                >
                  Available ({combinedList.filter((a) => !a.isApproved).length})
                </button>
              </div>

              <button
                onClick={handleScan}
                disabled={isScanning}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs text-slate-300 hover:text-white transition-all cursor-pointer"
                title="Scan Windows Start Menu & Apps"
              >
                <RefreshCw size={12} className={isScanning ? "animate-spin text-cyan-400" : "text-cyan-400"} />
                <span>{isScanning ? "Scanning..." : "Scan"}</span>
              </button>
            </div>
          </div>

          {/* Applications List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-white/[0.04]">
            {filteredApps.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <AlertTriangle size={24} className="mx-auto mb-2 text-slate-500" />
                <p className="text-xs">No matching applications found.</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  Click &quot;Scan&quot; to discover applications from your Windows Start Menu.
                </p>
              </div>
            ) : (
              filteredApps.map((app) => (
                <div
                  key={app.id}
                  className="pt-2 first:pt-0 flex items-center justify-between gap-3 group hover:bg-white/[0.02] p-2 rounded transition-all"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="p-2 rounded bg-white/[0.03] border border-white/[0.06] text-cyan-400 shrink-0 mt-0.5">
                      <Laptop size={14} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-header font-bold text-white text-xs truncate">
                          {app.name}
                        </span>
                        {app.isApproved ? (
                          <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <CheckCircle size={10} />
                            APPROVED
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                            UNAPPROVED
                          </span>
                        )}
                        {app.isPWA && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono">
                            WEB APP (PWA)
                          </span>
                        )}
                        {!app.isPWA && app.arguments && app.arguments.length > 0 && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono">
                            SHORTCUT
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-md font-sans">
                        {app.publisher ? `${app.publisher} • ` : ""}
                        <span className="font-mono text-slate-500">{app.executablePath}</span>
                      </div>
                      {app.aliases && app.aliases.length > 0 && (
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="text-[9px] text-slate-500 uppercase">Aliases:</span>
                          {app.aliases.slice(0, 3).map((alias, i) => (
                            <span
                              key={i}
                              className="text-[9px] px-1 rounded bg-white/[0.03] text-slate-400 font-mono"
                            >
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {app.isApproved ? (
                      <button
                        onClick={() => {
                          playClickSound();
                          onSelectApplication(app.name);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <Plus size={12} />
                        <span>Select</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          playClickSound();
                          setPendingApprovalApp(app);
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-600/80 hover:bg-emerald-600 text-white font-mono text-[11px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <Shield size={12} />
                        <span>Approve</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Status */}
          <div className="p-3 border-t border-white/[0.08] bg-black/40 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              {approvedApps.length} approved application(s) authorized for voice and workspace control.
            </span>
            <button
              onClick={onClose}
              className="alfred-btn-secondary px-3 py-1 text-xs"
            >
              Close
            </button>
          </div>
        </motion.div>

        {/* User-Explicit Approval Confirmation Modal */}
        <AnimatePresence>
          {pendingApprovalApp && (
            <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-[999999]">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#0B0E17] border border-emerald-500/40 shadow-2xl rounded-lg w-full max-w-md p-5 font-mono text-xs space-y-4"
              >
                <div className="flex items-center space-x-2 text-emerald-400">
                  <Shield size={18} />
                  <h4 className="font-header font-bold text-white text-sm uppercase">
                    AUTHORIZE APPLICATION
                  </h4>
                </div>

                <div className="p-3 rounded bg-white/[0.03] border border-white/[0.08] space-y-1.5 font-sans">
                  <div className="text-white font-bold">{pendingApprovalApp.name}</div>
                  <div className="text-[11px] text-slate-400 break-all font-mono">
                    {pendingApprovalApp.executablePath}
                  </div>
                  {pendingApprovalApp.publisher && (
                    <div className="text-[11px] text-slate-500">Publisher: {pendingApprovalApp.publisher}</div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-400 uppercase tracking-wider block">
                    Custom Voice / Command Aliases (comma-separated):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. text editor, my code, notes"
                    value={customAliasesInput}
                    onChange={(e) => setCustomAliasesInput(e.target.value)}
                    className="alfred-input w-full"
                  />
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                  By approving this application, you authorize ALFRED to launch it directly upon your explicit request or within workspace configurations. Arbitrary command arguments remain prohibited.
                </p>

                <div className="flex space-x-2 pt-2">
                  <button
                    onClick={() => setPendingApprovalApp(null)}
                    className="flex-1 alfred-btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApprove}
                    className="flex-1 py-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all cursor-pointer flex items-center justify-center space-x-1"
                  >
                    <Check size={13} />
                    <span>Confirm Approval</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  );
}
