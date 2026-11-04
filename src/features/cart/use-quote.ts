"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { CartLine, Quote } from "@/types/cart";

export type QuoteState = { status: "loading" } | { status: "error" } | { status: "ready"; quote: Quote };

/** Server-authoritative pricing for the current cart. Keeps the last quote visible while refreshing. */
export function useQuote(lines: CartLine[]): { state: QuoteState; retry: () => void } {
  const [state, setState] = useState<QuoteState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const key = JSON.stringify(lines);
  useEffect(() => {
    if (lines.length === 0) return;
    const ctl = new AbortController();
    api<Quote>("/cart/quote", { method: "POST", json: { items: lines }, signal: ctl.signal })
      .then((quote) => setState({ status: "ready", quote }))
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setState((s) => (s.status === "ready" ? s : { status: "error" }));
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the serialised `lines`
  }, [key, attempt]);

  return { state, retry };
}
