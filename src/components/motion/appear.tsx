"use client";

import { m } from "motion/react";
import { EASE } from "./ease";

/** Fades and rises in when it first appears on screen (for things that show up after loading or a user action). */
export function Appear({ children, className, delay = 0, role, ...rest }: { children: React.ReactNode; className?: string; delay?: number; role?: string; "aria-live"?: "polite" | "assertive" | "off" }) {
  return (
    <m.div className={className} role={role} {...rest} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay, ease: EASE }}>
      {children}
    </m.div>
  );
}
