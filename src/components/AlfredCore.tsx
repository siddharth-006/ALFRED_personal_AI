"use client";

import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Activity,
  Layers,
  Flame,
  CheckSquare,
  Clock,
} from "lucide-react";
import { playClickSound, playHoverSound } from "@/utils/audioSystem";
import AlfredEmblem from "./AlfredEmblem";

export type CoreState =
  | "idle"
  | "wake_monitoring"
  | "wake_detected"
  | "listening"
  | "thinking"
  | "executing"
  | "speaking"
  | "success"
  | "error"
  | "waiting_for_confirmation"
  | "focus";

export interface ProductivitySummary {
  completedTasks?: number;
  totalTasks?: number;
  currentStreak?: number;
  activeProjects?: number;
  focusCategory?: string | null;
  todayFocusMinutes?: number;
}

interface AlfredCoreProps {
  state?: CoreState;
  intent?: string | null;
  target?: string | null;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
  compact?: boolean;
  interactive?: boolean;
  productivityData?: ProductivitySummary;
  onClick?: () => void;
}

type HoverZone = "core" | "tasks" | "focus" | "projects" | "orbit" | null;

export default function AlfredCore({
  state = "idle",
  intent,
  target,
  className = "",
  size = "md",
  compact = false,
  interactive = true,
  productivityData,
  onClick,
}: AlfredCoreProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<HoverZone>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Parallax / Proximity tilt handler
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!interactive || !containerRef.current || size === "xs") return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const mouseX = e.clientX - centerX;
      const mouseY = e.clientY - centerY;
      // Keep tilt subtle (max +/- 6px / degrees)
      const maxTilt = 6;
      const tiltX = Math.max(-maxTilt, Math.min(maxTilt, (mouseX / (rect.width / 2)) * maxTilt));
      const tiltY = Math.max(-maxTilt, Math.min(maxTilt, (mouseY / (rect.height / 2)) * maxTilt));
      setTilt({ x: tiltX, y: tiltY });
    },
    [interactive, size]
  );

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setHoveredZone(null);
    setTilt({ x: 0, y: 0 });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (interactive) {
      try {
        playHoverSound();
      } catch {
        // audio context safe
      }
    }
  }, [interactive]);

  const handleClick = useCallback(() => {
    if (!interactive) return;
    try {
      playClickSound();
    } catch {
      // audio context safe
    }
    if (onClick) {
      onClick();
    } else if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-command-terminal"));
    }
  }, [interactive, onClick]);

  // Dimensions based on size prop
  const getDimensions = () => {
    switch (size) {
      case "xs":
        return {
          container: "w-8 h-8",
          chamber: "w-5 h-5",
          svgSize: 32,
          orbitR: 14,
          arcR: 11,
          innerR: 9,
          iconSize: 11,
          monogramSize: "w-3.5 h-3.5 text-[8px]",
          ringR: 13,
        };
      case "sm":
        return {
          container: "w-36 h-36 md:w-44 md:h-44",
          chamber: "w-20 h-20 md:w-24 md:h-24",
          svgSize: 160,
          orbitR: 70,
          arcR: 58,
          innerR: 48,
          iconSize: 22,
          monogramSize: "w-6 h-6 text-[10px]",
          ringR: 74,
        };
      case "lg":
        return {
          container: "w-64 h-64 md:w-72 md:h-72",
          chamber: "w-36 h-36 md:w-40 md:h-40",
          svgSize: 280,
          orbitR: 126,
          arcR: 108,
          innerR: 90,
          iconSize: 36,
          monogramSize: "w-10 h-10 text-xs",
          ringR: 132,
        };
      case "md":
      default:
        return {
          container: "w-52 h-52 md:w-60 md:h-60",
          chamber: "w-30 h-30 md:w-34 md:h-34",
          svgSize: 230,
          orbitR: 104,
          arcR: 88,
          innerR: 74,
          iconSize: 30,
          monogramSize: "w-8 h-8 text-xs",
          ringR: 110,
        };
    }
  };

  const dims = getDimensions();

  // Color language mapped to operational states
  const getStateColors = () => {
    switch (state) {
      case "wake_monitoring":
        return {
          primary: "#38BDF8", // Gentle electric sky blue
          secondary: "#06B6D4",
          glow: "rgba(56, 189, 248, 0.35)",
          label: "STANDBY // LISTENING FOR WAKE WORD",
          sublabel: 'Say "Hey Alfred" to activate',
        };
      case "wake_detected":
        return {
          primary: "#F43F5E", // Rose / Amber radiant pulse
          secondary: "#06B6D4",
          glow: "rgba(244, 63, 94, 0.65)",
          label: "WAKE DETECTED // INITIALIZING RECEPTOR",
          sublabel: "Ready for command...",
        };
      case "listening":
        return {
          primary: "#06B6D4", // Cyan
          secondary: "#38BDF8",
          glow: "rgba(6, 182, 212, 0.45)",
          label: "LISTENING // INPUT STREAM ACTIVE",
          sublabel: "Awaiting operator command",
        };
      case "thinking":
        return {
          primary: "#06B6D4",
          secondary: "#F59E0B",
          glow: "rgba(6, 182, 212, 0.45)",
          label: "THINKING // EVALUATING DIRECTIVE",
          sublabel: "Evaluating execution plan & risk",
        };
      case "executing":
        return {
          primary: "#E11D48", // Crimson
          secondary: "#06B6D4",
          glow: "rgba(225, 29, 72, 0.55)",
          label: "EXECUTING // TOOL PIPELINE ACTIVE",
          sublabel: "Running sequential tool sequence",
        };
      case "focus":
        return {
          primary: "#E11D48",
          secondary: "#F43F5E",
          glow: "rgba(225, 29, 72, 0.50)",
          label: "FOCUS SESSION ACTIVE // DEEP WORK",
          sublabel: "No distractions • Timed productivity matrix",
        };
      case "success":
        return {
          primary: "#10B981", // Emerald
          secondary: "#06B6D4",
          glow: "rgba(16, 185, 129, 0.45)",
          label: "SUCCESS // ALL METRICS NOMINAL",
          sublabel: "Action dispatched successfully",
        };
      case "error":
        return {
          primary: "#EF4444", // Restrained Red / Amber
          secondary: "#F59E0B",
          glow: "rgba(239, 68, 68, 0.45)",
          label: "ERROR // EXECUTION HALTED",
          sublabel: "Command execution failed or rejected",
        };
      case "waiting_for_confirmation":
        return {
          primary: "#F59E0B", // Amber
          secondary: "#E11D48",
          glow: "rgba(245, 158, 11, 0.5)",
          label: "CONFIRMATION REQUIRED // SECURITY GATE",
          sublabel: "High-risk action waiting for authorization",
        };
      case "speaking":
        return {
          primary: "#06B6D4", // Restrained cyan pulse
          secondary: "#38BDF8",
          glow: "rgba(6, 182, 212, 0.55)",
          label: "SPEAKING // AUDIO SYNTHESIS ACTIVE",
          sublabel: "Delivering synthesized vocal response",
        };
      case "idle":
      default:
        return {
          primary: isHovered ? "#06B6D4" : "#E11D48", // Crimson baseline, shifts to cyan on hover
          secondary: isHovered ? "#E11D48" : "#06B6D4",
          glow: isHovered ? "rgba(6, 182, 212, 0.35)" : "rgba(225, 29, 72, 0.22)",
          label: isHovered
            ? "ALFRED CORE // CLICK TO COMMAND"
            : "ALFRED CORE // ALL SYSTEMS NOMINAL",
          sublabel: "Personal AI Workstation standing by",
        };
    }
  };

  const colors = getStateColors();
  const prefersReduced = useReducedMotion();

  // Controlled, low-CPU orbital rotation durations (disabled if reduced motion preferred)
  const outerDuration = prefersReduced
    ? 0
    : state === "thinking"
    ? 16
    : state === "executing"
    ? 10
    : state === "speaking"
    ? 20
    : isHovered
    ? 30
    : 60;
  const innerDuration = prefersReduced
    ? 0
    : state === "thinking"
    ? 12
    : state === "executing"
    ? 8
    : state === "speaking"
    ? 16
    : isHovered
    ? 24
    : 45;

  // Generate 24 radial tick marks
  const tickMarks = Array.from({ length: 24 }).map((_, i) => {
    const angle = i * 15;
    const isCardinal = angle % 90 === 0;
    const isSecondary = angle % 45 === 0;
    return { angle, isCardinal, isSecondary };
  });

  // Calculate Productivity Ring metrics
  const taskPct =
    productivityData?.totalTasks && productivityData.totalTasks > 0
      ? Math.round(((productivityData.completedTasks ?? 0) / productivityData.totalTasks) * 100)
      : 0;
  const focusMins = productivityData?.todayFocusMinutes ?? 0;
  const activeProj = productivityData?.activeProjects ?? 0;

  // Segment stroke parameters for 3-part productivity ring (Task, Focus, Projects)
  const ringCircumference = 2 * Math.PI * dims.ringR;
  const segGap = ringCircumference * 0.05; // gap between segments
  const segLength = (ringCircumference - 3 * segGap) / 3;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className={`relative flex flex-col items-center justify-center select-none ${
        interactive ? "cursor-pointer group" : ""
      } ${className}`}
    >
      {/* 3D Parallax & Depth Container */}
      <motion.div
        className={`relative ${dims.container} flex items-center justify-center`}
        animate={{
          x: tilt.x,
          y: tilt.y,
          scale: isHovered ? 1.03 : 1,
        }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
      >
        {/* Layer 1: Ambient Radial Reactor Aura */}
        <motion.div
          className="absolute inset-0 rounded-full blur-2xl pointer-events-none"
          animate={{
            backgroundColor: colors.glow,
            scale: prefersReduced
              ? 1
              : state === "executing"
              ? [1, 1.12, 1]
              : state === "thinking"
              ? [1, 1.06, 1]
              : state === "focus"
              ? [1, 1.08, 1]
              : state === "speaking"
              ? [1, 1.08, 1]
              : isHovered
              ? [1, 1.04, 1]
              : [1, 1.015, 1],
            opacity: state === "idle" ? (isHovered ? 0.45 : 0.22) : 0.65,
          }}
          transition={{
            duration: prefersReduced ? 0 : state === "executing" || state === "focus" ? 1.6 : isHovered ? 2.5 : 4.5,
            repeat: prefersReduced ? 0 : Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Layer 2: Productivity Metric Ring (Subtle tri-segment visualization) */}
        {size !== "xs" && productivityData && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0"
            viewBox={`0 0 ${dims.svgSize} ${dims.svgSize}`}
          >
            {/* Background Track */}
            <circle
              cx={dims.svgSize / 2}
              cy={dims.svgSize / 2}
              r={dims.ringR}
              fill="none"
              stroke="rgba(255, 255, 255, 0.04)"
              strokeWidth="2.5"
            />

            {/* Segment 1: Tasks (Top-right) */}
            <circle
              cx={dims.svgSize / 2}
              cy={dims.svgSize / 2}
              r={dims.ringR}
              fill="none"
              stroke="#06B6D4"
              strokeWidth={hoveredZone === "tasks" ? "4.5" : "2.5"}
              strokeDasharray={`${(taskPct / 100) * segLength} ${ringCircumference}`}
              strokeDashoffset="0"
              strokeLinecap="round"
              className="transition-all duration-300"
              style={{
                filter: hoveredZone === "tasks" ? "drop-shadow(0 0 6px #06B6D4)" : "none",
                transform: `rotate(-90deg)`,
                transformOrigin: "50% 50%",
              }}
            />

            {/* Segment 2: Focus Minutes (Bottom) */}
            <circle
              cx={dims.svgSize / 2}
              cy={dims.svgSize / 2}
              r={dims.ringR}
              fill="none"
              stroke="#E11D48"
              strokeWidth={hoveredZone === "focus" ? "4.5" : "2.5"}
              strokeDasharray={`${Math.min(1, focusMins / 60) * segLength} ${ringCircumference}`}
              strokeDashoffset={`${-(segLength + segGap)}`}
              strokeLinecap="round"
              className="transition-all duration-300"
              style={{
                filter: hoveredZone === "focus" ? "drop-shadow(0 0 6px #E11D48)" : "none",
                transform: `rotate(-90deg)`,
                transformOrigin: "50% 50%",
              }}
            />

            {/* Segment 3: Active Projects (Top-left) */}
            <circle
              cx={dims.svgSize / 2}
              cy={dims.svgSize / 2}
              r={dims.ringR}
              fill="none"
              stroke="#10B981"
              strokeWidth={hoveredZone === "projects" ? "4.5" : "2.5"}
              strokeDasharray={`${Math.min(1, activeProj / 5) * segLength} ${ringCircumference}`}
              strokeDashoffset={`${-2 * (segLength + segGap)}`}
              strokeLinecap="round"
              className="transition-all duration-300"
              style={{
                filter: hoveredZone === "projects" ? "drop-shadow(0 0 6px #10B981)" : "none",
                transform: `rotate(-90deg)`,
                transformOrigin: "50% 50%",
              }}
            />
          </svg>
        )}

        {/* Layer 3: Outer Instrumentation Tick-Mark Orbit SVG */}
        <motion.svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${dims.svgSize} ${dims.svgSize}`}
          animate={{ rotate: 360 }}
          transition={{ duration: outerDuration, repeat: Infinity, ease: "linear" }}
        >
          {/* Base outer circle */}
          <circle
            cx={dims.svgSize / 2}
            cy={dims.svgSize / 2}
            r={dims.orbitR}
            fill="none"
            stroke={colors.primary}
            strokeWidth="1.2"
            strokeDasharray="4 8"
            strokeOpacity="0.4"
          />

          {/* Radial Ticks */}
          {tickMarks.map((tick, i) => {
            const rad = (tick.angle * Math.PI) / 180;
            const rInner = dims.orbitR - (tick.isCardinal ? 6 : tick.isSecondary ? 4 : 2);
            const rOuter = dims.orbitR;
            const x1 = dims.svgSize / 2 + rInner * Math.cos(rad);
            const y1 = dims.svgSize / 2 + rInner * Math.sin(rad);
            const x2 = dims.svgSize / 2 + rOuter * Math.cos(rad);
            const y2 = dims.svgSize / 2 + rOuter * Math.sin(rad);

            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={tick.isCardinal ? colors.secondary : colors.primary}
                strokeWidth={tick.isCardinal ? "1.6" : "1"}
                strokeOpacity={tick.isCardinal ? "0.8" : "0.35"}
              />
            );
          })}

          {/* Cardinal Orbital Node Beads */}
          <circle
            cx={dims.svgSize / 2}
            cy={dims.svgSize / 2 - dims.orbitR}
            r="2.8"
            fill={colors.secondary}
          />
          <circle
            cx={dims.svgSize / 2}
            cy={dims.svgSize / 2 + dims.orbitR}
            r="2.8"
            fill={colors.secondary}
          />
          <circle
            cx={dims.svgSize / 2 - dims.orbitR}
            cy={dims.svgSize / 2}
            r="2.8"
            fill={colors.secondary}
          />
          <circle
            cx={dims.svgSize / 2 + dims.orbitR}
            cy={dims.svgSize / 2}
            r="2.8"
            fill={colors.secondary}
          />
        </motion.svg>

        {/* Layer 4: Counter-Rotating Precision Segmented Arc Ring */}
        <motion.svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${dims.svgSize} ${dims.svgSize}`}
          animate={{ rotate: -360 }}
          transition={{ duration: innerDuration, repeat: Infinity, ease: "linear" }}
        >
          <circle
            cx={dims.svgSize / 2}
            cy={dims.svgSize / 2}
            r={dims.arcR}
            fill="none"
            stroke={colors.secondary}
            strokeWidth="1.6"
            strokeDasharray="34 18 56 14 12 24"
            strokeOpacity="0.55"
          />
          <circle
            cx={dims.svgSize / 2}
            cy={dims.svgSize / 2}
            r={dims.innerR}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1"
          />
        </motion.svg>

        {/* Layer 5: Orbital Data Particle Nodes (4 micro data pips) */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ rotate: 360 }}
          transition={{ duration: innerDuration * 1.5, repeat: Infinity, ease: "linear" }}
        >
          <div
            className="absolute w-1.5 h-1.5 rounded-full shadow-[0_0_8px_#06B6D4]"
            style={{
              backgroundColor: colors.secondary,
              top: `${((dims.svgSize / 2 - dims.arcR) / dims.svgSize) * 100}%`,
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
          <div
            className="absolute w-1.5 h-1.5 rounded-full shadow-[0_0_8px_#E11D48]"
            style={{
              backgroundColor: colors.primary,
              bottom: `${((dims.svgSize / 2 - dims.arcR) / dims.svgSize) * 100}%`,
              left: "50%",
              transform: "translate(-50%, 50%)",
            }}
          />
        </motion.div>

        {/* Layer 6: Radar Scanning Sweep (Active on Thinking / Executing / Focus / Hover) */}
        {(state === "thinking" || state === "executing" || state === "focus" || isHovered) && (
          <motion.div
            className="absolute rounded-full pointer-events-none overflow-hidden"
            style={{
              width: `${(dims.arcR * 2 * 100) / dims.svgSize}%`,
              height: `${(dims.arcR * 2 * 100) / dims.svgSize}%`,
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: state === "executing" ? 1.6 : state === "focus" ? 2.0 : 2.4,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <div
              className="w-1/2 h-1/2 absolute top-0 right-0 origin-bottom-left"
              style={{
                background: `linear-gradient(45deg, transparent 40%, ${colors.glow} 100%)`,
              }}
            />
          </motion.div>
        )}

        {/* Layer 7: Center Holographic Reactor Chamber */}
        <motion.div
          onMouseEnter={() => setHoveredZone("core")}
          className={`relative ${dims.chamber} rounded-full flex flex-col items-center justify-center border shadow-2xl z-10`}
          style={{
            background:
              "radial-gradient(circle, rgba(14,19,29,0.96) 0%, rgba(6,9,14,0.99) 100%)",
            borderColor: colors.primary,
          }}
          animate={{
            borderColor: colors.primary,
            boxShadow: `0 0 28px ${colors.glow}`,
            scale: prefersReduced
              ? 1
              : state === "listening"
              ? [1, 1.04, 1]
              : state === "waiting_for_confirmation"
              ? [1, 1.03, 1]
              : state === "focus"
              ? [1, 1.03, 1]
              : isHovered
              ? 1.02
              : 1,
          }}
          transition={{
            duration: prefersReduced ? 0 : state === "waiting_for_confirmation" ? 0.9 : 2.2,
            repeat:
              prefersReduced
                ? 0
                : state === "waiting_for_confirmation" ||
                  state === "listening" ||
                  state === "focus"
                ? Infinity
                : 0,
            ease: "easeInOut",
          }}
        >
          {/* Internal Chamber Subtle Grid / Pattern */}
          <div className="absolute inset-0 rounded-full opacity-15 bg-[radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />

          {/* Inner Geometric Pattern / Icon State Engine */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            {state === "waiting_for_confirmation" ? (
              <ShieldAlert size={dims.iconSize} className="text-amber-400 animate-pulse" />
            ) : state === "success" ? (
              <CheckCircle2 size={dims.iconSize} className="text-emerald-400" />
            ) : state === "error" ? (
              <AlertTriangle size={dims.iconSize} className="text-rose-500" />
            ) : state === "thinking" ? (
              <Cpu size={dims.iconSize} className="text-[#06B6D4] animate-pulse" />
            ) : state === "executing" ? (
              <Activity size={dims.iconSize} className="text-[#E11D48] animate-pulse" />
            ) : state === "focus" ? (
              <Clock size={dims.iconSize} className="text-[#E11D48] animate-pulse" />
            ) : (
              <div className="relative flex items-center justify-center">
                <AlfredEmblem
                  size={dims.iconSize * 1.4}
                  glow={false}
                  pulsing={state === "listening"}
                />
              </div>
            )}

            {/* Core Typography Identity */}
            <span
              className="mt-1 font-header font-bold text-xs tracking-widest uppercase transition-colors duration-300"
              style={{ color: colors.primary }}
            >
              ALFRED
            </span>
            <span className="text-[8px] font-mono text-white/50 tracking-wider">
              {state.toUpperCase()}
            </span>
          </div>
        </motion.div>
      </motion.div>

      {/* Layer 8: Operational Status Readout Ribbon (Suppressed in compact / xs mode) */}
      {!compact && size !== "xs" && (
        <div className="mt-3 flex flex-col items-center max-w-sm px-2 text-center">
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm group-hover:border-white/[0.18] transition-colors">
            <motion.div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: colors.primary }}
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <span className="text-xs font-header font-semibold tracking-wider uppercase text-white/90 truncate">
              {colors.label}
            </span>
          </div>

          {/* Live Intent & Target Telemetry (during execution/planning) */}
          {(intent || target) && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1 flex items-center space-x-3 text-[10px] font-mono text-white/50"
            >
              {intent && (
                <span>
                  INTENT: <span className="text-[#06B6D4] font-semibold">{intent.toUpperCase()}</span>
                </span>
              )}
              {target && (
                <span>
                  TARGET: <span className="text-white font-semibold">{target}</span>
                </span>
              )}
            </motion.div>
          )}

          {/* Interactive Core Micro-Telemetry & Productivity Ring Markers */}
          {productivityData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 flex items-center flex-wrap justify-center gap-2 text-[10px] font-mono"
            >
              {/* Tasks interactive chip */}
              <span
                onMouseEnter={() => setHoveredZone("tasks")}
                onMouseLeave={() => setHoveredZone(null)}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded cursor-pointer transition-all ${
                  hoveredZone === "tasks"
                    ? "bg-[#06B6D4]/20 border border-[#06B6D4] text-white shadow-[0_0_8px_#06B6D4]"
                    : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:text-white"
                }`}
              >
                <CheckSquare size={11} className="text-[#06B6D4]" />
                <span>
                  TASKS {productivityData.completedTasks ?? 0}/{productivityData.totalTasks ?? 0} ({taskPct}%)
                </span>
              </span>

              {/* Focus Today interactive chip */}
              <span
                onMouseEnter={() => setHoveredZone("focus")}
                onMouseLeave={() => setHoveredZone(null)}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded cursor-pointer transition-all ${
                  hoveredZone === "focus"
                    ? "bg-[#E11D48]/20 border border-[#E11D48] text-white shadow-[0_0_8px_#E11D48]"
                    : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:text-white"
                }`}
              >
                <Clock size={11} className="text-[#E11D48]" />
                <span>FOCUS {focusMins}M</span>
              </span>

              {/* Active Projects interactive chip */}
              <span
                onMouseEnter={() => setHoveredZone("projects")}
                onMouseLeave={() => setHoveredZone(null)}
                className={`flex items-center space-x-1 px-2 py-0.5 rounded cursor-pointer transition-all ${
                  hoveredZone === "projects"
                    ? "bg-emerald-500/20 border border-emerald-500 text-white shadow-[0_0_8px_#10B981]"
                    : "bg-white/[0.02] border border-white/[0.06] text-slate-400 hover:text-white"
                }`}
              >
                <Layers size={11} className="text-emerald-400" />
                <span>{activeProj} PROJECTS</span>
              </span>

              {/* Day Streak */}
              {productivityData.currentStreak !== undefined && (
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-white/[0.02] border border-white/[0.06] text-slate-400">
                  <Flame size={11} className="text-[#E11D48]" />
                  <span>{productivityData.currentStreak}D STREAK</span>
                </span>
              )}
            </motion.div>
          )}

          {/* Contextual Information Tooltip Overlay on Ring Hover */}
          <AnimatePresence>
            {hoveredZone && (
              <motion.div
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 3 }}
                className="mt-1.5 px-3 py-1 rounded bg-[#0B0E17]/95 border border-white/[0.15] text-[10px] font-mono text-slate-300 shadow-xl"
              >
                {hoveredZone === "tasks" && (
                  <span>
                    TASK COMPLETION: <strong className="text-[#06B6D4]">{productivityData?.completedTasks ?? 0} / {productivityData?.totalTasks ?? 0} ({taskPct}%)</strong>
                  </span>
                )}
                {hoveredZone === "focus" && (
                  <span>
                    FOCUS TODAY: <strong className="text-[#E11D48]">{focusMins} MINUTES</strong>
                  </span>
                )}
                {hoveredZone === "projects" && (
                  <span>
                    ACTIVE INITIATIVES: <strong className="text-emerald-400">{activeProj} PROJECTS RUNNING</strong>
                  </span>
                )}
                {hoveredZone === "core" && (
                  <span>
                    COMMAND SURFACE: <strong className="text-white">CLICK TO LAUNCH DIRECTIVES</strong>
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
