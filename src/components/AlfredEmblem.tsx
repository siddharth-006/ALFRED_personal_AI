"use client";

import React from "react";
import { motion } from "framer-motion";

interface AlfredEmblemProps {
  size?: number;
  glow?: boolean;
  className?: string;
  pulsing?: boolean;
}

/**
 * Professional Abstract Technological ALFRED Emblem
 * Combines an architectural "A" apex monogram, precision crosshair targeting lines,
 * concentric quantum reactor geometry, and micro technical facets.
 * Cleanly scalable from 16px to 256px without childish/doll/mascot appearance.
 */
export default function AlfredEmblem({
  size = 28,
  glow = true,
  className = "",
  pulsing = false,
}: AlfredEmblemProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Ambient reactor glow */}
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-md pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(225, 29, 72, 0.45) 0%, rgba(6, 182, 212, 0.18) 65%, transparent 100%)",
          }}
        />
      )}

      {/* SVG Technological Emblem */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <defs>
          <linearGradient id="alfredApexGrad" x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FF1E44" />
            <stop offset="0.5" stopColor="#E11D48" />
            <stop offset="1" stopColor="#9F1239" />
          </linearGradient>

          <linearGradient id="alfredAccentGrad" x1="12" y1="12" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#06B6D4" />
            <stop offset="1" stopColor="#0891B2" />
          </linearGradient>
        </defs>

        {/* Outer segmented ring */}
        <circle
          cx="20"
          cy="20"
          r="18.5"
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1"
        />
        <circle
          cx="20"
          cy="20"
          r="18.5"
          stroke="#E11D48"
          strokeWidth="1.2"
          strokeDasharray="22 10"
          strokeLinecap="round"
        />
        <circle
          cx="20"
          cy="20"
          r="18.5"
          stroke="#06B6D4"
          strokeWidth="1.2"
          strokeDasharray="6 26"
          strokeDashoffset="14"
          strokeLinecap="round"
        />

        {/* Concentric inner mechanical ring */}
        <circle
          cx="20"
          cy="20"
          r="14"
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth="0.8"
          strokeDasharray="2 3"
        />

        {/* Cardinal precision crosshair ticks */}
        <line x1="20" y1="1.5" x2="20" y2="4.5" stroke="#E11D48" strokeWidth="1.2" />
        <line x1="20" y1="35.5" x2="20" y2="38.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
        <line x1="1.5" y1="20" x2="4.5" y2="20" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" />
        <line x1="35.5" y1="20" x2="38.5" y2="20" stroke="#06B6D4" strokeWidth="1.2" />

        {/* Geometric Architectural "A" Monogram & Iris Reactor Core */}
        {/* Left Stanchion */}
        <path
          d="M20 7L8 31H12.5L20 16L27.5 31H32L20 7Z"
          fill="url(#alfredApexGrad)"
        />

        {/* Precision Floating Chevron Crossbar */}
        <path
          d="M14.5 24.5L20 20.5L25.5 24.5L20 22.5L14.5 24.5Z"
          fill="#FFFFFF"
        />

        {/* Central Quantum Reactor Iris Diamond */}
        <polygon
          points="20,17 22.8,20.5 20,24 17.2,20.5"
          fill="url(#alfredAccentGrad)"
          stroke="#FFFFFF"
          strokeWidth="0.6"
        />

        {/* Center Quantum Singularity Bead */}
        <circle cx="20" cy="20.5" r="1.3" fill="#FFFFFF" />
      </svg>

      {/* Pulsing state ring if requested */}
      {pulsing && (
        <motion.div
          className="absolute inset-0 rounded-full border border-[#E11D48]"
          animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}
