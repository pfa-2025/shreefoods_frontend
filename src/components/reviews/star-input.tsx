"use client";

import { m } from "motion/react";
import { Star } from "lucide-react";
import { useId } from "react";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";

const LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

/**
 * Star picker built on real radio buttons, so it works with a keyboard (arrow keys), a screen reader
 * ("3 stars, 3 of 5") and a mouse or finger, with a visible focus ring.
 */
export function StarInput({ value, onChange, error }: { value: number; onChange: (n: number) => void; error?: string }) {
  const name = useId();
  return (
    <fieldset aria-describedby={error ? `${name}-err` : undefined}>
      <legend className="text-sm font-medium">Your rating</legend>
      <div className="mt-2 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className="cursor-pointer rounded-md p-1 text-gold-text has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring"
          >
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" aria-label={`${n} ${n === 1 ? "star" : "stars"}, ${LABELS[n - 1]}`} />
            {/* key changes with the rating, so every highlighted star re-pops in sequence */}
            <m.span key={n <= value ? `on-${value}` : "off"} className="block" initial={n <= value ? { scale: 0.55 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 520, damping: 14, delay: n <= value ? (n - 1) * 0.045 : 0 }}>
              <Star aria-hidden className={cn("size-8 transition-transform duration-150 hover:scale-110", n <= value ? "fill-current" : "fill-transparent opacity-60")} />
            </m.span>
          </label>
        ))}
        <span aria-live="polite" className="ml-2 text-sm text-muted-foreground">{value ? LABELS[value - 1] : "Tap a star"}</span>
      </div>
      <FieldError id={`${name}-err`} message={error} />
    </fieldset>
  );
}
