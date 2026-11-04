import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "shree-cart-v1";

// The store keeps module-level state, so load a fresh copy per test (simulates a page refresh).
async function freshStore() {
  vi.resetModules();
  return import("./cart-store");
}

describe("cart store", () => {
  beforeEach(() => window.localStorage.clear());

  it("adds items and increments quantity", async () => {
    const s = await freshStore();
    s.addItem("a");
    s.addItem("a");
    s.addItem("b");
    expect(s.getSnapshot()).toEqual([
      { menuItemId: "a", quantity: 2 },
      { menuItemId: "b", quantity: 1 },
    ]);
  });

  it("sets quantity, removes at zero, and caps at the maximum", async () => {
    const s = await freshStore();
    s.setQuantity("a", 5);
    expect(s.getSnapshot()[0].quantity).toBe(5);
    s.setQuantity("a", 999);
    expect(s.getSnapshot()[0].quantity).toBe(s.MAX_QUANTITY);
    s.setQuantity("a", 0);
    expect(s.getSnapshot()).toEqual([]);
  });

  it("keeps a stable snapshot reference when nothing changes (required by useSyncExternalStore)", async () => {
    const s = await freshStore();
    s.addItem("a");
    expect(s.getSnapshot()).toBe(s.getSnapshot());
  });

  it("survives a page refresh", async () => {
    const first = await freshStore();
    first.addItem("a");
    first.setQuantity("b", 3);
    const afterRefresh = await freshStore();
    expect(afterRefresh.getSnapshot()).toEqual([
      { menuItemId: "a", quantity: 1 },
      { menuItemId: "b", quantity: 3 },
    ]);
  });

  it("notifies subscribers on change", async () => {
    const s = await freshStore();
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.addItem("a");
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.addItem("a");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("ignores corrupt storage instead of crashing", async () => {
    window.localStorage.setItem(KEY, "{not json");
    const s = await freshStore();
    expect(s.getSnapshot()).toEqual([]);
  });

  it("rejects tampered storage (bad quantities) wholesale", async () => {
    window.localStorage.setItem(KEY, JSON.stringify([{ menuItemId: "a", quantity: 9999 }]));
    const s = await freshStore();
    expect(s.getSnapshot()).toEqual([]);
  });

  it("never persists prices", async () => {
    const s = await freshStore();
    s.addItem("a");
    expect(window.localStorage.getItem(KEY)).toBe('[{"menuItemId":"a","quantity":1}]');
  });

  it("clears the cart", async () => {
    const s = await freshStore();
    s.addItem("a");
    s.clearCart();
    expect(s.getSnapshot()).toEqual([]);
    expect(window.localStorage.getItem(KEY)).toBe("[]");
  });
});
