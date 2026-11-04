import type { CartLine } from "@/types/cart";

/**
 * Convenience cache only: ids and quantities, never prices. The API re-prices
 * everything (POST /cart/quote), so tampering with localStorage can't change what is charged.
 */
const KEY = "shree-cart-v1";
export const MAX_QUANTITY = 20;

/** Accept the saved cart only if every line is exactly { menuItemId: non-empty string, quantity: 1..MAX integer }. */
function parseStored(value: unknown): CartLine[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const lines: CartLine[] = [];
  for (const v of value) {
    if (typeof v !== "object" || v === null) return null;
    const { menuItemId, quantity } = v as Record<string, unknown>;
    if (typeof menuItemId !== "string" || menuItemId.length === 0 || menuItemId.length > 64) return null;
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return null;
    lines.push({ menuItemId, quantity }); // copying drops any extra fields (e.g. a tampered price)
  }
  return lines;
}

const EMPTY: CartLine[] = [];
let lines: CartLine[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load(): void {
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    lines = (raw ? parseStored(JSON.parse(raw)) : null) ?? EMPTY;
  } catch {
    lines = EMPTY; // storage blocked or corrupt: start with an empty cart
  }
}

function commit(next: CartLine[]): void {
  lines = next.length === 0 ? EMPTY : next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* private mode / quota: cart still works for this page session */
  }
  listeners.forEach((l) => l());
}

export function getSnapshot(): CartLine[] {
  if (!loaded && typeof window !== "undefined") load();
  return lines;
}
export const getServerSnapshot = (): CartLine[] => EMPTY;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      load(); // another tab changed the cart
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setQuantity(menuItemId: string, quantity: number): void {
  const q = Math.min(Math.floor(quantity), MAX_QUANTITY);
  const rest = getSnapshot().filter((l) => l.menuItemId !== menuItemId);
  const existing = getSnapshot().find((l) => l.menuItemId === menuItemId);
  if (q <= 0) return commit(rest);
  commit(existing ? getSnapshot().map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: q } : l)) : [...rest, { menuItemId, quantity: q }]);
}

export function addItem(menuItemId: string): void {
  const current = getSnapshot().find((l) => l.menuItemId === menuItemId)?.quantity ?? 0;
  setQuantity(menuItemId, current + 1);
}

export const removeItem = (menuItemId: string): void => setQuantity(menuItemId, 0);
export const clearCart = (): void => commit([]);
