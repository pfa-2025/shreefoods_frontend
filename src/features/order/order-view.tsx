"use client";

import { AnimatePresence, m } from "motion/react";
import { Check, Circle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Appear } from "@/components/motion/appear";
import { ErrorState } from "@/components/site/section";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { formatOrderNumber, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReviewSection } from "./review-section";
import { TrackingLink } from "./tracking-link";
import { rememberOrder } from "./recent-orders-store";
import type { FulfillmentStatus, PublicOrder } from "@/types/order";

type State = { status: "loading" } | { status: "notfound" } | { status: "error" } | { status: "ready"; order: PublicOrder };

const STEPS: { status: FulfillmentStatus; label: string }[] = [
  { status: "PENDING_ACCEPTANCE", label: "Received" },
  { status: "ACCEPTED", label: "Accepted" },
  { status: "PREPARING", label: "Preparing" },
  { status: "READY", label: "Ready for pickup" },
  { status: "COMPLETED", label: "Completed" },
];
const POLL_MS = 15_000;

export function OrderView({ token, mode }: { token: string; mode: "confirmation" | "status" }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const [attempt, setAttempt] = useState(0);
  const finished = state.status === "ready" && (state.order.fulfillmentStatus === "COMPLETED" || state.order.fulfillmentStatus === "CANCELLED");
  const stopped = state.status === "notfound" || finished;

  // Fetch on mount / retry, then poll while the order is still active and the tab is visible.
  useEffect(() => {
    const ctl = new AbortController();
    const fetchOrder = () =>
      api<PublicOrder>(`/orders/${encodeURIComponent(token)}`, { cache: "no-store", signal: ctl.signal })
        .then((order) => {
          rememberOrder({ token, orderNumber: order.orderNumber, createdAt: order.createdAt, totalCents: order.totalCents });
          setState({ status: "ready", order });
        })
        .catch((e: unknown) => {
          if ((e as Error).name === "AbortError") return;
          if (e instanceof ApiError && e.status === 404) setState({ status: "notfound" });
          else setState((s) => (s.status === "ready" ? s : { status: "error" })); // keep showing the last good data
        });
    void fetchOrder();
    if (stopped) return () => ctl.abort();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void fetchOrder();
    }, POLL_MS);
    return () => {
      clearInterval(id);
      ctl.abort();
    };
  }, [token, attempt, stopped]);

  if (state.status === "loading") return <div className="h-72 skeleton rounded-md" aria-busy aria-label="Loading your order" />;
  if (state.status === "notfound") {
    return (
      <div>
        <p className="max-w-lg text-muted-foreground">We couldn’t find that order. Please check the link you were given.</p>
        <Link href="/menu" className={cn(buttonVariants({ variant: "outline" }), "mt-6 h-11 px-6")}>Browse the menu</Link>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <ErrorState>We couldn’t load your order. Please try again.</ErrorState>
        <Button onClick={() => { setState({ status: "loading" }); setAttempt((n) => n + 1); }} className="h-10 px-5">Try again</Button>
      </div>
    );
  }

  const { order } = state;
  const cancelled = order.fulfillmentStatus === "CANCELLED";
  const stepIndex = STEPS.findIndex((s) => s.status === order.fulfillmentStatus);

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
      <div className="space-y-10">
        {mode === "confirmation" && (
          <Appear className="rounded-md border border-primary/30 bg-primary/5 p-5">
            <p className="font-display text-2xl text-primary">Thank you! Your order {formatOrderNumber(order.orderNumber)} is placed.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.emailsEnabled
                ? "We’ve emailed you this link and we’ll email you again when your order is accepted and when it’s ready. This page also updates automatically."
                : "Bookmark this page. It’s the only way to check on your order, and it updates automatically."}
            </p>
          </Appear>
        )}

        {order.fulfillmentStatus === "READY" && (
          <Appear role="status" className="rounded-md border-2 border-primary bg-primary/5 p-5">
            <p className="font-display text-2xl text-primary">Your order is ready{order.fulfillmentType === "PICKUP" ? " for pickup" : ""}!</p>
            <p className="mt-1 text-sm">Show order number <strong>{formatOrderNumber(order.orderNumber)}</strong> when you arrive.</p>
          </Appear>
        )}

        {mode === "confirmation" && <TrackingLink token={token} orderRef={formatOrderNumber(order.orderNumber)} emphasised />}

        <PaymentSection token={token} order={order} onChange={(o) => setState({ status: "ready", order: o })} />

        <section aria-labelledby="progress">
          <h2 id="progress" className="mb-4 font-display text-2xl text-primary">Order progress</h2>
          {cancelled ? (
            <p role="status" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
              This order was cancelled.{order.cancelReason ? ` Reason: ${order.cancelReason}` : ""}
              {order.paymentStatus === "REFUNDED" ? " Your payment has been refunded." : " If you already paid, please contact the restaurant."}
            </p>
          ) : (
            <ol className="space-y-3" aria-live="polite">
              {STEPS.map((s, i) => {
                const reached = i <= stepIndex;
                return (
                  <m.li key={s.status} aria-current={i === stepIndex ? "step" : undefined} className={cn("flex items-center gap-3 text-sm", reached ? "text-foreground" : "text-muted-foreground")} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: 0.05 * i }}>
                    <AnimatePresence mode="wait" initial={false}>
                      <m.span key={reached ? "done" : "todo"} className="inline-flex" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }} transition={{ type: "spring", stiffness: 500, damping: 16 }}>
                        {reached ? <Check className="size-4 text-primary" aria-hidden /> : <Circle className="size-4" aria-hidden />}
                      </m.span>
                    </AnimatePresence>
                    <span className={i === stepIndex ? "font-medium" : undefined}>{s.label}</span>
                    {reached && <span className="sr-only">(done)</span>}
                  </m.li>
                );
              })}
            </ol>
          )}
        </section>

        <ReviewSection token={token} order={order} onSubmitted={(review) => setState({ status: "ready", order: { ...order, review, canReview: false } })} />

        {mode === "status" && <TrackingLink token={token} orderRef={formatOrderNumber(order.orderNumber)} />}
      </div>

      <aside aria-label="Order details" className="h-fit rounded-md border border-border bg-card p-6">
        <h2 className="font-display text-2xl text-primary">{formatOrderNumber(order.orderNumber)}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(order.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · {order.fulfillmentType === "PICKUP" ? "Pickup" : order.fulfillmentType === "DINE_IN" ? "Dine-in" : "Delivery"}
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {order.items.map((i) => (
            <li key={i.name} className="flex justify-between gap-4">
              <span>{i.quantity} × {i.name}</span>
              <span className="tabular-nums">{formatUsd(i.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatUsd(order.subtotalCents)}</dd></div>
          <div className="flex justify-between"><dt>Tax</dt><dd className="tabular-nums">{formatUsd(order.taxCents)}</dd></div>
          {order.feeCents > 0 && <div className="flex justify-between"><dt>Fees</dt><dd className="tabular-nums">{formatUsd(order.feeCents)}</dd></div>}
          <div className="flex justify-between border-t border-border pt-3 text-base font-medium"><dt>Total</dt><dd className="tabular-nums">{formatUsd(order.totalCents)}</dd></div>
        </dl>
      </aside>
    </div>
  );
}

function PaymentSection({ token, order, onChange }: { token: string; order: PublicOrder; onChange: (o: PublicOrder) => void }) {
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function report() {
    setBusy(true);
    setError(null);
    try {
      onChange(await api<PublicOrder>(`/orders/${encodeURIComponent(token)}/report-payment`, { method: "POST", json: { reference } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const { paymentStatus: p, payment } = order;

  if (p === "PAID") return <Notice tone="good" title="Payment confirmed">We’ve received your payment. Thank you!</Notice>;
  if (p === "REFUNDED") return <Notice title="Payment refunded">Your payment has been refunded.</Notice>;
  if (order.fulfillmentStatus === "CANCELLED") return null;
  if (p === "AWAITING_VERIFICATION") {
    return (
      <Notice title="Confirming your payment">
        Thanks! We’re checking that your payment arrived. We’ll start your order as soon as we confirm it. This page updates automatically.
      </Notice>
    );
  }

  return (
    <section aria-labelledby="pay" className="rounded-md border border-border p-6">
      <h2 id="pay" className="font-display text-2xl text-primary">Pay {formatUsd(order.totalCents)}</h2>
      {p === "FAILED" && (
        <p role="alert" className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          We couldn’t find your payment. Please check the amount and try again, or contact the restaurant.
        </p>
      )}
      {payment && (
        <div className="mt-5 grid gap-6 sm:grid-cols-[200px_1fr] sm:items-center">
          {payment.qrUrl ? (
            <div className="relative aspect-square w-48 overflow-hidden rounded-md border border-border bg-white sm:w-full">
              <Image src={payment.qrUrl} alt={payment.qrAlt} fill sizes="200px" className="object-contain" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">The payment QR code isn’t available right now. Please contact the restaurant.</p>
          )}
          <div className="space-y-3 text-sm">
            <p>{payment.instructions}</p>
            {payment.handle && <p className="text-muted-foreground">Or send to: <span className="font-medium text-foreground">{payment.handle}</span></p>}
            <p>Amount to send: <span className="font-medium tabular-nums">{formatUsd(order.totalCents)}</span></p>
          </div>
        </div>
      )}
      <div className="mt-6 border-t border-border pt-5">
        <label htmlFor="ref" className="text-sm font-medium">
          Transaction reference <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input
          id="ref"
          value={reference}
          maxLength={100}
          onChange={(e) => setReference(e.target.value)}
          className="mt-1.5 block w-full max-w-sm rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-4">
          <Button onClick={() => void report()} disabled={busy} className="h-11 px-6">
            {busy ? "Sending…" : "I’ve paid"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Only tap this after you’ve sent the payment. We confirm every payment by hand.</p>
      </div>
    </section>
  );
}

function Notice({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "good" }) {
  return (
    <Appear role="status" className={cn("rounded-md border p-5", tone === "good" ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/60")}>
      <p className="font-display text-xl text-primary">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </Appear>
  );
}
