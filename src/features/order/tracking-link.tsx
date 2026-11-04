"use client";

import { AnimatePresence, m } from "motion/react";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The customer's private tracking address, with copy/share. Anyone with this link can see the order's progress. */
export function TrackingLink({ token, orderRef, emphasised }: { token: string; orderRef: string; emphasised?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  // Rendered only after the order has loaded in the browser, so the real address is known.
  const url = `${window.location.origin}/order/${token}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed"); // clipboard blocked: the address is still shown and selectable below
      (document.getElementById("tracking-url") as HTMLInputElement | null)?.select();
    }
    setTimeout(() => setState("idle"), 3000);
  }

  return (
    <section aria-labelledby="tracking-h" className={cn("rounded-md border p-5", emphasised ? "border-primary/40 bg-card" : "border-border")}>
      <h2 id="tracking-h" className="font-display text-2xl text-primary">Track this order anytime</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        This private link shows live progress for order {orderRef}. Save it or send it to yourself. Anyone with the link can see the order’s status, so don’t post it publicly.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="tracking-url" className="sr-only">Tracking link for order {orderRef}</label>
        <input id="tracking-url" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
        <div className="flex gap-2">
          <Button type="button" onClick={() => void copy()} className="h-10 px-4">
            <AnimatePresence mode="wait" initial={false}>
              <m.span key={state === "copied" ? "ok" : "copy"} className="inline-flex" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={{ duration: 0.14 }}>
                {state === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
              </m.span>
            </AnimatePresence>{" "}
            {state === "copied" ? "Copied" : "Copy link"}
          </Button>
          {canShare && (
            <Button type="button" variant="outline" onClick={() => void navigator.share({ title: `Order ${orderRef}`, url }).catch(() => undefined)} className="h-10 px-4">
              <Share2 aria-hidden /> Share
            </Button>
          )}
        </div>
      </div>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm">
        {state === "copied" && <span className="text-primary">Link copied.</span>}
        {state === "failed" && <span className="text-destructive">Couldn’t copy automatically. The link is selected, so press Ctrl+C (or ⌘C).</span>}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Lost it later? <Link href="/track" className="text-primary underline underline-offset-4">Find your orders on this device</Link>.
      </p>
      {emphasised && (
        <Link href={`/order/${token}`} className={cn(buttonVariants({ variant: "outline" }), "mt-3 h-10 px-4")}>
          <ExternalLink aria-hidden /> Open tracking page
        </Link>
      )}
    </section>
  );
}
