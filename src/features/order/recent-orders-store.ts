/**
 * Orders placed (or opened) on this device, so a customer can find their tracking page again.
 * Holds only what is needed to link back: the private order code, number, date and total.
 * No name, email, phone or address is ever stored here.
 */
export interface RecentOrder {
  token: string;
  orderNumber: number;
  createdAt: string;
  totalCents: number | null;
}

const KEY = "shree-recent-orders-v1";
const MAX = 10;
const EMPTY: RecentOrder[] = [];
let items: RecentOrder[] = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

const validToken = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{16,64}$/.test(t);

/** Keep only well-formed entries; anything tampered with or corrupt is dropped. */
export function parseRecent(value: unknown): RecentOrder[] {
  if (!Array.isArray(value)) return [];
  const out: RecentOrder[] = [];
  for (const v of value) {
    if (typeof v !== "object" || v === null) continue;
    const { token, orderNumber, createdAt, totalCents } = v as Record<string, unknown>;
    if (!validToken(token)) continue;
    if (typeof orderNumber !== "number" || !Number.isInteger(orderNumber) || orderNumber < 1) continue;
    if (typeof createdAt !== "string" || Number.isNaN(Date.parse(createdAt))) continue;
    const total = typeof totalCents === "number" && Number.isInteger(totalCents) && totalCents >= 0 ? totalCents : null;
    out.push({ token, orderNumber, createdAt, totalCents: total });
    if (out.length >= MAX) break;
  }
  return out;
}

function load(): void {
  loaded = true;
  try {
    const parsed = parseRecent(JSON.parse(window.localStorage.getItem(KEY) ?? "[]"));
    items = parsed.length ? parsed : EMPTY;
  } catch {
    items = EMPTY;
  }
}

function commit(next: RecentOrder[]): void {
  items = next.length ? next : EMPTY;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage blocked (private mode): the list simply won't persist */
  }
  listeners.forEach((l) => l());
}

export function getSnapshot(): RecentOrder[] {
  if (!loaded && typeof window !== "undefined") load();
  return items;
}
export const getServerSnapshot = (): RecentOrder[] => EMPTY;

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      load();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Add (or refresh) an order, newest first, without duplicates. Missing details never overwrite known ones. */
export function rememberOrder(order: { token: string; orderNumber: number; createdAt?: string; totalCents?: number | null }): void {
  if (!validToken(order.token) || !Number.isInteger(order.orderNumber)) return;
  const existing = getSnapshot().find((o) => o.token === order.token);
  const entry: RecentOrder = {
    token: order.token,
    orderNumber: order.orderNumber,
    createdAt: order.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    totalCents: order.totalCents ?? existing?.totalCents ?? null,
  };
  const same = existing && JSON.stringify(existing) === JSON.stringify(entry) && getSnapshot()[0]?.token === entry.token;
  if (same) return; // nothing changed: avoid needless re-renders when an order page refreshes itself
  commit([entry, ...getSnapshot().filter((o) => o.token !== entry.token)].slice(0, MAX));
}

export const forgetOrders = (): void => commit([]);
