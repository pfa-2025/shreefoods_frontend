"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { adminApi } from "@/lib/admin-api";

/** GET with auto-refresh. Keeps showing the last good data if a refresh fails. */
export function useAdminQuery<T>(
  path: string,
  { refreshMs = 30_000, enabled = true, onUnauthorized }: { refreshMs?: number; enabled?: boolean; onUnauthorized?: () => void } = {},
) {
  // refreshMs: 0 disables auto-refresh (use on pages with edit forms). enabled: false skips fetching until needed.
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    const ctl = new AbortController();
    const run = () =>
      adminApi<T>(path, { signal: ctl.signal })
        .then((d) => {
          setData(d);
          setError(undefined);
        })
        .catch((e: unknown) => {
          if ((e as Error).name === "AbortError") return;
          if (e instanceof ApiError && e.status === 401) return onUnauthorized?.();
          setError(e instanceof ApiError ? e.message : "Couldn’t reach the server");
        });
    void run();
    const id = refreshMs > 0 ? setInterval(() => document.visibilityState === "visible" && void run(), refreshMs) : undefined;
    return () => {
      clearInterval(id);
      ctl.abort();
    };
  }, [path, attempt, refreshMs, enabled, onUnauthorized]);

  return { data, error, loading: data === undefined && error === undefined, reload };
}
