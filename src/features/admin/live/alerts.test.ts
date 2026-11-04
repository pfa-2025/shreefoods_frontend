import { beforeEach, describe, expect, it } from "vitest";
import type { AdminOrder } from "@/types/admin";
import { findNewAlerts, laneOf, loadAlerted, mergeOrders, needsAttention, saveAlerted } from "./alerts";

const order = (over: Partial<AdminOrder> = {}): AdminOrder => ({
  id: "o1", orderNumber: 1, createdAt: "2026-01-01T10:00:00.000Z", updatedAt: "2026-01-01T10:00:00.000Z",
  customerName: "A", customerEmail: "a@x.co", customerPhone: null, fulfillmentType: "PICKUP", notes: null,
  fulfillmentStatus: "PENDING_ACCEPTANCE", paymentStatus: "AWAITING_VERIFICATION", paymentReference: null,
  paymentReportedAt: null, cancelReason: null, acknowledgedAt: null, alertSeq: "10",
  subtotalCents: 100, taxCents: 8, totalCents: 108, items: [], ...over,
});

describe("needsAttention", () => {
  it("is true for a reported, unacknowledged, unaccepted order", () => expect(needsAttention(order())).toBe(true));
  it("is false once acknowledged, accepted, cancelled, or if nothing was reported", () => {
    expect(needsAttention(order({ acknowledgedAt: "2026-01-01T10:01:00.000Z" }))).toBe(false);
    expect(needsAttention(order({ fulfillmentStatus: "ACCEPTED" }))).toBe(false);
    expect(needsAttention(order({ fulfillmentStatus: "CANCELLED" }))).toBe(false);
    expect(needsAttention(order({ alertSeq: null, paymentStatus: "UNPAID" }))).toBe(false);
    expect(needsAttention(order({ paymentStatus: "FAILED" }))).toBe(false);
  });
});

describe("findNewAlerts (hooter de-duplication)", () => {
  it("alerts once per event id", () => {
    const alerted = new Set<string>();
    const first = findNewAlerts([order()], alerted);
    expect(first).toHaveLength(1);
    alerted.add(first[0].alertSeq as string);
    expect(findNewAlerts([order()], alerted)).toHaveLength(0); // same snapshot again (refresh / reconnect)
  });
  it("alerts again for a new event on the same order (payment re-reported)", () => {
    expect(findNewAlerts([order({ alertSeq: "11" })], new Set(["10"]))).toHaveLength(1);
  });
  it("alerts for orders that arrived while disconnected", () => {
    const missed = [order({ id: "a", alertSeq: "21" }), order({ id: "b", alertSeq: "22" })];
    expect(findNewAlerts(missed, new Set(["10", "20"]))).toHaveLength(2);
  });
  it("never alerts for acknowledged orders", () => {
    expect(findNewAlerts([order({ acknowledgedAt: "2026-01-01T10:05:00.000Z" })], new Set())).toHaveLength(0);
  });
});

describe("alerted persistence", () => {
  beforeEach(() => window.localStorage.clear());
  it("round-trips and survives corrupt storage", () => {
    saveAlerted(new Set(["5", "3", "9"]));
    expect(loadAlerted()).toEqual(new Set(["3", "5", "9"]));
    window.localStorage.setItem("shree-alerted-v1", "{{broken");
    expect(loadAlerted()).toEqual(new Set());
  });
  it("keeps only the most recent ids", () => {
    saveAlerted(new Set(Array.from({ length: 400 }, (_, i) => String(i + 1))));
    const kept = loadAlerted();
    expect(kept.size).toBe(300);
    expect(kept.has("400")).toBe(true);
    expect(kept.has("1")).toBe(false);
  });
});

describe("mergeOrders (no duplicates, never go backwards)", () => {
  it("keys by order id and keeps the newest version", () => {
    const newer = order({ updatedAt: "2026-01-01T10:05:00.000Z", fulfillmentStatus: "ACCEPTED" });
    const stale = order({ updatedAt: "2026-01-01T10:01:00.000Z" });
    const merged = mergeOrders(mergeOrders({}, [newer]), [stale, order({ id: "o2", orderNumber: 2 })]);
    expect(Object.keys(merged).sort()).toEqual(["o1", "o2"]);
    expect(merged.o1.fulfillmentStatus).toBe("ACCEPTED");
  });
});

describe("laneOf", () => {
  it("sorts orders into the right lanes", () => {
    expect(laneOf(order())).toBe("action");
    expect(laneOf(order({ paymentStatus: "UNPAID" }))).toBe("awaiting");
    expect(laneOf(order({ paymentStatus: "FAILED" }))).toBe("awaiting");
    expect(laneOf(order({ fulfillmentStatus: "PREPARING", paymentStatus: "PAID" }))).toBe("preparing");
    expect(laneOf(order({ fulfillmentStatus: "COMPLETED", paymentStatus: "PAID" }))).toBe("done");
  });
});
