import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { adminApi, adminDownload } from "./admin-api";

const respond = (status: number, body?: unknown) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status })));
afterEach(() => vi.unstubAllGlobals());

describe("adminApi", () => {
  it("reads JSON replies", async () => {
    respond(200, { ok: true });
    expect(await adminApi("/x")).toEqual({ ok: true });
  });
  it("treats an empty 204 reply (e.g. a successful DELETE) as success, not an error", async () => {
    respond(204);
    await expect(adminApi("/x", { method: "DELETE" })).resolves.toBeUndefined();
  });
  it("throws ApiError with the server's message and field details on failure", async () => {
    respond(400, { message: "Validation failed", details: [{ path: "reply", message: "too long" }] });
    const err = await adminApi("/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, message: "Validation failed", details: [{ path: "reply", message: "too long" }] });
  });
  it("always sends the CSRF header and never cached credentials mode other than same-origin", async () => {
    respond(200, {});
    await adminApi("/x", { method: "POST", json: { a: 1 } });
    const init = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["X-Requested-With"]).toBe("shree-admin");
    expect(init.credentials).toBe("same-origin");
  });
});

describe("adminDownload", () => {
  const file = (headers: Record<string, string>, status = 200, body: BodyInit | null = "xlsx-bytes") => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status, headers })));
  it("returns the file and a safe file name from the server", async () => {
    file({ "content-disposition": 'attachment; filename="shree-foods-orders-2026-11-03.xlsx"' });
    const out = await adminDownload("/orders/export");
    expect(out.filename).toBe("shree-foods-orders-2026-11-03.xlsx");
    expect(out.blob.size).toBe("xlsx-bytes".length); // the file bytes come through untouched
  });
  it("never trusts the server's file name for path tricks", async () => {
    file({ "content-disposition": 'attachment; filename="../../etc/passwd"' });
    expect((await adminDownload("/x")).filename).not.toMatch(/[\\/]/);
  });
  it("turns a failed export into an ApiError with the server's message", async () => {
    file({ "content-type": "application/json" }, 400, JSON.stringify({ message: "Choose a shorter date range." }));
    await expect(adminDownload("/orders/export")).rejects.toMatchObject({ status: 400, message: "Choose a shorter date range." });
  });
});
