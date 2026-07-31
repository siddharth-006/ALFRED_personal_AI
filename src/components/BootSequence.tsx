"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { initAudio, playStartupSound, playScanSound } from "@/utils/audioSystem";

const BOOT_LOGS = [
  "ESTABLISHING SECURE CONNECTION...",
  "LOADING AI CORE...",
  "CONNECTING TO MEMORY ENGINE...",
  "ACTIVATING PRODUCTIVITY SYSTEM...",
  "INITIALIZING FOCUS ENGINE...",
  "CHECKING SECURITY MODULES..."
];

const SUCCESS_LOGS = [
  "✓ AI CORE ONLINE",
  "✓ MEMORY SYSTEM ONLINE",
  "✓ TASK ENGINE ONLINE",
  "✓ PRODUCTIVITY MODULE ONLINE",
  "✓ FOCUS ENGINE ONLINE",
  "✓ SECURITY SYSTEM ONLINE"
];

interface BootSequenceProps {
  onComplete: () => void;
}

export default function BootSequence({ onComplete }: BootSequenceProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"awaiting_interaction" | "init" | "loading" | "success" | "granted">("awaiting_interaction");

  const startBoot = () => {
    setPhase("init");
    
    // We now have guaranteed user interaction, so audio will always play.
    try {
      initAudio();
      playStartupSound();
    } catch (e) {}

    const runSequence = async () => {
      // Start immediately to sync with audio
      setPhase("loading");

      // Loading phase (takes 1.2 seconds, syncing with mechanical clanks)
      for (let i = 0; i < BOOT_LOGS.length; i++) {
        await new Promise(r => setTimeout(r, 200));
        setLogs(prev => [...prev, BOOT_LOGS[i]]);
        setProgress(Math.floor(((i + 1) / BOOT_LOGS.length) * 100));
        // Removed playScanSound() so it doesn't clash with the mechanical startup clanks
      }

      // Wait until 1.5s mark for the heavy bass drop
      await new Promise(r => setTimeout(r, 300));
      setPhase("success");

      // Success Phase (takes 0.6 seconds)
      for (let i = 0; i < SUCCESS_LOGS.length; i++) {
        await new Promise(r => setTimeout(r, 100));
        setLogs(prev => [...prev, SUCCESS_LOGS[i]]);
      }

      // Wait until 2.5s mark to show granted
      await new Promise(r => setTimeout(r, 400));
      setPhase("granted");

      // Wait until the 4.0s audio sequence finishes entirely
      await new Promise(r => setTimeout(r, 1500));
      onComplete();
    };

    runSequence();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#020508] text-[#00BFFF] font-mono flex flex-col p-8 overflow-hidden">
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-30 bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,191,255,0.1)_50%,rgba(0,191,255,0.1))] bg-[length:100%_4px] z-10" />
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative z-20 max-w-3xl mx-auto w-full flex flex-col h-full justify-center"
      >
        <div className="animate-flicker">
          <h1 className="text-4xl font-header font-bold mb-2 tracking-widest text-glow-strong">ALFRED OPERATING SYSTEM</h1>
          <h2 className="text-xl mb-8 tracking-wider opacity-80">VERSION 2.0</h2>
        </div>

        <div className="space-y-2 mb-8 font-data">
          {logs.map((log, i) => (
             <motion.div
               key={i}
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               className={`${log.startsWith('✓') ? 'text-[#7DF9FF]' : 'text-[#00BFFF]'}`}
             >
               {log}
             </motion.div>
          ))}
        </div>

        {phase !== "init" && phase !== "granted" && phase !== "awaiting_interaction" && (
          <div className="w-full mt-4">
            <div className="flex justify-between text-sm mb-2 font-data">
              <span>SYSTEM BOOT</span>
              <span>[{progress}%]</span>
            </div>
            <div className="h-2 w-full border border-[#00BFFF] p-[1px]">
              <motion.div 
                className="h-full bg-[#00BFFF] shadow-[0_0_10px_#00BFFF]"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>
        )}

        {phase === "awaiting_interaction" && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 text-center animate-flicker flex flex-col items-center justify-center"
          >
            <button 
              onClick={startBoot}
              className="text-2xl font-header text-glow-strong text-[#00E5FF] mb-4 border border-[#00E5FF] px-8 py-4 hover:bg-[#00E5FF] hover:text-[#020508] transition-colors duration-300"
            >
              INITIALIZE SYSTEM
            </button>
            <p className="text-lg tracking-widest opacity-80">AWAITING COMMANDER OVERRIDE</p>
          </motion.div>
        )}

        {phase === "granted" && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-12 text-center animate-flicker"
          >
            <h2 className="text-3xl font-header text-glow-strong text-[#00E5FF] mb-4 border-y border-[#00E5FF] py-4">ACCESS GRANTED</h2>
            <p className="text-xl tracking-widest">WELCOME BACK COMMANDER</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
