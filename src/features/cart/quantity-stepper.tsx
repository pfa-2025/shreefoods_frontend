"use client";

import { AnimatePresence, m } from "motion/react";
import { Minus, Plus } from "lucide-react";
import { MAX_QUANTITY } from "./cart-store";

const btn =
  "flex size-9 items-center justify-center rounded-md border border-border bg-background transition-[background-color,transform] duration-150 hover:bg-muted active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-40";

export function QuantityStepper({
  name,
  quantity,
  onChange,
}: {
  name: string;
  quantity: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex items-center gap-3" role="group" aria-label={`Quantity for ${name}`}>
      <button type="button" className={btn} aria-label={`Decrease quantity of ${name}`} onClick={() => onChange(quantity - 1)}>
        <Minus className="size-4" />
      </button>
      <span className="relative inline-flex min-w-6 justify-center overflow-hidden text-sm tabular-nums" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span key={quantity} initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0, transition: { duration: 0.08 } }} transition={{ duration: 0.12 }}>
            {quantity}
          </m.span>
        </AnimatePresence>
      </span>
      <button
        type="button"
        className={btn}
        aria-label={`Increase quantity of ${name}`}
        disabled={quantity >= MAX_QUANTITY}
        onClick={() => onChange(quantity + 1)}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
