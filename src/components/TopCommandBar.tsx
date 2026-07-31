"use client";

import React, { useEffect, useState } from "react";
import { Activity, Wifi, ShieldAlert, Zap } from "lucide-react";

export default function TopCommandBar() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }));
      setDate(now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-12 hud-panel border-b border-[#00BFFF]/30 flex items-center justify-between px-6 z-50 shrink-0">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <Zap size={16} className="text-[#00BFFF] animate-pulse" />
          <span className="font-header text-[#00BFFF] font-bold tracking-widest text-glow">ALFRED OS</span>
        </div>
        <div className="hidden md:flex items-center space-x-4 text-xs font-data text-[#A8C7FA]">
          <span className="px-2 py-1 bg-[#00BFFF]/10 border border-[#00BFFF]/20">SYS: STABLE</span>
          <span className="px-2 py-1 bg-[#00BFFF]/10 border border-[#00BFFF]/20">NET: SECURE</span>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2 px-3 py-1 bg-[#00E5FF]/10 border border-[#00E5FF]/30">
          <div className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping" />
          <span className="font-data text-xs text-[#00E5FF] font-bold text-glow">AI CORE ONLINE</span>
        </div>
        <div className="text-right hidden sm:block">
          <div className="font-data text-sm text-[#DFF6FF]">{time}</div>
          <div className="font-data text-[10px] text-[#A8C7FA]">{date}</div>
        </div>
      </div>
    </div>
  );
}
