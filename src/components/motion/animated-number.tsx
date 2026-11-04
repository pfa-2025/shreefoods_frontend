"use client";

import { useEffect, useRef, useState } from "react";
import { formatUsd } from "@/lib/format";

/**
 * Eases from the number currently shown to a new target. The first value is shown instantly (no count-up
 * from zero), the final frame is always exactly the target, and nothing animates for reduced-motion visitors.
 */
export function useTween(target: number, ms = 450): number {
  const [value, setValue] = useState(target);
  const shown = useRef(target);

  useEffect(() => {
    if (shown.current === target) return;
    const from = shown.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = reduce ? 1 : Math.min(1, (now - start) / ms);
      const next = p >= 1 ? target : Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      shown.current = next;
      setValue(next);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);

  return value;
}

/** Dollar amount from integer cents that glides to its new value when it changes. */
export function AnimatedMoney({ cents, className }: { cents: number; className?: string }) {
  return <span className={className}>{formatUsd(useTween(cents))}</span>;
}

/** A whole number (e.g. a count on the dashboard) that glides when it changes. */
export function AnimatedCount({ value, className }: { value: number; className?: string }) {
  return <span className={className}>{useTween(value, 350)}</span>;
}
