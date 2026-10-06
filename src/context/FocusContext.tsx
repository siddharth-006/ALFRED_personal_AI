"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { AlfredAudioService } from "@/utils/audioSystem";

export type FocusSessionState = "idle" | "running" | "paused" | "completed";

export interface FocusSessionRecord {
  id: string;
  durationMinutes: number;
  completedAt: string;
  timestamp: number;
}

export interface FocusStats {
  todayFocusMinutes: number;
  totalFocusMinutes: number;
  completedSessionsCount: number;
  lastCompletedSessionDate: string | null;
  sessionHistory?: FocusSessionRecord[];
}

interface FocusContextType {
  // Config
  durationMinutes: number;
  setDurationMinutes: (minutes: number) => void;
  // Timer state
  timerState: FocusSessionState;
  remainingSeconds: number;
  // Actions
  startFocus: () => void;
  pauseFocus: () => void;
  resumeFocus: () => void;
  resetFocus: () => void;
  addFiveMinutes: () => void;
  // Stats
  stats: FocusStats;
}

const FocusContext = createContext<FocusContextType | undefined>(undefined);

const PRESET_STORAGE_KEY = "alfred_focus_stats_v1";

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function FocusProvider({ children }: { children: React.ReactNode }) {
  const [durationMinutes, setDurationMinutesState] = useState<number>(25);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(25 * 60);
  const [timerState, setTimerState] = useState<FocusSessionState>("idle");

  const [stats, setStats] = useState<FocusStats>({
    todayFocusMinutes: 0,
    totalFocusMinutes: 0,
    completedSessionsCount: 0,
    lastCompletedSessionDate: null,
    sessionHistory: [],
  });

  // Track timestamps for accurate drift-free countdown
  const targetEndTimestampRef = useRef<number | null>(null);
  const pausedRemainingSecondsRef = useRef<number>(25 * 60);

  // 1. Load persisted stats
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PRESET_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = getTodayKey();
        const history: FocusSessionRecord[] = Array.isArray(parsed.sessionHistory)
          ? parsed.sessionHistory
          : [];

        // Reset todayFocusMinutes if last recorded date is not today
        if (parsed.lastDate !== today) {
          setStats({
            todayFocusMinutes: 0,
            totalFocusMinutes: parsed.totalFocusMinutes || 0,
            completedSessionsCount: parsed.completedSessionsCount || 0,
            lastCompletedSessionDate: parsed.lastDate || null,
            sessionHistory: history,
          });
        } else {
          setStats({
            todayFocusMinutes: parsed.todayFocusMinutes || 0,
            totalFocusMinutes: parsed.totalFocusMinutes || 0,
            completedSessionsCount: parsed.completedSessionsCount || 0,
            lastCompletedSessionDate: parsed.lastDate || null,
            sessionHistory: history,
          });
        }
      }
    } catch {
      // Fallback to initial zeros on error
    }
  }, []);

  // 2. Set duration
  const setDurationMinutes = (minutes: number) => {
    const validMinutes = Math.max(1, Math.min(180, Math.round(minutes)));
    setDurationMinutesState(validMinutes);
    if (timerState === "idle" || timerState === "completed") {
      setRemainingSeconds(validMinutes * 60);
      pausedRemainingSecondsRef.current = validMinutes * 60;
    }
  };

  // 3. Start focus
  const startFocus = () => {
    const secs = remainingSeconds > 0 ? remainingSeconds : durationMinutes * 60;
    setRemainingSeconds(secs);
    targetEndTimestampRef.current = Date.now() + secs * 1000;
    setTimerState("running");
    AlfredAudioService.play("focusStart");
  };

  // 4. Pause focus
  const pauseFocus = () => {
    if (timerState !== "running") return;
    if (targetEndTimestampRef.current) {
      const remainingMs = Math.max(0, targetEndTimestampRef.current - Date.now());
      const secs = Math.ceil(remainingMs / 1000);
      pausedRemainingSecondsRef.current = secs;
      setRemainingSeconds(secs);
    }
    targetEndTimestampRef.current = null;
    setTimerState("paused");
    AlfredAudioService.play("focusPause");
  };

  // 5. Resume focus
  const resumeFocus = () => {
    if (timerState !== "paused") return;
    const secs = pausedRemainingSecondsRef.current > 0 ? pausedRemainingSecondsRef.current : durationMinutes * 60;
    targetEndTimestampRef.current = Date.now() + secs * 1000;
    setTimerState("running");
    AlfredAudioService.play("focusResume");
  };

  // 6. Reset focus
  const resetFocus = () => {
    targetEndTimestampRef.current = null;
    const initialSecs = durationMinutes * 60;
    pausedRemainingSecondsRef.current = initialSecs;
    setRemainingSeconds(initialSecs);
    setTimerState("idle");
    AlfredAudioService.play("focusReset");
  };

  // 7. Add 5 minutes to current timer
  const addFiveMinutes = () => {
    const bonusSecs = 5 * 60;
    if (timerState === "running" && targetEndTimestampRef.current) {
      targetEndTimestampRef.current += bonusSecs * 1000;
      setRemainingSeconds((prev) => prev + bonusSecs);
    } else {
      pausedRemainingSecondsRef.current += bonusSecs;
      setRemainingSeconds((prev) => prev + bonusSecs);
    }
  };

  // 8. Session completion handler
  const handleSessionCompleted = (durationMin: number) => {
    setTimerState("completed");
    targetEndTimestampRef.current = null;
    setRemainingSeconds(0);
    AlfredAudioService.play("focusComplete");

    if (typeof window !== "undefined") {
      import("@/utils/activityBus").then(({ dispatchAlfredActivity }) => {
        dispatchAlfredActivity({
          type: "command_completed",
          state: "success",
          label: "FOCUS SESSION COMPLETED",
          detail: `Finished ${durationMin}m session`,
        });
      });
    }

    // Accumulate real focus minutes and session record into stats
    setStats((prev) => {
      const today = getTodayKey();
      const updatedToday = (prev.lastCompletedSessionDate === today ? prev.todayFocusMinutes : 0) + durationMin;
      const updatedTotal = prev.totalFocusMinutes + durationMin;
      const updatedCount = prev.completedSessionsCount + 1;

      const newRecord: FocusSessionRecord = {
        id: `focus_${Date.now()}`,
        durationMinutes: durationMin,
        completedAt: today,
        timestamp: Date.now(),
      };
      const updatedHistory = [newRecord, ...(prev.sessionHistory || [])].slice(0, 100);

      const newStats: FocusStats = {
        todayFocusMinutes: updatedToday,
        totalFocusMinutes: updatedTotal,
        completedSessionsCount: updatedCount,
        lastCompletedSessionDate: today,
        sessionHistory: updatedHistory,
      };

      try {
        localStorage.setItem(
          PRESET_STORAGE_KEY,
          JSON.stringify({
            todayFocusMinutes: updatedToday,
            totalFocusMinutes: updatedTotal,
            completedSessionsCount: updatedCount,
            lastDate: today,
            sessionHistory: updatedHistory,
          })
        );
      } catch {}

      return newStats;
    });
  };

  // 9. Countdown interval using high-precision timestamp check
  useEffect(() => {
    if (timerState !== "running") return;

    const interval = setInterval(() => {
      if (!targetEndTimestampRef.current) return;
      const remainingMs = targetEndTimestampRef.current - Date.now();
      if (remainingMs <= 0) {
        clearInterval(interval);
        handleSessionCompleted(durationMinutes);
      } else {
        setRemainingSeconds(Math.ceil(remainingMs / 1000));
      }
    }, 250);

    return () => clearInterval(interval);
  }, [timerState, durationMinutes]);

  return (
    <FocusContext.Provider
      value={{
        durationMinutes,
        setDurationMinutes,
        timerState,
        remainingSeconds,
        startFocus,
        pauseFocus,
        resumeFocus,
        resetFocus,
        addFiveMinutes,
        stats,
      }}
    >
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const context = useContext(FocusContext);
  if (!context) {
    throw new Error("useFocus must be used within a FocusProvider");
  }
  return context;
}
