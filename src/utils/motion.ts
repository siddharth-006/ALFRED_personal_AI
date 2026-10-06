/**
 * ALFRED Framer Motion Design & Animation System
 *
 * Implements a restrained, cinematic, and professional motion language.
 * Adheres to:
 * - 150–250ms for micro-interactions (buttons, badges, pills, toggles)
 * - 250–380ms for panels, cards, and page transitions
 * - Controlled spring physics only where it enhances physical tactile feedback
 * - Strict prefers-reduced-motion compliance
 * - Zero CPU-heavy infinite layout animations
 */

import { Variants, Transition } from "framer-motion";

// Standard Duration Tokens (in seconds)
export const MOTION_DURATIONS = {
  instant: 0.1,
  micro: 0.18,       // 180ms - buttons, hovers, small indicators
  quick: 0.24,       // 240ms - dropdowns, popovers, tabs
  panel: 0.32,       // 320ms - slide panels, modals, drawers
  deliberate: 0.45,  // 450ms - major state transitions, hero reveals
};

// Premium Easing Curves
export const MOTION_EASINGS = {
  // Snappy, authoritative ease-out curve for tactical UI
  standard: [0.16, 1, 0.3, 1] as const,
  // Decelerated curve for entrances
  entrance: [0.0, 0.0, 0.2, 1] as const,
  // Accelerated curve for exits
  exit: [0.4, 0.0, 1, 1] as const,
};

// Controlled Spring Physics
export const MOTION_SPRINGS = {
  tactile: {
    type: "spring",
    stiffness: 420,
    damping: 32,
    mass: 0.8,
  } as Transition,
  gentle: {
    type: "spring",
    stiffness: 260,
    damping: 24,
    mass: 1.0,
  } as Transition,
  bouncy: {
    type: "spring",
    stiffness: 500,
    damping: 28,
  } as Transition,
};

// Page Transition Variants
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 6,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.quick,
      ease: MOTION_EASINGS.standard,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: MOTION_DURATIONS.micro,
      ease: MOTION_EASINGS.exit,
    },
  },
};

// Panel / Modal Entrance & Exit
export const modalOverlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: MOTION_DURATIONS.quick },
  },
  exit: {
    opacity: 0,
    transition: { duration: MOTION_DURATIONS.micro },
  },
};

export const modalDialogVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.97,
    y: 8,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.panel,
      ease: MOTION_EASINGS.standard,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 4,
    transition: {
      duration: MOTION_DURATIONS.micro,
      ease: MOTION_EASINGS.exit,
    },
  },
};

// Stagger Container for Progressive Dashboard Reveals
export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

// Individual Staggered Child Element
export const staggerItemVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.quick,
      ease: MOTION_EASINGS.standard,
    },
  },
};

// Tactical Card / Panel Reveal
export const panelRevealVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION_DURATIONS.panel,
      ease: MOTION_EASINGS.standard,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: MOTION_DURATIONS.micro,
      ease: MOTION_EASINGS.exit,
    },
  },
};

// Tactical Button Micro-interaction Tap / Hover States
export const microButtonHover = {
  scale: 1.02,
  transition: { duration: MOTION_DURATIONS.instant },
};

export const microButtonTap = {
  scale: 0.97,
  transition: { duration: MOTION_DURATIONS.instant },
};

// Reduced Motion Fallback Variants (functional feedback only, no movement/scaling)
export const reducedMotionVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.01 } },
  exit: { opacity: 0, transition: { duration: 0.01 } },
};

/**
 * Returns either standard variants or reduced motion variants based on user preference.
 */
export function getMotionVariants(variants: Variants, prefersReduced: boolean | null): Variants {
  if (prefersReduced) {
    return reducedMotionVariants;
  }
  return variants;
}
