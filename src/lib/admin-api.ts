import { ApiError } from "./api";

/**
 * Admin requests go to the web origin (/api/v1 is proxied to the API), so the httpOnly session
 * cookie is first-party. The custom header is the CSRF check the API requires on writes.
 */
export async function adminApi<T>(path: string, init: { method?: string; json?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(`/api/v1/admin${path}`, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    cache: "no-store",
    signal: init.signal,
    headers: {
      "X-Requested-With": "shree-admin",
      ...(init.json !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; details?: unknown } | null;
    throw new ApiError(res.status, body?.message ?? res.statusText, body?.details);
  }
  if (res.status === 204) return undefined as T; // success with no body (e.g. DELETE)
  return (await res.json()) as T;
}

/** multipart upload (the browser sets the boundary, so no Content-Type header). */
export async function adminUpload<T>(path: string, form: FormData, method: "POST" | "PUT" = "POST"): Promise<T> {
  const res = await fetch(`/api/v1/admin${path}`, { method, body: form, credentials: "same-origin", headers: { "X-Requested-With": "shree-admin" } });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; details?: unknown } | null;
    throw new ApiError(res.status, body?.message ?? res.statusText, body?.details);
  }
  return (await res.json()) as T;
}

/**
 * Download a file (e.g. the Excel export). Errors come back as ApiError with the server's message,
 * and the file name is taken from the server but reduced to safe characters.
 */
export async function adminDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`/api/v1/admin${path}`, { credentials: "same-origin", cache: "no-store", headers: { "X-Requested-With": "shree-admin" } });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; details?: unknown } | null;
    throw new ApiError(res.status, body?.message ?? res.statusText, body?.details);
  }
  const named = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "download";
  return { blob: await res.blob(), filename: named.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100) || "download" };
}
