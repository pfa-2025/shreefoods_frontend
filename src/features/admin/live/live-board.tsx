"use client";

import { AnimatePresence, m } from "motion/react";
import { Bell, BellOff, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { formatOrderNumber, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminOrder } from "@/types/admin";
import { EmailHistory } from "../email-history";
import { Lane, laneOf, needsAttention } from "./alerts";
import { useLiveOrders } from "./use-live-orders";
import { useSoundAlerts } from "./use-sound-alerts";

const LANES: { key: Lane; label: string; empty: string }[] = [
  { key: "action", label: "Needs action", empty: "No orders need action right now." },
  { key: "awaiting", label: "Awaiting payment", empty: "No orders are waiting for payment." },
  { key: "accepted", label: "Accepted", empty: "Nothing accepted yet." },
  { key: "preparing", label: "Preparing", empty: "Nothing is being prepared." },
  { key: "ready", label: "Ready", empty: "Nothing is waiting for pickup." },
  { key: "done", label: "Done (24h)", empty: "No finished orders in the last 24 hours." },
];
const DAY_MS = 24 * 3_600_000;

export function LiveBoard() {
  const router = useRouter();
  const sound = useSoundAlerts();
  const [lane, setLane] = useState<Lane>("action");
  const [now, setNow] = useState(() => Date.now()); // ticks so finished orders age out of the 24h lane
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const onUnauthorized = useCallback(() => router.replace("/admin/login"), [router]);
  const { orders, connection, loaded, syncError, lastSyncedAt, act, refresh } = useLiveOrders({
    onNewAlerts: () => sound.alert(),
    onUnauthorized,
  });

  const byLane = useMemo(() => {
    const groups: Record<Lane, AdminOrder[]> = { action: [], awaiting: [], accepted: [], preparing: [], ready: [], done: [] };
    const cutoff = new Date(now - DAY_MS).toISOString();
    for (const o of Object.values(orders)) {
      const l = laneOf(o);
      if (l === "done" && o.updatedAt < cutoff) continue;
      groups[l].push(o);
    }
    for (const l of Object.keys(groups) as Lane[]) {
      groups[l].sort((a, b) => (l === "done" ? b.updatedAt.localeCompare(a.updatedAt) : a.createdAt.localeCompare(b.createdAt))); // oldest first = fair queue
    }
    return groups;
  }, [orders, now]);

  const attention = byLane.action.filter(needsAttention).length;

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
      <h1 className="sr-only">Live orders</h1>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <ConnectionIndicator connection={connection} syncError={syncError} lastSyncedAt={lastSyncedAt} />
        <div className="flex flex-wrap items-center gap-2">
          {sound.enabled ? (
            <>
              <span className="flex items-center gap-1.5 text-sm text-primary"><Volume2 className="size-4" aria-hidden /> Sound alerts on</span>
              <Button variant="outline" onClick={() => void sound.test()} className="h-9 px-3">Test sound</Button>
              <Button variant="outline" onClick={sound.mute} className="h-9 px-3"><BellOff aria-hidden /> Mute</Button>
            </>
          ) : (
            <Button onClick={() => void sound.enable()} className="h-9 px-4"><Bell aria-hidden /> Enable sound alerts</Button>
          )}
        </div>
      </div>

      {sound.enabled && !sound.unlocked && !sound.blocked && (
        <p role="status" className="rounded-md border border-gold bg-gold/10 px-4 py-3 text-sm">
          Sound alerts are on, but your browser needs one click on this page before it will play audio. Click anywhere, or press “Test sound”.
        </p>
      )}
      {sound.enabled && sound.blocked && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Your browser blocked the alert sound, so new orders will be silent. Click “Test sound” (or allow audio for this site in the address bar).
        </p>
      )}
      {!sound.enabled && (
        <p className="text-xs text-muted-foreground">
          Sound alerts need this page open in a tab on a computer that stays awake. If the tab is closed or the computer sleeps, no sound can play.
        </p>
      )}

      {attention > 0 && (
        <p role="status" className="rounded-md border border-gold bg-gold/15 px-4 py-3 text-sm font-medium">
          {attention} order{attention === 1 ? "" : "s"} need{attention === 1 ? "s" : ""} your attention
        </p>
      )}

      <div role="tablist" aria-label="Order lanes" className="flex gap-2 overflow-x-auto border-b border-border">
        {LANES.map((l) => {
          const n = byLane[l.key].length;
          const active = lane === l.key;
          return (
            <button
              key={l.key}
              role="tab"
              id={`tab-${l.key}`}
              aria-selected={active}
              aria-controls="lane-panel"
              onClick={() => setLane(l.key)}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-ring",
                active ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {l.label}
              <span className={cn("ml-2 rounded-md px-1.5 py-0.5 text-xs tabular-nums", l.key === "action" && n > 0 ? "bg-gold text-foreground" : "bg-muted")}>{n}</span>
            </button>
          );
        })}
      </div>

      <div id="lane-panel" role="tabpanel" aria-labelledby={`tab-${lane}`} className="space-y-4">
        {!loaded && syncError ? (
          <div className="space-y-3"><ErrorState>Couldn’t load orders.</ErrorState><Button variant="outline" onClick={() => void refresh()}>Try again</Button></div>
        ) : !loaded ? (
          <div className="h-48 skeleton rounded-md" aria-busy aria-label="Loading orders" />
        ) : byLane[lane].length === 0 ? (
          <EmptyState title={LANES.find((l) => l.key === lane)!.empty} />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            <AnimatePresence initial={false}>
              {byLane[lane].map((o) => (
                <OrderCard key={o.id} order={o} act={act} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </main>
  );
}

function ConnectionIndicator({ connection, syncError, lastSyncedAt }: { connection: string; syncError: boolean; lastSyncedAt: Date | null }) {
  const live = connection === "live" && !syncError;
  const label = connection === "connecting" ? "Connecting…" : live ? "Live" : syncError ? "Disconnected: can’t reach the server" : "Disconnected: reconnecting, checking every 10 seconds";
  return (
    <p role="status" aria-live="polite" data-connection={live ? "live" : "down"} className="flex items-center gap-2 text-sm">
      <span className={cn("size-2.5 rounded-full", live ? "bg-primary" : connection === "connecting" ? "bg-muted-foreground" : "bg-destructive motion-safe:animate-pulse")} aria-hidden />
      <span className={live ? "text-foreground" : "font-medium text-destructive"}>{label}</span>
      {lastSyncedAt && <span className="text-xs text-muted-foreground">· updated {lastSyncedAt.toLocaleTimeString("en-US", { timeStyle: "medium" })}</span>}
    </p>
  );
}

type Act = (id: string, action: string, body?: object) => Promise<string | null>;

function OrderCard({ order: o, act }: { order: AdminOrder; act: Act }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [armed, setArmed] = useState(false);
  const alertNow = needsAttention(o);
  const paid = o.paymentStatus === "PAID";
  const terminal = o.fulfillmentStatus === "COMPLETED" || o.fulfillmentStatus === "CANCELLED";

  async function run(action: string, body?: object) {
    setBusy(true);
    setError(null);
    const err = await act(o.id, action, body);
    setBusy(false);
    setArmed(false);
    if (err) setError(err);
    else setCancelling(false);
  }

  const next: Record<string, { to: string; label: string } | undefined> = {
    PENDING_ACCEPTANCE: paid ? { to: "ACCEPTED", label: "Accept order" } : undefined,
    ACCEPTED: { to: "PREPARING", label: "Start preparing" },
    PREPARING: { to: "READY", label: "Mark ready" },
    READY: { to: "COMPLETED", label: "Mark completed" },
  };
  const step = next[o.fulfillmentStatus];

  return (
    <m.li
      data-testid={`order-${o.orderNumber}`}
      data-alert={alertNow}
      // slides in when it arrives; a new order that needs attention also gets a soft gold ring (twice, then it settles)
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn("rounded-md border bg-card p-5", alertNow ? "attention-ring border-2 border-gold bg-gold/5" : "border-border")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-lg font-medium">
            {formatOrderNumber(o.orderNumber)}
            {alertNow && <span className="rounded-md bg-gold px-2 py-0.5 text-xs font-semibold text-foreground">NEW</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(o.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })} · {o.fulfillmentType === "PICKUP" ? "Pickup" : o.fulfillmentType === "DINE_IN" ? "Dine-in" : "Delivery"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-xs">
          <Pill tone={o.fulfillmentStatus === "CANCELLED" ? "bad" : "neutral"}>{STATUS[o.fulfillmentStatus]}</Pill>
          <Pill tone={paid ? "good" : o.paymentStatus === "AWAITING_VERIFICATION" ? "warn" : o.paymentStatus === "FAILED" ? "bad" : "neutral"}>{PAYMENT[o.paymentStatus]}</Pill>
        </div>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <Row label="Customer" value={o.customerName} />
        <Row label="Phone" value={o.customerPhone ?? "–"} />
        <Row label="Email" value={o.customerEmail} />
        {o.paymentReference && <Row label="Payment ref" value={o.paymentReference} />}
      </dl>
      {o.notes && <p className="mt-3 rounded-md bg-secondary px-3 py-2 text-sm"><span className="text-muted-foreground">Notes: </span>{o.notes}</p>}
      {o.cancelReason && <p className="mt-3 text-sm text-destructive">Cancelled: {o.cancelReason}</p>}

      <ul className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
        {o.items.map((i) => (
          <li key={i.name} className="flex justify-between gap-4"><span>{i.quantity} × {i.name}</span><span className="tabular-nums text-muted-foreground">{formatUsd(i.lineTotalCents)}</span></li>
        ))}
        <li className="flex justify-between border-t border-border pt-2 font-medium"><span>Total</span><span className="tabular-nums">{formatUsd(o.totalCents)}</span></li>
      </ul>

      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}

      {!terminal && (
        <div className="mt-4 flex flex-wrap gap-2">
          {o.paymentStatus === "AWAITING_VERIFICATION" && (
            <>
              <Button disabled={busy} onClick={() => void run("verify-payment")} className="h-10 px-4">Payment received</Button>
              <Button variant="outline" disabled={busy} onClick={() => (armed ? void run("reject-payment") : setArmed(true))} className={cn("h-10 px-4", armed && "border-destructive text-destructive")}>
                {armed ? "Confirm: not received" : "Payment not received"}
              </Button>
            </>
          )}
          {o.paymentStatus === "UNPAID" && <p className="self-center text-sm text-muted-foreground">Waiting for the customer to pay.</p>}
          {o.paymentStatus === "FAILED" && <p className="self-center text-sm text-muted-foreground">Payment marked not received. The customer can report again.</p>}
          {step && <Button disabled={busy} onClick={() => void run("status", { status: step.to })} className="h-10 px-4">{step.label}</Button>}
          {alertNow && (
            <Button variant="outline" disabled={busy} onClick={() => void run("acknowledge")} className="h-10 px-4">Acknowledge</Button>
          )}
          <Button variant="ghost" disabled={busy} onClick={() => setCancelling((v) => !v)} className="h-10 px-3 text-destructive hover:text-destructive">Cancel order</Button>
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3"><EmailHistory orderId={o.id} /></div>

      {cancelling && !terminal && <CancelForm order={o} busy={busy} onSubmit={(b) => void run("cancel", b)} onClose={() => setCancelling(false)} />}
    </m.li>
  );
}

function CancelForm({ order: o, busy, onSubmit, onClose }: { order: AdminOrder; busy: boolean; onSubmit: (b: { reason: string; refundIssued: boolean }) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState(false);
  const paid = o.paymentStatus === "PAID";
  const valid = reason.trim().length >= 3 && (!paid || refund);
  return (
    <form
      className="mt-4 space-y-3 rounded-md border border-destructive/30 bg-destructive/5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit({ reason: reason.trim(), refundIssued: refund });
      }}
    >
      <label htmlFor={`reason-${o.id}`} className="text-sm font-medium">Reason for cancelling (shown to the customer)</label>
      <input id={`reason-${o.id}`} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
      {paid && (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} className="mt-1" />
          <span>I have refunded {formatUsd(o.totalCents)} to the customer (e.g. through PayPal). Required to cancel a paid order.</span>
        </label>
      )}
      {o.paymentStatus === "AWAITING_VERIFICATION" && <p className="text-xs text-muted-foreground">The reported payment will be marked as not received. If the money did arrive, verify it first, then cancel with a refund.</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={!valid || busy} className="h-10 bg-destructive px-4 text-white hover:bg-destructive/90">Cancel this order</Button>
        <Button type="button" variant="outline" onClick={onClose} className="h-10 px-4">Keep order</Button>
      </div>
    </form>
  );
}

const STATUS: Record<AdminOrder["fulfillmentStatus"], string> = {
  PENDING_ACCEPTANCE: "Awaiting acceptance", ACCEPTED: "Accepted", PREPARING: "Preparing", READY: "Ready", COMPLETED: "Completed", CANCELLED: "Cancelled",
};
const PAYMENT: Record<AdminOrder["paymentStatus"], string> = {
  UNPAID: "Unpaid", AWAITING_VERIFICATION: "Verify payment", PAID: "Paid", FAILED: "Not received", REFUNDED: "Refunded",
};

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex gap-2"><dt className="w-20 shrink-0 text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{value}</dd></div>;
}
function Pill({ tone, children }: { tone: "good" | "warn" | "bad" | "neutral"; children: React.ReactNode }) {
  const t = { good: "bg-primary/10 text-primary", warn: "bg-gold/25 text-foreground", bad: "bg-destructive/10 text-destructive", neutral: "bg-muted text-muted-foreground" };
  return <span className={cn("rounded-md px-2 py-0.5", t[tone])}>{children}</span>;
}
