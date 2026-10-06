"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  CheckSquare,
  FolderGit2,
  Target,
  Layers,
  Sparkles,
  BarChart3,
  BrainCircuit,
  Settings2,
  Clock,
  BookOpen,
} from "lucide-react";
import { playHoverSound, playClickSound } from "@/utils/audioSystem";
import AlfredEmblem from "./AlfredEmblem";

interface NavItem {
  id: string;
  name: string;
  href?: string;
  icon: React.ReactNode;
  badge?: string;
  action?: () => void;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const openTerminal = (mode?: string) => {
    playClickSound();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("open-command-terminal", { detail: { mode } })
      );
    }
  };

  const sections: NavSection[] = [
    {
      title: "SYSTEM NAVIGATION",
      items: [
        {
          id: "dashboard",
          name: "Dashboard",
          href: "/",
          icon: <LayoutDashboard size={18} />,
        },
        {
          id: "projects",
          name: "Projects",
          href: "/projects",
          icon: <FolderGit2 size={18} />,
        },
        {
          id: "tasks",
          name: "Tasks",
          href: "/tasks",
          icon: <CheckSquare size={18} />,
        },
        {
          id: "goals",
          name: "Goals",
          href: "/goals",
          icon: <Target size={18} />,
        },
        {
          id: "workspaces",
          name: "Workspaces",
          href: "/workspaces",
          icon: <Layers size={18} />,
        },
        {
          id: "ai-assistant",
          name: "AI Assistant",
          action: () => openTerminal("assistant"),
          icon: <Sparkles size={18} className="text-[#06B6D4]" />,
        },
        {
          id: "analytics",
          name: "Analytics",
          href: "/analytics",
          icon: <BarChart3 size={18} />,
        },
        {
          id: "memory",
          name: "Memory",
          action: () => {
            playClickSound();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("open-memory-vault"));
            }
          },
          icon: <BrainCircuit size={18} className="text-[#06B6D4]" />,
          badge: "5.7",
        },
        {
          id: "knowledge",
          name: "Knowledge Vault",
          action: () => {
            playClickSound();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("open-knowledge-modal"));
            }
          },
          icon: <BookOpen size={18} className="text-[#06B6D4]" />,
          badge: "RAG",
        },
        {
          id: "automations",
          name: "Schedules & Rules",
          action: () => {
            playClickSound();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("open-automation-modal"));
            }
          },
          icon: <Clock size={18} className="text-[#06B6D4]" />,
          badge: "6.0",
        },
        {
          id: "settings",
          name: "Settings",
          action: () => {
            playClickSound();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("open-settings-modal"));
            }
          },
          icon: <Settings2 size={18} />,
        },
      ],
    },
  ];

  return (
    <aside className="w-56 h-full bg-[#07090E]/95 border-r border-white/[0.06] backdrop-blur-2xl flex flex-col hidden md:flex shrink-0 relative z-40 select-none">
      {/* Brand Header with Red Geometric Logo */}
      <div className="p-5 border-b border-white/[0.06] relative">
        <div className="flex items-center space-x-3.5">
          <AlfredEmblem size={32} pulsing={true} />
          <div className="flex-1 min-w-0">
            <h1 className="font-header text-base font-bold tracking-widest text-white leading-none">
              ALFRED
            </h1>
            <p className="text-[9px] text-[#E11D48] tracking-widest uppercase font-mono font-semibold mt-1">
              YOUR PERSONAL AI OS
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 p-2.5 space-y-4 overflow-y-auto">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            <div className="text-[9px] font-sans font-semibold text-slate-500 px-2 py-1 tracking-wider uppercase">
              {section.title}
            </div>

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = item.href ? pathname === item.href : false;
                const isHovered = hoveredId === item.id;

                const content = (
                  <div
                    className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl transition-all duration-150 relative ${
                      isActive
                        ? "text-white font-semibold shadow-[0_4px_20px_rgba(225,29,72,0.4)]"
                        : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebarActiveIndicator"
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#E11D48] to-[#BE123C] -z-10"
                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                      />
                    )}
                    <span
                      className={`transition-colors duration-150 relative z-10 ${
                        isActive ? "text-white" : isHovered ? "text-white" : "text-slate-400"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="text-sm font-sans tracking-wide truncate relative z-10">
                      {item.name}
                    </span>
                    {item.badge && (
                      <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-cyan-300 font-semibold relative z-10">
                        {item.badge}
                      </span>
                    )}
                  </div>
                );

                if (item.href) {
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onMouseEnter={() => {
                        setHoveredId(item.id);
                        playHoverSound();
                      }}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => playClickSound()}
                      className="block outline-none focus-visible:ring-1 focus-visible:ring-[#E11D48]"
                      aria-current={isActive ? "page" : undefined}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    onMouseEnter={() => {
                      setHoveredId(item.id);
                      playHoverSound();
                    }}
                    onMouseLeave={() => setHoveredId(null)}
                    className="w-full text-left block outline-none focus-visible:ring-1 focus-visible:ring-[#E11D48] cursor-pointer"
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Product Tour Action & Operator Session Footer */}
      <div className="p-3 border-t border-white/[0.06] bg-black/40 space-y-2">
        <button
          type="button"
          onClick={() => {
            playClickSound();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("open-alfred-demo"));
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-950/40 via-white/[0.03] to-rose-950/40 hover:from-cyan-900/50 hover:to-rose-900/50 border border-white/10 hover:border-cyan-400/40 text-xs font-mono font-semibold text-white tracking-wider transition-all cursor-pointer shadow-sm group"
        >
          <Sparkles size={13} className="text-[#06B6D4] group-hover:scale-110 transition-transform" />
          <span>EXPERIENCE ALFRED</span>
        </button>

        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center space-y-0.5">
          <p className="text-[10px] font-header font-bold text-white tracking-widest uppercase">
            &quot;DISCIPLINE BUILDS FREEDOM.&quot;
          </p>
          <div className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">
            ALFRED OPERATING CORE
          </div>
        </div>
      </div>
    </aside>
  );
}
