import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "shree-recent-orders-v1";
const T1 = "aaaaaaaaaaaaaaaaaaaaaaaa";
const T2 = "bbbbbbbbbbbbbbbbbbbbbbbb";

async function fresh() {
  vi.resetModules(); // module state = a page load
  return import("./recent-orders-store");
}

describe("recent orders store", () => {
  beforeEach(() => window.localStorage.clear());

  it("remembers orders newest first and survives a reload", async () => {
    const s = await fresh();
    s.rememberOrder({ token: T1, orderNumber: 5, createdAt: "2026-11-01T10:00:00.000Z", totalCents: 758 });
    s.rememberOrder({ token: T2, orderNumber: 6, createdAt: "2026-11-02T10:00:00.000Z", totalCents: 1407 });
    expect(s.getSnapshot().map((o) => o.orderNumber)).toEqual([6, 5]);
    expect((await fresh()).getSnapshot().map((o) => o.orderNumber)).toEqual([6, 5]);
  });

  it("does not duplicate an order, and later details fill in without erasing earlier ones", async () => {
    const s = await fresh();
    s.rememberOrder({ token: T1, orderNumber: 5 }); // right after checkout: no total known yet
    s.rememberOrder({ token: T1, orderNumber: 5, totalCents: 758 }); // order page loaded: now we know it
    s.rememberOrder({ token: T1, orderNumber: 5 }); // a bare refresh must not wipe the total
    expect(s.getSnapshot()).toHaveLength(1);
    expect(s.getSnapshot()[0].totalCents).toBe(758);
  });

  it("keeps a stable snapshot when nothing changed (needed by useSyncExternalStore)", async () => {
    const s = await fresh();
    s.rememberOrder({ token: T1, orderNumber: 5, totalCents: 100 });
    const a = s.getSnapshot();
    s.rememberOrder({ token: T1, orderNumber: 5, totalCents: 100 });
    expect(s.getSnapshot()).toBe(a);
  });

  it("keeps only the 10 most recent", async () => {
    const s = await fresh();
    for (let i = 1; i <= 14; i++) s.rememberOrder({ token: `t${String(i).padStart(2, "0")}`.padEnd(20, "x"), orderNumber: i });
    expect(s.getSnapshot()).toHaveLength(10);
    expect(s.getSnapshot()[0].orderNumber).toBe(14);
  });

  it("refuses malformed tokens and numbers, and drops tampered or corrupt storage", async () => {
    const s = await fresh();
    s.rememberOrder({ token: "short", orderNumber: 1 });
    s.rememberOrder({ token: "../../etc/passwd/../../xx", orderNumber: 1 });
    s.rememberOrder({ token: T1, orderNumber: 1.5 });
    expect(s.getSnapshot()).toHaveLength(0);

    window.localStorage.setItem(KEY, JSON.stringify([{ token: "<script>alert(1)</script>", orderNumber: 1, createdAt: "2026-11-01T00:00:00Z" }, { token: T2, orderNumber: 9, createdAt: "not a date" }, { token: T1, orderNumber: 3, createdAt: "2026-11-01T00:00:00Z", totalCents: -5, extra: "ignored" }]));
    const t = await fresh();
    expect(t.getSnapshot()).toEqual([{ token: T1, orderNumber: 3, createdAt: "2026-11-01T00:00:00Z", totalCents: null }]);
    window.localStorage.setItem(KEY, "{{broken");
    expect((await fresh()).getSnapshot()).toEqual([]);
  });

  it("stores no personal details", async () => {
    const s = await fresh();
    s.rememberOrder({ token: T1, orderNumber: 5, totalCents: 758, ...({ customerName: "Asha", customerEmail: "a@b.co" } as object) });
    const raw = window.localStorage.getItem(KEY) ?? "";
    expect(raw).not.toMatch(/Asha|a@b\.co|customer/);
  });

  it("can be cleared and notifies subscribers", async () => {
    const s = await fresh();
    const fn = vi.fn();
    s.subscribe(fn);
    s.rememberOrder({ token: T1, orderNumber: 5 });
    s.forgetOrders();
    expect(s.getSnapshot()).toEqual([]);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
