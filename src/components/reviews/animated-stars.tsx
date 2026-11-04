"use client";

import { m } from "motion/react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Stars that pop in one after another when they scroll into view (for the rating summary and a customer's own review). */
export function AnimatedStars({ value, size = "size-4", className }: { value: number; size?: string; className?: string }) {
  const rounded = Math.round(value);
  return (
    <span role="img" aria-label={`${Number.isInteger(value) ? value : value.toFixed(1)} out of 5 stars`} className={cn("inline-flex gap-0.5 text-gold-text", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <m.span key={n} aria-hidden className="inline-flex" initial={{ scale: 0, rotate: -40, opacity: 0 }} whileInView={{ scale: 1, rotate: 0, opacity: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.1 + n * 0.07 }}>
          <Star className={cn(size, n <= rounded ? "fill-current" : "fill-transparent opacity-60")} />
        </m.span>
      ))}
    </span>
  );
}
