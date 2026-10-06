"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import BootSequence from "./BootSequence";
import { subscribeToAlfredState, AlfredCoreVisualState } from "@/utils/activityBus";
import { AlfredAudioService } from "@/utils/audioSystem";

// Fast in-memory session flag for client-side React remounts and Next.js route navigation
let gSessionBootCompleted = false;

function checkIsSessionBootedSync(): boolean {
  if (typeof window === "undefined") return false;
  if (gSessionBootCompleted) return true;
  if ((window as any).__ALFRED_BOOT_COMPLETED__ === true) return true;
  try {
    return sessionStorage.getItem("alfred_session_boot_completed") === "true";
  } catch {
    return false;
  }
}

export default function AppWrapper({ children }: { children: React.ReactNode }) {
  // If already booted in this process/session, start with false; otherwise show cinematic boot.
  const [showBoot, setShowBoot] = useState<boolean>(() => !checkIsSessionBootedSync());
  const [isMounted, setIsMounted] = useState(false);
  const prevStateRef = useRef<AlfredCoreVisualState>("idle");

  useEffect(() => {
    setIsMounted(true);

    // Authoritative check against Electron main process session state
    const checkBootStatus = async () => {
      // If module or window memory already knows boot completed, don't show boot
      if (checkIsSessionBootedSync()) {
        setShowBoot(false);
        return;
      }

      if (typeof window !== "undefined" && window.electron?.system?.isBootCompleted) {
        try {
          const completed = await window.electron.system.isBootCompleted();
          if (completed) {
            gSessionBootCompleted = true;
            (window as any).__ALFRED_BOOT_COMPLETED__ = true;
            try {
              sessionStorage.setItem("alfred_session_boot_completed", "true");
            } catch {}
            setShowBoot(false);
          } else {
            // New application process: must show boot sequence
            setShowBoot(true);
          }
        } catch {
          if (checkIsSessionBootedSync()) {
            setShowBoot(false);
          }
        }
      }
    };

    checkBootStatus();

    // Global listener for ALFRED state transitions to trigger sound language
    const unsubscribe = subscribeToAlfredState((state: AlfredCoreVisualState) => {
      const prev = prevStateRef.current;
      if (prev === state) return; // Prevent playing on re-render / identical state
      prevStateRef.current = state;

      switch (state) {
        case "thinking":
          AlfredAudioService.startThinking();
          break;
        case "executing":
          AlfredAudioService.stopThinking();
          AlfredAudioService.play("executing");
          break;
        case "waiting_for_confirmation":
          AlfredAudioService.stopThinking();
          AlfredAudioService.play("confirmation");
          break;
        case "success":
          AlfredAudioService.stopThinking();
          AlfredAudioService.play("success");
          break;
        case "error":
          AlfredAudioService.stopThinking();
          AlfredAudioService.play("error");
          break;
        case "idle":
        case "listening":
          AlfredAudioService.stopThinking();
          break;
      }
    });

    return () => {
      unsubscribe();
      AlfredAudioService.stopThinking();
    };
  }, []);

  const handleBootComplete = useCallback(async () => {
    gSessionBootCompleted = true;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("alfred_session_boot_completed", "true");
        (window as any).__ALFRED_BOOT_COMPLETED__ = true;
      } catch {}

      if (window.electron?.system?.markBootCompleted) {
        try {
          await window.electron.system.markBootCompleted();
        } catch {}
      }
    }
    setShowBoot(false);
  }, []);

  if (!isMounted) return <div className="h-screen w-full bg-[#020508]"></div>;

  return (
    <>
      {showBoot ? (
        <BootSequence onComplete={handleBootComplete} />
      ) : (
        children
      )}
    </>
  );
}
