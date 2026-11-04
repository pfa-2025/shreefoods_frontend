"use client";

import { useSyncExternalStore } from "react";
import { addItem, clearCart, getServerSnapshot, getSnapshot, removeItem, setQuantity, subscribe } from "./cart-store";

export function useCart() {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  return { lines, itemCount, addItem, setQuantity, removeItem, clearCart };
}

export function useLineQuantity(menuItemId: string): number {
  const { lines } = useCart();
  return lines.find((l) => l.menuItemId === menuItemId)?.quantity ?? 0;
}
