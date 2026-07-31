"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Radar, Crosshair, Target, Briefcase, Database, Activity, Shield } from "lucide-react";
import { playHoverSound, playClickSound } from "@/utils/audioSystem";

export default function Sidebar() {
  const pathname = usePathname();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const menuItems = [
    { name: "MISSION CONTROL", href: "/", icon: <Radar size={18} /> },
    { name: "MISSIONS", href: "/tasks", icon: <Crosshair size={18} /> },
    { name: "TACTICAL GOALS", href: "/goals", icon: <Target size={18} /> },
    { name: "ARCHIVES", href: "/projects", icon: <Database size={18} /> },
    { name: "WORKSPACES", href: "/workspaces", icon: <Briefcase size={18} /> },
  ];

  return (
    <div className="w-64 h-full hud-panel border-r border-[#00BFFF]/30 flex-col hidden md:flex shrink-0 relative z-40">
      <div className="p-6 border-b border-[#00BFFF]/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-8 h-8 bg-[#00BFFF]/10 border-l border-b border-[#00BFFF]/30"></div>
        <div className="text-2xl font-header font-bold text-[#00BFFF] tracking-widest text-glow flex items-center">
          <Shield size={24} className="mr-3 text-[#00BFFF]" />
          ALFRED
        </div>
        <div className="text-[12px] font-data text-[#DFF6FF] mt-1 tracking-widest font-bold">
          OS VERSION 2.0.4
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto">
        <div className="text-xs font-data text-[#00E5FF] mb-4 px-2 uppercase tracking-widest font-bold">
          Core Systems
        </div>
        {menuItems.map((item, index) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={index}
              href={item.href}
              onMouseEnter={() => {
                setHoveredIndex(index);
                playHoverSound();
              }}
              onMouseLeave={() => setHoveredIndex(null)}
              onClick={() => playClickSound()}
              className="relative block cursor-pointer group"
            >
              <div className={`flex items-center space-x-3 p-3 z-10 relative transition-colors duration-300 ${
                isActive ? "text-[#00BFFF] text-glow" : "text-[#A8C7FA] group-hover:text-[#00E5FF]"
              }`}>
                {item.icon}
                <span className="font-header text-sm font-bold tracking-wider">{item.name}</span>
                {isActive && (
                  <motion.div 
                    layoutId="activeIndicator"
                    className="absolute left-0 w-1 h-3/4 bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]"
                  />
                )}
              </div>
              {/* Holographic background fill */}
              <div className={`absolute inset-0 border border-transparent transition-all duration-300 ${
                isActive ? "bg-[#00BFFF]/10 border-[#00BFFF]/50 shadow-[inset_0_0_15px_rgba(0,191,255,0.2)]" : ""
              } ${hoveredIndex === index && !isActive ? "bg-[#00BFFF]/5 border-[#00BFFF]/20" : ""}`} />
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-6 border-t border-[#00BFFF]/30 bg-[#00BFFF]/5 relative overflow-hidden">
         <div className="absolute -left-10 -bottom-10 w-24 h-24 bg-[#00BFFF]/10 rounded-full blur-xl"></div>
         <div className="flex items-center space-x-3 text-[#A8C7FA] transition-colors relative z-10 cursor-pointer group"
              onMouseEnter={() => playHoverSound()}
              onClick={() => playClickSound()}
         >
          <div className="w-10 h-10 border border-[#00BFFF]/50 bg-[#020508] flex items-center justify-center text-[#00E5FF] font-header font-bold group-hover:shadow-[0_0_15px_rgba(0,191,255,0.4)] transition-all">
            CMDR
          </div>
          <div>
            <span className="font-header text-sm tracking-widest group-hover:text-glow text-[#00E5FF]">COMMANDER</span>
            <div className="flex items-center text-xs font-data text-[#DFF6FF] mt-1 tracking-widest">
              <Activity size={12} className="mr-1 text-green-400" /> Vitals: NOMINAL
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
