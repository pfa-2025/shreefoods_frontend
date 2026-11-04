import type { AdminOrder } from "@/types/admin";

const KEY = "shree-alerted-v1";
const KEEP = 300;

/** Needs a human right now: payment reported (or verified) and nobody has acted or acknowledged. */
export function needsAttention(o: AdminOrder): boolean {
  return (
    o.alertSeq !== null &&
    o.acknowledgedAt === null &&
    o.fulfillmentStatus === "PENDING_ACCEPTANCE" &&
    (o.paymentStatus === "AWAITING_VERIFICATION" || o.paymentStatus === "PAID")
  );
}

/**
 * Orders that should sound the hooter: they need attention AND we have never alerted for this
 * exact event id. Keyed by event id (not order id) so a re-reported payment alerts again, while
 * page refreshes, reconnects and repeated snapshots never replay the same alert.
 */
export function findNewAlerts(orders: Iterable<AdminOrder>, alerted: ReadonlySet<string>): AdminOrder[] {
  return [...orders].filter((o) => needsAttention(o) && !alerted.has(o.alertSeq as string));
}

export function loadAlerted(): Set<string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function saveAlerted(set: Set<string>): void {
  try {
    const recent = [...set].sort((a, b) => Number(BigInt(a) - BigInt(b))).slice(-KEEP);
    window.localStorage.setItem(KEY, JSON.stringify(recent));
  } catch {
    /* storage unavailable: dedupe still holds for this page session */
  }
}

/** Keep the newest version of each order. `updatedAt` is ISO-8601 so string comparison is chronological. */
export function mergeOrders(current: Record<string, AdminOrder>, incoming: AdminOrder[]): Record<string, AdminOrder> {
  const next = { ...current };
  for (const o of incoming) {
    const existing = next[o.id];
    if (!existing || o.updatedAt >= existing.updatedAt) next[o.id] = o;
  }
  return next;
}

export type Lane = "action" | "awaiting" | "accepted" | "preparing" | "ready" | "done";
export function laneOf(o: AdminOrder): Lane {
  switch (o.fulfillmentStatus) {
    case "COMPLETED":
    case "CANCELLED":
      return "done";
    case "ACCEPTED":
      return "accepted";
    case "PREPARING":
      return "preparing";
    case "READY":
      return "ready";
    default:
      return o.paymentStatus === "AWAITING_VERIFICATION" || o.paymentStatus === "PAID" ? "action" : "awaiting";
  }
}
