"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Settings as SettingsIcon,
  Shield,
  Mic,
  Keyboard,
  Cpu,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Bell,
  Palette,
  Laptop,
} from "lucide-react";
import { playClickSound, playSuccessSound } from "@/utils/audioSystem";
import type { AlfredSettings } from "../../electron/services/settings.types";
import ApplicationPickerModal, { ApprovedApp } from "@/components/ApplicationPickerModal";

interface SettingsModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function SettingsModal({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
}: SettingsModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const onClose = useCallback(() => {
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  }, [controlledOnClose]);

  const [activeTab, setActiveTab] = useState<"ai" | "voice" | "appearance" | "notifications" | "security" | "apps" | "onboarding">("ai");
  const [settings, setSettings] = useState<AlfredSettings | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [shortcutInput, setShortcutInput] = useState("CommandOrControl+Shift+Space");
  const [isAppPickerOpen, setIsAppPickerOpen] = useState(false);
  const [approvedAppsList, setApprovedAppsList] = useState<ApprovedApp[]>([]);

  const loadSettings = useCallback(async () => {
    if (typeof window !== "undefined" && window.electron?.settings) {
      try {
        const s = await window.electron.settings.get();
        setSettings(s);
        if (s?.hotkey?.shortcut) {
          setShortcutInput(s.hotkey.shortcut);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    }
    if (typeof window !== "undefined" && window.electron?.apps?.getApproved) {
      try {
        const apps = await window.electron.apps.getApproved();
        setApprovedAppsList(apps || []);
      } catch (err) {
        console.error("Failed to load approved apps:", err);
      }
    }
  }, []);

  useEffect(() => {
    const handleOpen = () => {
      playClickSound();
      setInternalIsOpen(true);
      loadSettings();
    };

    window.addEventListener("open-settings-modal", handleOpen);
    return () => window.removeEventListener("open-settings-modal", handleOpen);
  }, [loadSettings]);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, loadSettings]);

  if (!isOpen || !settings) return null;

  const showSaveSuccess = (msg: string) => {
    playSuccessSound();
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleUpdate = async (partial: Partial<AlfredSettings>) => {
    playClickSound();
    if (window.electron?.settings) {
      const updated = await window.electron.settings.update(partial);
      setSettings(updated);
      showSaveSuccess("Settings saved successfully.");
    }
  };

  const handleReset = async () => {
    playClickSound();
    if (window.electron?.settings) {
      const reset = await window.electron.settings.reset();
      setSettings(reset);
      showSaveSuccess("Settings reset to defaults.");
    }
  };

  const handleClearNotifications = async () => {
    playClickSound();
    if (window.electron?.notifications?.clearHistory) {
      await window.electron.notifications.clearHistory();
      showSaveSuccess("Notification history cleared.");
    }
  };

  const handleClearKnowledge = async () => {
    playClickSound();
    if (window.electron?.knowledge?.clear) {
      await window.electron.knowledge.clear();
      showSaveSuccess("Local knowledge base cleared.");
    }
  };

  const handleClearMemories = async () => {
    playClickSound();
    if (window.electron?.memory?.clear) {
      await window.electron.memory.clear();
      showSaveSuccess("User memories cleared.");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl h-[720px] bg-[#0c0d10] border border-white/10 rounded-xl flex flex-col shadow-2xl overflow-hidden font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <SettingsIcon size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-wide text-white flex items-center gap-2">
                  ALFRED SETTINGS & PERMISSIONS
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    SECURE ENGINE
                  </span>
                </h2>
                <p className="text-xs text-white/50">Local-first desktop intelligence configuration</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar navigation */}
            <div className="w-56 border-r border-white/10 bg-black/40 p-3 space-y-1">
              <button
                onClick={() => { playClickSound(); setActiveTab("ai"); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "ai"
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Cpu size={16} />
                AI Intelligence
              </button>
              <button
                onClick={() => { playClickSound(); setActiveTab("voice"); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "voice"
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Mic size={16} />
                Voice & Audio
              </button>
              <button
                onClick={() => { playClickSound(); setActiveTab("appearance"); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "appearance"
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Palette size={16} />
                Appearance & Hotkey
              </button>
              <button
                onClick={() => { playClickSound(); setActiveTab("notifications"); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "notifications"
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Bell size={16} />
                Notifications & Tray
              </button>
              <button
                onClick={() => { playClickSound(); setActiveTab("security"); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "security"
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Shield size={16} />
                Security & Safety
              </button>
              <button
                onClick={() => { playClickSound(); setActiveTab("apps"); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "apps"
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Laptop size={16} />
                Approved Applications
              </button>
              <button
                onClick={() => { playClickSound(); setActiveTab("onboarding"); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === "onboarding"
                    ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Sparkles size={16} />
                Onboarding & Reset
              </button>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {savedNotice && (
                <div className="p-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  {savedNotice}
                </div>
              )}

              {/* Tab 1: AI */}
              {activeTab === "ai" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">AI Intelligence Provider</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {(["mock", "ollama", "gemini", "claude"] as const).map((prov) => (
                        <button
                          key={prov}
                          onClick={() => handleUpdate({ aiProvider: { ...settings.aiProvider, activeProvider: prov } })}
                          className={`p-3.5 rounded-lg border text-left flex flex-col justify-between transition-all ${
                            settings.aiProvider.activeProvider === prov
                              ? "bg-cyan-500/10 border-cyan-500/40 text-cyan-300"
                              : "bg-white/[0.02] border-white/10 text-white/70 hover:border-white/20"
                          }`}
                        >
                          <div className="font-medium capitalize text-sm">{prov === "mock" ? "Local Deterministic (Mock)" : prov}</div>
                          <div className="text-[11px] text-white/40 mt-1">
                            {prov === "mock"
                              ? "Zero cloud dependency, fast local rules"
                              : prov === "ollama"
                              ? "Local open-source LLM server (Qwen 2.5 / Llama 3)"
                              : "Cloud provider (API key required)"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10 space-y-2">
                    <div className="text-xs font-semibold text-white/90">Autonomous Planning & Tools</div>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      ALFRED uses a multi-tier tool dispatch engine with strict validation. Selected provider handles intent decomposition, workspace launching, and task decomposition.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: Voice */}
              {activeTab === "voice" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] border border-white/10">
                    <div>
                      <div className="text-xs font-medium text-white">Speech-to-Text (Whisper Local)</div>
                      <div className="text-[11px] text-white/50">Transcribes voice commands locally on device with low latency</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.voice.enabled}
                      onChange={(e) => handleUpdate({ voice: { ...settings.voice, enabled: e.target.checked } })}
                      className="h-4 w-4 rounded accent-cyan-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] border border-white/10">
                    <div>
                      <div className="text-xs font-medium text-white">Wake Word Engine (&quot;Hey Alfred&quot;)</div>
                      <div className="text-[11px] text-white/50">Continuous local keyword listening via openWakeWord</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.wakeWord.enabled}
                      onChange={(e) => handleUpdate({ wakeWord: { ...settings.wakeWord, enabled: e.target.checked } })}
                      className="h-4 w-4 rounded accent-cyan-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] border border-white/10">
                    <div>
                      <div className="text-xs font-medium text-white">Text-to-Speech (TTS) Spoken Output</div>
                      <div className="text-[11px] text-white/50">Speaks concise factual summaries for briefings and execution updates</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.tts.enabled}
                      onChange={(e) => handleUpdate({ tts: { ...settings.tts, enabled: e.target.checked } })}
                      className="h-4 w-4 rounded accent-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* Tab 3: Appearance & Hotkey */}
              {activeTab === "appearance" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Global Desktop Hotkey</h3>
                    <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-white flex items-center gap-2">
                          <Keyboard size={16} className="text-cyan-400" />
                          Summon ALFRED Shortcut
                        </div>
                        <div className="text-[11px] text-white/50">Restores window from tray and focuses the command bar</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={shortcutInput}
                          onChange={(e) => setShortcutInput(e.target.value)}
                          className="bg-black/60 border border-white/20 rounded px-2.5 py-1 text-xs text-cyan-300 font-mono w-48 text-center"
                        />
                        <button
                          onClick={() => handleUpdate({ hotkey: { enabled: true, shortcut: shortcutInput } })}
                          className="px-3 py-1 rounded bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs border border-cyan-500/30"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-white/[0.02] border border-white/10 space-y-2">
                    <div className="text-xs font-semibold text-white/90">Visual Interface & Motion</div>
                    <p className="text-[11px] text-white/50 leading-relaxed">
                      ALFRED honors Windows system-wide accessibility settings including <code className="text-cyan-300 font-mono">prefers-reduced-motion</code>. When enabled, continuous decorative rotations are halted and replaced with smooth opacity transitions.
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 4: Notifications & Tray */}
              {activeTab === "notifications" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] border border-white/10">
                    <div>
                      <div className="text-xs font-medium text-white">Quiet Hours Mode</div>
                      <div className="text-[11px] text-white/50">Mutes non-urgent notifications between 10 PM and 7 AM</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.notifications.quietHoursEnabled}
                      onChange={(e) => handleUpdate({ notifications: { ...settings.notifications, quietHoursEnabled: e.target.checked } })}
                      className="h-4 w-4 rounded accent-cyan-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] border border-white/10">
                    <div>
                      <div className="text-xs font-medium text-white">Close to System Tray</div>
                      <div className="text-[11px] text-white/50">Keeps ALFRED background intelligence and hotkeys active when closed</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.background.closeToTray}
                      onChange={(e) => handleUpdate({ background: { ...settings.background, closeToTray: e.target.checked } })}
                      className="h-4 w-4 rounded accent-cyan-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] border border-white/10">
                    <div>
                      <div className="text-xs font-medium text-white">Scheduled Routines Engine</div>
                      <div className="text-[11px] text-white/50">Execute scheduled briefings and morning routines at set hours</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.automation.allowScheduledRoutines}
                      onChange={(e) => handleUpdate({ automation: { ...settings.automation, allowScheduledRoutines: e.target.checked } })}
                      className="h-4 w-4 rounded accent-cyan-500"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3.5 rounded-lg bg-white/[0.02] border border-white/10">
                    <div>
                      <div className="text-xs font-medium text-white">Conditional Event Automations</div>
                      <div className="text-[11px] text-white/50">Trigger actions upon focus completion or task progress events</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.automation.allowConditionalAutomations}
                      onChange={(e) => handleUpdate({ automation: { ...settings.automation, allowConditionalAutomations: e.target.checked } })}
                      className="h-4 w-4 rounded accent-cyan-500"
                    />
                  </div>
                </div>
              )}

              {/* Tab 5: Security & Safety */}
              {activeTab === "security" && (
                <div className="space-y-5">
                  <div className="p-3.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs leading-relaxed">
                    <div className="font-semibold flex items-center gap-1.5 mb-1">
                      <Shield size={14} /> Strict Execution Chain Enforced
                    </div>
                    Permissions + Risk Policy + Confirmation Store + ToolRegistry. Disabling a category halts actions before planning.
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wider">Functional Permissions</h4>
                    
                    <label className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium text-white">Productivity Mutations</div>
                        <div className="text-[11px] text-white/50">Creating or editing tasks, goals, and projects</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.permissions.productivity_mutation}
                        onChange={(e) => handleUpdate({ permissions: { ...settings.permissions, productivity_mutation: e.target.checked } })}
                        className="h-4 w-4 rounded accent-cyan-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium text-white">Desktop Workspace Control</div>
                        <div className="text-[11px] text-white/50">Launching workspaces and whitelisted local desktop tools</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.permissions.desktop_control}
                        onChange={(e) => handleUpdate({ permissions: { ...settings.permissions, desktop_control: e.target.checked } })}
                        className="h-4 w-4 rounded accent-cyan-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium text-white">Personal Knowledge Access</div>
                        <div className="text-[11px] text-white/50">Allows semantic retrieval over your explicitly imported documents</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.permissions.knowledge_access}
                        onChange={(e) => handleUpdate({ permissions: { ...settings.permissions, knowledge_access: e.target.checked } })}
                        className="h-4 w-4 rounded accent-cyan-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium text-white">Automations & Scheduled Routines</div>
                        <div className="text-[11px] text-white/50">Permits background event rules and routine scheduler execution</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.permissions.automation}
                        onChange={(e) => handleUpdate({ permissions: { ...settings.permissions, automation: e.target.checked } })}
                        className="h-4 w-4 rounded accent-cyan-500"
                      />
                    </label>
                  </div>

                  <div className="pt-4 border-t border-white/10 space-y-3">
                    <h4 className="text-xs font-semibold text-white/80 uppercase tracking-wider">Safety Enforcement</h4>

                    <label className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium text-emerald-300">Require Human Confirmation for Mutations</div>
                        <div className="text-[11px] text-white/50">Strictly pauses multi-step routine mutations at Confirmation Store</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.permissions.requireConfirmationForMutations}
                        onChange={(e) => handleUpdate({ permissions: { ...settings.permissions, requireConfirmationForMutations: e.target.checked } })}
                        className="h-4 w-4 rounded accent-emerald-500"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/10 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium text-white">Strict Data-Only Mode</div>
                        <div className="text-[11px] text-white/50">Treats all imported documents, memories, and task text as untrusted data</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.permissions.strictDataOnlyMode}
                        disabled
                        className="h-4 w-4 rounded accent-cyan-500 opacity-60"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Tab 5.5: Approved Applications */}
              {activeTab === "apps" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                        Approved Applications Registry
                      </h3>
                      <p className="text-xs text-white/50 mt-0.5">
                        Applications authorized to execute when requested by you or inside active workspaces.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        playClickSound();
                        setIsAppPickerOpen(true);
                      }}
                      className="px-3.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm"
                    >
                      <Laptop size={14} />
                      <span>Manage Applications</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {approvedAppsList.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/10"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-2 rounded bg-white/[0.04] text-cyan-400 mt-0.5 shrink-0">
                            <Laptop size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{app.name}</span>
                              {app.isBuiltIn ? (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-mono">
                                  BUILT-IN
                                </span>
                              ) : (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                                  USER APPROVED
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-white/40 truncate max-w-md font-mono mt-0.5">
                              {app.executablePath}
                            </div>
                            {app.aliases && app.aliases.length > 0 && (
                              <div className="text-[10px] text-white/50 mt-1 font-mono">
                                Aliases: {app.aliases.join(", ")}
                              </div>
                            )}
                          </div>
                        </div>

                        {!app.isBuiltIn && (
                          <button
                            onClick={async () => {
                              playClickSound();
                              if (window.electron?.apps?.revoke) {
                                await window.electron.apps.revoke(app.id);
                                const updated = await window.electron.apps.getApproved();
                                setApprovedAppsList(updated || []);
                                showSaveSuccess(`Revoked authorization for ${app.name}`);
                              }
                            }}
                            className="p-1.5 rounded text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Revoke Authorization"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 6: Onboarding & Danger */}
              {activeTab === "onboarding" && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">System Setup & Onboarding</h3>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] border border-white/10">
                      <div>
                        <div className="text-xs font-medium text-white flex items-center gap-2">
                          <Sparkles size={14} className="text-cyan-400" />
                          Re-run Setup Wizard
                        </div>
                        <div className="text-[11px] text-white/50 mt-0.5">
                          Relaunch the guided telemetry onboarding flow at any time
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          playClickSound();
                          onClose();
                          setTimeout(() => window.dispatchEvent(new CustomEvent("open-onboarding-modal")), 100);
                        }}
                        className="px-3.5 py-1.5 rounded bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 text-xs font-medium border border-cyan-500/30 transition-all"
                      >
                        Launch Wizard
                      </button>
                    </div>
                  </div>

                  {/* Distinct Danger Card */}
                  <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-red-400 text-xs font-semibold uppercase tracking-wider">
                      <AlertTriangle size={15} /> Data Maintenance & Danger Zone
                    </div>
                    <p className="text-[11px] text-red-200/60 leading-relaxed">
                      These actions permanently delete cached records or revert configuration to factory defaults.
                    </p>

                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                        <div>
                          <div className="text-xs font-medium text-white">Clear Notification History</div>
                          <div className="text-[11px] text-white/40">Purges persisted notification records</div>
                        </div>
                        <button
                          onClick={handleClearNotifications}
                          className="px-3 py-1 rounded bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10 text-xs"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                        <div>
                          <div className="text-xs font-medium text-white">Clear Local Knowledge Base</div>
                          <div className="text-[11px] text-white/40">Deletes imported documents, chunks, and index cache</div>
                        </div>
                        <button
                          onClick={handleClearKnowledge}
                          className="px-3 py-1 rounded bg-red-500/15 text-red-300 hover:bg-red-500/25 border border-red-500/30 text-xs flex items-center gap-1.5"
                        >
                          <Trash2 size={12} /> Clear Knowledge
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                        <div>
                          <div className="text-xs font-medium text-white">Clear Stored User Memories</div>
                          <div className="text-[11px] text-white/40">Removes long-term user preferences and context</div>
                        </div>
                        <button
                          onClick={handleClearMemories}
                          className="px-3 py-1 rounded bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10 text-xs"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-amber-500/20">
                        <div>
                          <div className="text-xs font-medium text-amber-200">Reset All Settings</div>
                          <div className="text-[11px] text-amber-200/50">Restores default AI provider, shortcuts, and permissions</div>
                        </div>
                        <button
                          onClick={handleReset}
                          className="px-3 py-1 rounded bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30 text-xs flex items-center gap-1.5"
                        >
                          <RefreshCw size={12} /> Reset Defaults
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-white/[0.02] text-[11px] text-white/40">
            <div>ALFRED OS v0.1.0 • Phase 6 Integrated Engine</div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded bg-white/10 text-white hover:bg-white/20 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>

        {/* Application Picker Modal */}
        <ApplicationPickerModal
          isOpen={isAppPickerOpen}
          onClose={() => {
            setIsAppPickerOpen(false);
            loadSettings();
          }}
          onSelectApplication={() => {}}
        />
      </div>
    </AnimatePresence>
  );
}
