"use client";

import { m } from "motion/react";
import { EASE } from "./ease";

/** A circle and tick that draw themselves. Decorative: pair it with text that says what happened. */
export function AnimatedCheck({ className = "size-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 52 52" fill="none" aria-hidden className={className}>
      <m.circle cx="26" cy="26" r="23" stroke="currentColor" strokeWidth="3" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.6, ease: EASE }} />
      <m.path d="M15 27.5l8 8 15-17" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.45, ease: EASE }} />
    </svg>
  );
}
