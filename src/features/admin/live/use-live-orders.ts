"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import type { AdminOrder, LiveSnapshot } from "@/types/admin";
import { findNewAlerts, loadAlerted, mergeOrders, saveAlerted } from "./alerts";

export type Connection = "connecting" | "live" | "reconnecting";

const STREAM_URL = "/api/v1/admin/live/stream";
const POLL_MS = 10_000; // fallback while the live connection is down
const WATCHDOG_MS = 60_000; // the server pings every 25s; silence this long means the connection is dead
const BACKOFF_MAX_MS = 30_000;

interface Options {
  /**
   * Called once per batch of genuinely new alerts (never for events already alerted on).
   * Resolve `false` if the sound was blocked: those alerts are then retried on the next sync
   * instead of being lost. Resolve `true` when played, or when sound is deliberately muted.
   */
  onNewAlerts: (orders: AdminOrder[]) => Promise<boolean> | boolean;
  onUnauthorized: () => void;
}

/**
 * Keeps an up-to-date map of orders:
 *  1. snapshot from the database on load and after EVERY (re)connect (recovers anything missed)
 *  2. live updates over Server-Sent Events, reconnecting with exponential backoff
 *  3. periodic polling whenever the live connection is not up
 * Orders are keyed by id and only replaced by newer versions, so nothing is ever duplicated.
 */
export function useLiveOrders({ onNewAlerts, onUnauthorized }: Options) {
  const [orders, setOrders] = useState<Record<string, AdminOrder>>({});
  const [connection, setConnection] = useState<Connection>("connecting");
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const alerted = useRef<Set<string> | null>(null);
  const handlers = useRef({ onNewAlerts, onUnauthorized });
  useEffect(() => {
    handlers.current = { onNewAlerts, onUnauthorized };
  });

  const ordersRef = useRef<Record<string, AdminOrder>>({});

  /** Merge, then sound the hooter for any alert event we have not alerted on before. */
  const ingest = useCallback((incoming: AdminOrder[]) => {
    const next = mergeOrders(ordersRef.current, incoming);
    ordersRef.current = next;
    setOrders(next);

    alerted.current ??= loadAlerted();
    const fresh = findNewAlerts(incoming.map((o) => next[o.id]), alerted.current);
    if (fresh.length > 0) {
      for (const o of fresh) alerted.current.add(o.alertSeq as string);
      saveAlerted(alerted.current);
      void Promise.resolve(handlers.current.onNewAlerts(fresh)).then((handled) => {
        if (handled || !alerted.current) return;
        for (const o of fresh) alerted.current.delete(o.alertSeq as string);
        saveAlerted(alerted.current);
      });
    }
  }, []);

  const snapshot = useCallback(async () => {
    try {
      const snap = await adminApi<LiveSnapshot>("/live/snapshot");
      ingest(snap.orders);
      setLoaded(true);
      setSyncError(false);
      setLastSyncedAt(new Date());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return handlers.current.onUnauthorized();
      setSyncError(true);
    }
  }, [ingest]);

  useEffect(() => {
    let closed = false;
    let source: EventSource | null = null;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let lastMessageAt = Date.now();
    let live = false;

    const startPolling = () => {
      pollTimer ??= setInterval(() => void snapshot(), POLL_MS);
    };
    const stopPolling = () => {
      clearInterval(pollTimer);
      pollTimer = undefined;
    };

    const scheduleReconnect = () => {
      if (closed) return;
      live = false;
      source?.close();
      source = null;
      setConnection("reconnecting");
      startPolling(); // keep the board fresh while the stream is down
      const delay = Math.min(BACKOFF_MAX_MS, 1000 * 2 ** retries++) + Math.random() * 500;
      retryTimer = setTimeout(connect, delay);
    };

    function connect() {
      if (closed) return;
      lastMessageAt = Date.now();
      const es = new EventSource(STREAM_URL);
      source = es;
      es.addEventListener("ready", () => {
        lastMessageAt = Date.now();
        retries = 0;
        live = true;
        setConnection("live");
        stopPolling();
        void snapshot(); // recover whatever happened while we were away
      });
      es.addEventListener("order", (e) => {
        lastMessageAt = Date.now();
        try {
          ingest([(JSON.parse((e as MessageEvent<string>).data) as { order: AdminOrder }).order]);
        } catch {
          void snapshot(); // an unreadable message: resync instead of guessing
        }
      });
      es.addEventListener("ping", () => {
        lastMessageAt = Date.now();
      });
      es.onerror = () => {
        // EventSource hides the HTTP status, so check the session: an expired login must not retry forever.
        void adminApi("/auth/me").catch((err: unknown) => {
          if (err instanceof ApiError && err.status === 401) handlers.current.onUnauthorized();
        });
        scheduleReconnect();
      };
    }

    const first = setTimeout(() => void snapshot(), 0);
    startPolling(); // until the stream confirms it is live
    connect();

    const watchdog = setInterval(() => {
      if (live && Date.now() - lastMessageAt > WATCHDOG_MS) scheduleReconnect();
    }, 10_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void snapshot(); // background tabs get throttled
    };
    const onOnline = () => {
      clearTimeout(retryTimer);
      retries = 0;
      scheduleReconnect(); // network is back: don't wait out the backoff
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      closed = true;
      clearTimeout(first);
      source?.close();
      clearTimeout(retryTimer);
      clearInterval(watchdog);
      stopPolling();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [snapshot, ingest]);

  /** Run a staff action; the response is the updated order. */
  const act = useCallback(
    async (orderId: string, action: string, body: object = {}): Promise<string | null> => {
      try {
        ingest([await adminApi<AdminOrder>(`/orders/${orderId}/${action}`, { method: "POST", json: body })]);
        return null;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          handlers.current.onUnauthorized();
          return "Your session expired.";
        }
        if (e instanceof ApiError && e.status === 409) void snapshot(); // someone else changed it: show the truth
        return e instanceof ApiError ? e.message : "Couldn’t reach the server. Try again.";
      }
    },
    [ingest, snapshot],
  );

  return { orders, connection, loaded, syncError, lastSyncedAt, act, refresh: snapshot };
}
