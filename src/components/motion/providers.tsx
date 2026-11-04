"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import { useEffect } from "react";

/**
 * Slim animation runtime (the DOM animation subset, no drag/layout engines) plus the user's
 * reduced-motion preference. `strict` makes any accidental use of the heavy `motion.*` components an error.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  // Tells the page the app has started, which disables the CSS "reveal everything" safety net.
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
