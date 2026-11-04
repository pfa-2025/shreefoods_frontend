"use client";

import { AnimatePresence, m } from "motion/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "./quantity-stepper";
import { useCart, useLineQuantity } from "./use-cart";

const swap = { initial: { opacity: 0, scale: 0.9 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.12 } }; // enters at once; the old control is removed immediately (no exit animation to wait for)

export function AddToCart({ itemId, name, disabled, disabledLabel }: { itemId: string; name: string; disabled?: boolean; disabledLabel?: string }) {
  const quantity = useLineQuantity(itemId);
  const { addItem, setQuantity } = useCart();

  const mode = disabled ? "disabled" : quantity === 0 ? "add" : "stepper";
  return (
    // "Add" pops into the quantity stepper instead of swapping abruptly
    <AnimatePresence mode="popLayout" initial={false}>
      <m.div key={mode} {...swap}>
        {mode === "disabled" ? (
          <Button variant="outline" disabled className="h-9 px-4">
            {disabledLabel ?? "Unavailable"}
          </Button>
        ) : mode === "add" ? (
          <Button onClick={() => addItem(itemId)} aria-label={`Add ${name} to cart`} className="h-9 px-4">
            <Plus /> Add
          </Button>
        ) : (
          <QuantityStepper name={name} quantity={quantity} onChange={(n) => setQuantity(itemId, n)} />
        )}
      </m.div>
    </AnimatePresence>
  );
}
