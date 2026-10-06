"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { subscribeToAlfredActivity, AlfredActivityEventDetail } from "@/utils/activityBus";

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export default function AlfredEnvironment() {
  const prefersReduced = useReducedMotion();
  const [pulseActive, setPulseActive] = useState(false);
  const [pulseColor, setPulseColor] = useState<string>("rgba(225, 29, 72, 0.12)");

  // Listen to system activity events to trigger subtle atmospheric telemetry pulses
  useEffect(() => {
    const unsubscribe = subscribeToAlfredActivity((event: AlfredActivityEventDetail) => {
      let color = "rgba(225, 29, 72, 0.14)";
      if (event.state === "thinking" || event.state === "listening") {
        color = "rgba(6, 182, 212, 0.14)";
      } else if (event.state === "success") {
        color = "rgba(16, 185, 129, 0.14)";
      } else if (event.state === "error") {
        color = "rgba(239, 68, 68, 0.16)";
      } else if (event.state === "waiting_for_confirmation") {
        color = "rgba(245, 158, 11, 0.15)";
      }

      setPulseColor(color);
      setPulseActive(true);
      const timer = setTimeout(() => {
        setPulseActive(false);
      }, 1600);
      return () => clearTimeout(timer);
    });

    return () => unsubscribe();
  }, []);

  // 12 deterministic, very subtle ambient particle nodes (non-distracting)
  const particles: Particle[] = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      x: ((i * 23) % 94) + 3,
      y: ((i * 31) % 90) + 5,
      size: (i % 3) + 1.5,
      duration: 16 + (i % 6) * 4,
      delay: (i % 5) * 1.5,
      opacity: 0.12 + (i % 3) * 0.08,
    }));
  }, []);

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none overflow-hidden select-none z-0"
    >
      {/* Layer 1: Ambient Technical Coordinate Grid */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.6) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.6) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, #000 40%, transparent 95%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%, #000 40%, transparent 95%)",
        }}
      />

      {/* Layer 2: Subtle Depth Atmospheric Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 10%, rgba(225, 29, 72, 0.03) 0%, transparent 55%), radial-gradient(circle at center, transparent 40%, rgba(5, 7, 11, 0.75) 100%)",
        }}
      />

      {/* Layer 3: Dynamic System Event Pulse Glow */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          pulseActive ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background: `radial-gradient(circle at 50% 35%, ${pulseColor} 0%, transparent 65%)`,
        }}
      />

      {/* Layer 4: Subtle Slow Atmospheric Scan Sweep (only if reduced motion is disabled) */}
      {!prefersReduced && (
        <motion.div
          className="absolute left-0 right-0 h-32 opacity-[0.035]"
          style={{
            background: "linear-gradient(180deg, transparent 0%, rgba(6, 182, 212, 0.5) 50%, transparent 100%)",
          }}
          animate={{
            y: ["-10vh", "110vh"],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      )}

      {/* Layer 5: Restrained Ambient Floating Telemetry Nodes */}
      {!prefersReduced &&
        particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-cyan-400"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              opacity: p.opacity,
              boxShadow: "0 0 6px rgba(6, 182, 212, 0.4)",
            }}
            animate={{
              y: [0, -18, 0],
              opacity: [p.opacity * 0.5, p.opacity, p.opacity * 0.5],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: "easeInOut",
            }}
          />
        ))}

      {/* Layer 6: Technical Screen Corner Crosshair Reticles */}
      <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-white/[0.08]" />
      <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-white/[0.08]" />
      <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-white/[0.08]" />
      <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-white/[0.08]" />
    </div>
  );
}
