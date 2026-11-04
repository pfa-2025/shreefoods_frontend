"use client";

import { m } from "motion/react";
import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useCart } from "./use-cart";

export function CartLink() {
  const { itemCount } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={itemCount > 0 ? `Cart, ${itemCount} ${itemCount === 1 ? "item" : "items"}` : "Cart, empty"}
      className="relative -mr-1 p-2 text-foreground/80 transition-colors hover:text-primary"
    >
      <ShoppingBag className="size-5" />
      {itemCount > 0 && (
        // key restarts the small pop each time the count changes (cart feedback)
        <m.span
          key={itemCount}
          initial={{ scale: 1.5 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-md bg-primary text-[10px] font-medium text-primary-foreground tabular-nums"
        >
          {itemCount}
        </m.span>
      )}
    </Link>
  );
}
