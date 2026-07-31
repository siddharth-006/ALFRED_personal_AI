"use client";

import React, { useEffect, useState } from "react";
import { Cpu, Database, Network, Battery } from "lucide-react";

export default function BottomSystemBar() {
  const [cpu, setCpu] = useState(12);
  const [ram, setRam] = useState(45);
  const [net, setNet] = useState(1024);

  useEffect(() => {
    // Simulate changing telemetry
    const interval = setInterval(() => {
      setCpu(prev => Math.max(5, Math.min(95, prev + (Math.random() * 10 - 5))));
      setRam(prev => Math.max(30, Math.min(80, prev + (Math.random() * 4 - 2))));
      setNet(prev => Math.max(100, Math.min(5000, prev + (Math.random() * 400 - 200))));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-8 hud-panel border-t border-[#00BFFF]/30 flex items-center justify-between px-4 z-50 shrink-0 text-[10px] font-data text-[#A8C7FA]">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2 w-24">
          <Cpu size={12} className="text-[#00BFFF]" />
          <span>CPU: {cpu.toFixed(1)}%</span>
        </div>
        <div className="flex items-center space-x-2 w-24">
          <Database size={12} className="text-[#00BFFF]" />
          <span>RAM: {ram.toFixed(1)}%</span>
        </div>
        <div className="flex items-center space-x-2 w-32 hidden sm:flex">
          <Network size={12} className="text-[#00BFFF]" />
          <span>NET: {(net / 1024).toFixed(2)} MB/s</span>
        </div>
      </div>

      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <span>AI SYNC: 100%</span>
        </div>
        <div className="flex items-center space-x-2">
          <Battery size={12} className="text-[#00BFFF]" />
          <span>PWR: DIRECT</span>
        </div>
      </div>
    </div>
  );
}
