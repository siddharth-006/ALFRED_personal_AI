"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  X,
  Calendar,
  Zap,
  Bell,
  Trash2,
  Plus,
  Moon,
  Volume2,
} from "lucide-react";
import { playClickSound, playSuccessSound } from "@/utils/audioSystem";
import type { ScheduledRoutine } from "../../electron/agent/scheduler/scheduler.types";
import type { AutomationRule } from "../../electron/agent/automation/automation.types";
import type { NotificationPreferences, NotificationRecord } from "../../electron/services/notification-manager.types";

interface AutomationSchedulesModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  defaultTab?: "schedules" | "automations" | "notifications";
}

export default function AutomationSchedulesModal({
  isOpen: controlledIsOpen,
  onClose: controlledOnClose,
  defaultTab = "schedules",
}: AutomationSchedulesModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const onClose = useCallback(() => {
    if (controlledOnClose) {
      controlledOnClose();
    } else {
      setInternalIsOpen(false);
    }
  }, [controlledOnClose]);

  useEffect(() => {
    const handleOpen = () => {
      playClickSound();
      setInternalIsOpen(true);
    };
    window.addEventListener("open-automation-modal", handleOpen);
    return () => window.removeEventListener("open-automation-modal", handleOpen);
  }, []);

  const [activeTab, setActiveTab] = useState<"schedules" | "automations" | "notifications">(defaultTab);

  const [schedules, setSchedules] = useState<ScheduledRoutine[]>([]);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [history, setHistory] = useState<NotificationRecord[]>([]);

  // Form states
  const [schedName, setSchedName] = useState("Coding Mode");
  const [schedTarget, setSchedTarget] = useState<"routine" | "briefing" | "weekly_review">("routine");
  const [schedHour, setSchedHour] = useState(19);
  const [schedMinute, setSchedMinute] = useState(0);

  const loadData = useCallback(async () => {
    if (typeof window === "undefined" || !window.electron) return;

    if (window.electron.schedules?.getSchedules) {
      try {
        const s = await window.electron.schedules.getSchedules();
        setSchedules(s || []);
      } catch (err) {
        console.error("Failed to load schedules:", err);
      }
    }

    if (window.electron.automations?.getRules) {
      try {
        const a = await window.electron.automations.getRules();
        setAutomations(a || []);
      } catch (err) {
        console.error("Failed to load automations:", err);
      }
    }

    if (window.electron.notifications?.getPreferences) {
      try {
        const p = await window.electron.notifications.getPreferences();
        setPreferences(p);
      } catch (err) {
        console.error("Failed to load notification preferences:", err);
      }
    }

    if (window.electron.notifications?.getHistory) {
      try {
        const h = await window.electron.notifications.getHistory({ limit: 20 });
        setHistory(h || []);
      } catch (err) {
        console.error("Failed to load notification history:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const handleToggleSchedule = async (id: string, current: boolean) => {
    playClickSound();
    if (window.electron?.schedules?.setEnabled) {
      await window.electron.schedules.setEnabled(id, !current);
      loadData();
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    playClickSound();
    if (window.electron?.schedules?.delete) {
      await window.electron.schedules.delete(id);
      loadData();
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();
    if (window.electron?.schedules?.create) {
      await window.electron.schedules.create({
        name: schedName,
        targetType: schedTarget,
        targetId: schedTarget === "routine" ? "coding-mode" : undefined,
        hour: schedHour,
        minute: schedMinute,
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays
      });
      playSuccessSound();
      loadData();
    }
  };

  const handleToggleAutomation = async (id: string, current: boolean) => {
    playClickSound();
    if (window.electron?.automations?.setEnabled) {
      await window.electron.automations.setEnabled(id, !current);
      loadData();
    }
  };

  const handleDeleteAutomation = async (id: string) => {
    playClickSound();
    if (window.electron?.automations?.delete) {
      await window.electron.automations.delete(id);
      loadData();
    }
  };

  const handleAddPresetAutomation = async (type: "coding_finish" | "task_complete") => {
    playClickSound();
    if (!window.electron?.automations?.create) return;

    if (type === "coding_finish") {
      await window.electron.automations.create({
        name: "Notify when coding finishes",
        eventType: "focus_completed",
        action: {
          type: "notification",
          params: {
            title: "Focus Complete",
            message: "Your scheduled coding session has finished.",
            category: "focus",
          },
        },
        cooldownSeconds: 30,
      });
    } else {
      await window.electron.automations.create({
        name: "Recommend next task on completion",
        eventType: "task_completed",
        action: {
          type: "recommendation",
        },
        cooldownSeconds: 30,
      });
    }
    playSuccessSound();
    loadData();
  };

  const handleUpdatePreference = async (updates: Partial<NotificationPreferences>) => {
    playClickSound();
    if (window.electron?.notifications?.updatePreferences) {
      const updated = await window.electron.notifications.updatePreferences(updates);
      setPreferences(updated);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-2xl bg-[#07090E] border border-white/[0.1] rounded-lg shadow-[0_12px_48px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4]">
              <Zap size={16} />
            </div>
            <div>
              <h3 className="font-header text-sm font-bold tracking-wider text-white uppercase">
                ALFRED AUTOMATION & INTELLIGENCE
              </h3>
              <p className="text-[10px] font-mono text-slate-400">
                Scheduled routines, event-driven rules, and notification controls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.08] bg-black/40 text-xs font-mono">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setActiveTab("schedules");
            }}
            className={`flex-1 py-2.5 px-4 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "schedules"
                ? "border-[#06B6D4] text-white font-bold bg-[#06B6D4]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calendar size={14} />
            <span>SCHEDULES ({schedules.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setActiveTab("automations");
            }}
            className={`flex-1 py-2.5 px-4 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "automations"
                ? "border-[#06B6D4] text-white font-bold bg-[#06B6D4]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap size={14} />
            <span>AUTOMATIONS ({automations.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setActiveTab("notifications");
            }}
            className={`flex-1 py-2.5 px-4 flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === "notifications"
                ? "border-[#06B6D4] text-white font-bold bg-[#06B6D4]/10"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Bell size={14} />
            <span>NOTIFICATIONS</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 font-mono text-xs text-slate-300">
          {/* ================= SCHEDULES TAB ================= */}
          {activeTab === "schedules" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Active Schedules</span>
                <span className="text-[10px] text-slate-500">Max 20 schedules</span>
              </div>

              {schedules.length === 0 ? (
                <div className="p-4 rounded border border-white/[0.06] bg-white/[0.02] text-center text-slate-500">
                  No routines are currently scheduled.
                </div>
              ) : (
                <div className="space-y-2">
                  {schedules.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded border border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-white font-bold text-xs truncate">{s.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                          <span className="text-[#06B6D4]">
                            {s.hour.toString().padStart(2, "0")}:{s.minute.toString().padStart(2, "0")}
                          </span>
                          <span>•</span>
                          <span>{s.daysOfWeek.length === 5 ? "Weekdays" : s.daysOfWeek.length === 7 ? "Daily" : "Custom days"}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleSchedule(s.id, s.enabled)}
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                            s.enabled
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-white/[0.04] text-slate-500 border border-white/[0.08]"
                          }`}
                        >
                          {s.enabled ? "Active" : "Disabled"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(s.id)}
                          className="p-1 rounded text-slate-500 hover:text-[#E11D48] transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Schedule Form */}
              <form onSubmit={handleCreateSchedule} className="p-3.5 rounded border border-white/[0.06] bg-black/40 space-y-3">
                <div className="font-bold text-[11px] text-white uppercase flex items-center gap-1.5">
                  <Plus size={13} className="text-[#06B6D4]" />
                  <span>Schedule Routine</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={schedTarget}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setSchedTarget(val);
                      if (val === "routine") setSchedName("Coding Mode");
                      if (val === "briefing") setSchedName("Morning Briefing");
                      if (val === "weekly_review") setSchedName("Weekly Review");
                    }}
                    className="p-2 rounded bg-black/60 border border-white/[0.1] text-xs text-white"
                  >
                    <option value="routine">Coding Mode (Routine)</option>
                    <option value="briefing">Morning Briefing</option>
                    <option value="weekly_review">Weekly Review</option>
                  </select>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={schedHour}
                      onChange={(e) => setSchedHour(parseInt(e.target.value, 10))}
                      className="w-16 p-2 rounded bg-black/60 border border-white/[0.1] text-center text-white"
                      title="Hour (0-23)"
                    />
                    <span className="text-white">:</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={schedMinute}
                      onChange={(e) => setSchedMinute(parseInt(e.target.value, 10))}
                      className="w-16 p-2 rounded bg-black/60 border border-white/[0.1] text-center text-white"
                      title="Minute (0-59)"
                    />
                  </div>
                  <button
                    type="submit"
                    className="p-2 rounded bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4] text-[#06B6D4] hover:text-white font-bold uppercase transition-all cursor-pointer"
                  >
                    Add Schedule
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ================= AUTOMATIONS TAB ================= */}
          {activeTab === "automations" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Active Conditional Rules</span>
                <span className="text-[10px] text-slate-500">Loop-protected</span>
              </div>

              {automations.length === 0 ? (
                <div className="p-4 rounded border border-white/[0.06] bg-white/[0.02] text-center text-slate-500">
                  No conditional automations are currently configured.
                </div>
              ) : (
                <div className="space-y-2">
                  {automations.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded border border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-white font-bold text-xs truncate">{a.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center space-x-2">
                          <span className="text-[#06B6D4]">On: {a.eventType}</span>
                          <span>•</span>
                          <span>Action: {a.action.type}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleAutomation(a.id, a.enabled)}
                          className={`px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                            a.enabled
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-white/[0.04] text-slate-500 border border-white/[0.08]"
                          }`}
                        >
                          {a.enabled ? "Active" : "Disabled"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAutomation(a.id)}
                          className="p-1 rounded text-slate-500 hover:text-[#E11D48] transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Presets */}
              <div className="p-3.5 rounded border border-white/[0.06] bg-black/40 space-y-2">
                <span className="font-bold text-[11px] text-white uppercase">Add Safe Automation Preset</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddPresetAutomation("coding_finish")}
                    className="px-3 py-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={12} className="text-[#06B6D4]" />
                    <span>Notify when coding session finishes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPresetAutomation("task_complete")}
                    className="px-3 py-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={12} className="text-[#06B6D4]" />
                    <span>Recommend next task on completion</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= NOTIFICATIONS TAB ================= */}
          {activeTab === "notifications" && preferences && (
            <div className="space-y-4">
              <div className="p-3.5 rounded border border-white/[0.06] bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Volume2 size={15} className="text-[#06B6D4]" />
                    <span className="font-bold text-white uppercase text-xs">Master Notifications</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUpdatePreference({ enabled: !preferences.enabled })}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                      preferences.enabled
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "bg-white/[0.04] text-slate-500 border border-white/[0.08]"
                    }`}
                  >
                    {preferences.enabled ? "Enabled" : "Disabled"}
                  </button>
                </div>

                {/* Quiet Hours */}
                <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Moon size={15} className="text-amber-400" />
                    <div>
                      <div className="text-white font-bold text-xs">Quiet Hours (10 PM - 7 AM)</div>
                      <div className="text-[10px] text-slate-400">Suppress non-urgent notifications</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdatePreference({
                        quietHours: {
                          ...preferences.quietHours,
                          enabled: !preferences.quietHours.enabled,
                        },
                      })
                    }
                    className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${
                      preferences.quietHours.enabled
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-white/[0.04] text-slate-500 border border-white/[0.08]"
                    }`}
                  >
                    {preferences.quietHours.enabled ? "Active" : "Off"}
                  </button>
                </div>
              </div>

              {/* Notification History */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Recent Notifications</span>
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        playClickSound();
                        if (window.electron?.notifications?.clearHistory) {
                          await window.electron.notifications.clearHistory();
                          setHistory([]);
                        }
                      }}
                      className="text-[10px] text-slate-500 hover:text-white transition-colors cursor-pointer"
                    >
                      Clear History
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <div className="p-3 rounded border border-white/[0.06] bg-white/[0.02] text-center text-slate-500">
                    No recent notifications.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto">
                    {history.slice(-8).reverse().map((n) => (
                      <div
                        key={n.id}
                        className="p-2.5 rounded border border-white/[0.06] bg-black/40 flex items-center justify-between text-[11px]"
                      >
                        <div className="truncate pr-2">
                          <span className="text-white font-bold">{n.title}: </span>
                          <span className="text-slate-400">{n.body}</span>
                        </div>
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 shrink-0">
                          {n.category}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
