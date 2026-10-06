"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const prefersReduced = useReducedMotion();

  // If user prefers reduced motion, skip movement/scaling and only apply a subtle instant fade
  if (prefersReduced) {
    return <div className="w-full h-full">{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.22,
        ease: [0.22, 1, 0.36, 1], // snappy cubic-bezier for responsive OS feel
      }}
      className="w-full h-full"
    >
      {children}
    </motion.div>
  );
}
