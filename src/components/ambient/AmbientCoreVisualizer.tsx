"use client";

import React, { useMemo } from "react";
import { AmbientMode } from "@/types/ambient";

interface AmbientCoreVisualizerProps {
  mode: AmbientMode;
  isPlaying: boolean;
  coreState?: string;
  size?: "sm" | "lg";
  onClick?: () => void;
}

export const AmbientCoreVisualizer: React.FC<AmbientCoreVisualizerProps> = ({
  mode,
  isPlaying,
  coreState = "idle",
  size = "sm",
  onClick,
}) => {
  const isLarge = size === "lg";
  const containerSize = isLarge ? "w-64 h-64 md:w-80 md:h-80" : "w-36 h-36";
  const coreRadius = isLarge ? "w-20 h-20" : "w-11 h-11";
  const orbitRadius = isLarge ? 88 : 44;

  // Derive animation speeds & colors based on system state & playback
  const isThinking = coreState === "thinking";
  const isListening = coreState === "listening";
  const isExecuting = coreState === "executing";
  const isSpeaking = coreState === "speaking";
  const isError = coreState === "error";

  const orbitDuration = useMemo(() => {
    if (isThinking) return "8s";
    if (isExecuting) return "10s";
    if (isPlaying) return "22s";
    return "36s";
  }, [isThinking, isExecuting, isPlaying]);

  const pulseDuration = useMemo(() => {
    if (isListening || isSpeaking) return "1.4s";
    if (isThinking) return "1.8s";
    if (isPlaying) return "3.2s";
    return "5s";
  }, [isListening, isSpeaking, isThinking, isPlaying]);

  const themeHex = mode.themeColor || "#06B6D4";

  // Mode-specific particles (low count for zero CPU/GPU overhead)
  const particles = useMemo(() => {
    if (mode.visualStyle === "deep-space") {
      return [
        { x: "20%", y: "25%", size: 3, delay: "0s", duration: "4s" },
        { x: "75%", y: "30%", size: 2, delay: "1.2s", duration: "5s" },
        { x: "85%", y: "70%", size: 3, delay: "2.1s", duration: "4.5s" },
        { x: "15%", y: "75%", size: 2, delay: "0.8s", duration: "6s" },
        { x: "50%", y: "15%", size: 2.5, delay: "1.7s", duration: "5.2s" },
        { x: "40%", y: "85%", size: 2, delay: "2.5s", duration: "4.8s" },
      ];
    }
    if (mode.visualStyle === "rain") {
      return [
        { x: "22%", y: "10%", size: 1.5, delay: "0.1s", duration: "1.2s", isRain: true },
        { x: "38%", y: "15%", size: 1.5, delay: "0.4s", duration: "1.1s", isRain: true },
        { x: "55%", y: "05%", size: 1.5, delay: "0.2s", duration: "1.3s", isRain: true },
        { x: "70%", y: "20%", size: 1.5, delay: "0.6s", duration: "1.0s", isRain: true },
        { x: "84%", y: "12%", size: 1.5, delay: "0.3s", duration: "1.4s", isRain: true },
      ];
    }
    if (mode.visualStyle === "cafe") {
      return [
        { x: "30%", y: "75%", size: 3, delay: "0s", duration: "3.5s", isEmber: true },
        { x: "45%", y: "80%", size: 2, delay: "1s", duration: "4s", isEmber: true },
        { x: "65%", y: "70%", size: 3.5, delay: "2s", duration: "3.8s", isEmber: true },
        { x: "75%", y: "85%", size: 2.5, delay: "0.7s", duration: "4.2s", isEmber: true },
      ];
    }
    return [];
  }, [mode.visualStyle]);

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${mode.name} Ambient Visualizer Core`}
      className={`relative ${containerSize} flex items-center justify-center select-none overflow-hidden rounded-full cursor-pointer group focus:outline-none focus:ring-1 focus:ring-cyan-400/40`}
      style={{
        background: `radial-gradient(circle, rgba(11,14,23,0.85) 0%, rgba(8,10,15,0.95) 75%, transparent 100%)`,
      }}
    >
      {/* Dynamic Background Glow */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-1000"
        style={{
          background: `radial-gradient(circle, ${themeHex}18 0%, transparent 68%)`,
          opacity: isPlaying ? 0.9 : 0.4,
        }}
      />

      {/* Mode-specific subtle particle layer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
        {particles.map((p, idx) => (
          <span
            key={idx}
            className="absolute rounded-full transition-transform"
            style={{
              left: p.x,
              top: p.y,
              width: `${p.size}px`,
              height: (p as any).isRain ? `${p.size * 5}px` : `${p.size}px`,
              backgroundColor: themeHex,
              opacity: isPlaying ? 0.65 : 0.3,
              boxShadow: `0 0 6px ${themeHex}`,
              animation: (p as any).isRain
                ? `ambientRainFall ${p.duration} linear infinite`
                : (p as any).isEmber
                ? `ambientEmberFloat ${p.duration} ease-in-out infinite`
                : `ambientDrift ${p.duration} ease-in-out infinite`,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      {/* SVG Orbital Geometry & Thin Technical Connecting Lines */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="-100 -100 200 200"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Outer Orbital Ring */}
        <circle
          cx="0"
          cy="0"
          r={orbitRadius}
          fill="none"
          stroke={themeHex}
          strokeWidth="0.75"
          strokeDasharray="4 6"
          opacity={isPlaying ? 0.5 : 0.25}
          style={{
            transformOrigin: "center",
            animation: `ambientSpin ${orbitDuration} linear infinite`,
          }}
        />

        {/* Inner Counter-Orbit Geometric Guide */}
        <circle
          cx="0"
          cy="0"
          r={orbitRadius * 0.65}
          fill="none"
          stroke={themeHex}
          strokeWidth="0.5"
          strokeDasharray="2 10"
          opacity="0.3"
          style={{
            transformOrigin: "center",
            animation: `ambientSpinReverse ${orbitDuration} linear infinite`,
          }}
        />

        {/* Crosshair Cardinal Coordinate Guides */}
        <line
          x1={-orbitRadius - 6}
          y1="0"
          x2={-orbitRadius + 4}
          y2="0"
          stroke={themeHex}
          strokeWidth="0.8"
          opacity="0.4"
        />
        <line
          x1={orbitRadius - 4}
          y1="0"
          x2={orbitRadius + 6}
          y2="0"
          stroke={themeHex}
          strokeWidth="0.8"
          opacity="0.4"
        />
        <line
          x1="0"
          y1={-orbitRadius - 6}
          x2="0"
          y2={-orbitRadius + 4}
          stroke={themeHex}
          strokeWidth="0.8"
          opacity="0.4"
        />
        <line
          x1="0"
          y1={orbitRadius - 4}
          x2="0"
          y2={orbitRadius + 6}
          stroke={themeHex}
          strokeWidth="0.8"
          opacity="0.4"
        />

        {/* 4 Connected Orbital Satellite Nodes:
              ◉
           ╱     ╲
         ◉  CORE   ◉
           ╲     ╱
              ◉
        */}
        <g
          style={{
            transformOrigin: "center",
            animation: `ambientSpin ${orbitDuration} linear infinite`,
          }}
        >
          {/* Top Satellite (0, -R) */}
          <circle cx="0" cy={-orbitRadius} r={isLarge ? 3.5 : 2.5} fill={themeHex} />
          {/* Right Satellite (R, 0) */}
          <circle cx={orbitRadius} cy="0" r={isLarge ? 3.5 : 2.5} fill={themeHex} />
          {/* Bottom Satellite (0, R) */}
          <circle cx="0" cy={orbitRadius} r={isLarge ? 3.5 : 2.5} fill={themeHex} />
          {/* Left Satellite (-R, 0) */}
          <circle cx={-orbitRadius} cy="0" r={isLarge ? 3.5 : 2.5} fill={themeHex} />

          {/* Thin Technical Diagonal Ties */}
          <line x1="0" y1={-orbitRadius} x2={orbitRadius} y2="0" stroke={themeHex} strokeWidth="0.4" opacity="0.3" />
          <line x1={orbitRadius} y1="0" x2="0" y2={orbitRadius} stroke={themeHex} strokeWidth="0.4" opacity="0.3" />
          <line x1="0" y1={orbitRadius} x2={-orbitRadius} y2="0" stroke={themeHex} strokeWidth="0.4" opacity="0.3" />
          <line x1={-orbitRadius} y1="0" x2="0" y2={-orbitRadius} stroke={themeHex} strokeWidth="0.4" opacity="0.3" />
        </g>
      </svg>

      {/* Central ALFRED Core Node */}
      <div
        className={`relative ${coreRadius} rounded-full flex flex-col items-center justify-center transition-all duration-700 shadow-lg`}
        style={{
          backgroundColor: "#0B0E17",
          border: `1.5px solid ${themeHex}90`,
          boxShadow: `0 0 ${isLarge ? "24px" : "12px"} ${themeHex}40, inset 0 0 12px ${themeHex}20`,
          animation: `ambientCorePulse ${pulseDuration} ease-in-out infinite`,
        }}
      >
        {/* Core Glyph Center */}
        <div
          className="w-2.5 h-2.5 rounded-full transition-transform duration-500"
          style={{
            backgroundColor: isError ? "#EF4444" : themeHex,
            boxShadow: `0 0 8px ${themeHex}`,
            transform: isPlaying ? "scale(1.2)" : "scale(1)",
          }}
        />

        {/* Small Technical Core Text */}
        <span
          className={`font-mono uppercase font-bold tracking-widest text-[${isLarge ? "9px" : "7px"}] mt-0.5 text-slate-300 opacity-80`}
          style={{ fontSize: isLarge ? "9px" : "7px" }}
        >
          CORE
        </span>
      </div>

      <style jsx>{`
        @keyframes ambientSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes ambientSpinReverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }
        @keyframes ambientCorePulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.06);
          }
        }
        @keyframes ambientDrift {
          0%,
          100% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(3px, -4px);
          }
        }
        @keyframes ambientRainFall {
          0% {
            transform: translateY(-8px);
            opacity: 0;
          }
          50% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(22px);
            opacity: 0;
          }
        }
        @keyframes ambientEmberFloat {
          0% {
            transform: translateY(6px);
            opacity: 0.1;
          }
          50% {
            opacity: 0.7;
          }
          100% {
            transform: translateY(-16px);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          span,
          div,
          circle,
          g {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </div>
  );
};
