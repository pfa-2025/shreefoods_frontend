"use client";

import { ChevronDown, Download, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatedCount, AnimatedMoney } from "@/components/motion/animated-number";
import { EmptyState, ErrorState } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { formatOrderNumber, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminOrder, Dashboard as DashboardData, OrdersPage } from "@/types/admin";
import type { FulfillmentStatus, PaymentStatus } from "@/types/order";
import { useAdmin } from "./admin-gate";
import { EmailHistory } from "./email-history";
import { adminDownload } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
import { useAdminQuery } from "./use-admin-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  PENDING_ACCEPTANCE: "Awaiting acceptance",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  AWAITING_VERIFICATION: "Verify payment",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
};
const EVENT_LABEL: Record<string, string> = {
  ORDER_CREATED: "placed",
  PAYMENT_REPORTED: "customer reported payment",
  PAYMENT_VERIFIED: "payment verified",
  PAYMENT_REJECTED: "payment rejected",
  PAYMENT_REFUNDED: "refunded",
  STATUS_CHANGED: "status changed",
  ORDER_CANCELLED: "cancelled",
  ALERT_ACKNOWLEDGED: "alert acknowledged",
};

type Preset = "all" | "today" | "7d" | "30d" | "custom";
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const toInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Range is [from, to) in the browser's local time; the API receives ISO instants. */
function rangeFor(preset: Preset, custom: { from: string; to: string }): { from?: string; to?: string } | null {
  if (preset === "all") return {}; // no date limits: every order ever placed
  const today = dayStart(new Date());
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (preset === "today") return { from: today.toISOString(), to: tomorrow.toISOString() };
  if (preset === "7d" || preset === "30d") {
    const days = preset === "7d" ? 6 : 29;
    return { from: new Date(today.getFullYear(), today.getMonth(), today.getDate() - days).toISOString(), to: tomorrow.toISOString() };
  }
  if (!custom.from || !custom.to) return null;
  const f = new Date(`${custom.from}T00:00:00`);
  const t = new Date(`${custom.to}T00:00:00`);
  t.setDate(t.getDate() + 1);
  return t > f ? { from: f.toISOString(), to: t.toISOString() } : null;
}

const select = "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

export function DashboardView() {
  const admin = useAdmin();
  const router = useRouter();
  const onUnauthorized = useCallback(() => router.replace("/admin/login"), [router]);

  const [preset, setPreset] = useState<Preset>("all"); // start with everything, so previous orders are never "missing"
  const [custom, setCustom] = useState({ from: toInput(new Date()), to: toInput(new Date()) });
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const range = useMemo(() => rangeFor(preset, custom), [preset, custom]);
  const rangeQs = range?.from && range.to ? `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}` : "";
  const ordersQs = [rangeQs, status && `status=${status}`, payment && `payment=${payment}`, q && `q=${encodeURIComponent(q)}`, `page=${page}`].filter(Boolean).join("&");

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  /** Downloads the orders matching the current period and filters as an Excel workbook. */
  async function exportExcel() {
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams();
      if (range?.from && range.to) {
        params.set("from", range.from);
        params.set("to", range.to);
      }
      if (status) params.set("status", status);
      if (payment) params.set("payment", payment);
      if (q) params.set("q", q);
      params.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone); // so times in the sheet match the screen
      const { blob, filename } = await adminDownload(`/orders/export?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return onUnauthorized();
      setExportError(e instanceof ApiError ? e.message : "Couldn’t create the Excel file. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const dash = useAdminQuery<DashboardData>(`/dashboard?${rangeQs}`, { onUnauthorized });
  const orders = useAdminQuery<OrdersPage>(`/orders?${ordersQs}`, { onUnauthorized });

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <h1 className="sr-only">Dashboard</h1>

      <section aria-labelledby="queue-h">
        <h2 id="queue-h" className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">Right now</h2>
        {dash.error && !dash.data ? (
          <div className="space-y-3"><ErrorState>{dash.error}</ErrorState><Button variant="outline" onClick={dash.reload}>Try again</Button></div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Awaiting acceptance" value={dash.data?.queue.pendingAcceptance} highlight />
            <Stat label="Payments to verify" value={dash.data?.queue.awaitingPaymentVerification} highlight />
            <Stat label="Accepted / preparing" value={dash.data ? dash.data.queue.accepted + dash.data.queue.preparing : undefined} />
            <Stat label="Ready for pickup" value={dash.data?.queue.ready} />
            <Stat label="Completed (period)" value={dash.data?.range.completed} />
            {admin.role === "OWNER" && <Link href="/admin/reviews" className="rounded-md focus-visible:outline-2 focus-visible:outline-ring"><Stat label="Reviews to approve" value={dash.data?.queue.reviewsToModerate} highlight /></Link>}
          </div>
        )}
      </section>

      <section aria-labelledby="period-h" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="period-h" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Period</h2>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Date range">
            {([["today", "Today"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["all", "All time"], ["custom", "Custom"]] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={preset === k}
                onClick={() => { setPreset(k); setPage(1); }}
                className={cn("h-9 rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring", preset === k ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
              >
                {label}
              </button>
            ))}
            {preset === "custom" && (
              <>
                <label className="sr-only" htmlFor="from">From</label>
                <input id="from" type="date" value={custom.from} max={custom.to} onChange={(e) => { setCustom((c) => ({ ...c, from: e.target.value })); setPage(1); }} className={select} />
                <span aria-hidden>–</span>
                <label className="sr-only" htmlFor="to">To</label>
                <input id="to" type="date" value={custom.to} min={custom.from} onChange={(e) => { setCustom((c) => ({ ...c, to: e.target.value })); setPage(1); }} className={select} />
              </>
            )}
          </div>
        </div>
        {!range ? (
          <p role="alert" className="text-sm text-destructive">Choose a valid date range.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Orders placed" value={dash.data?.range.orders} />
            <Stat label="Paid orders (verified)" value={dash.data?.range.paidOrders ?? undefined} hidden={admin.role !== "OWNER"} />
            <Stat label="Revenue (verified payments)" value={dash.data?.range.revenueCents ?? undefined} money hidden={admin.role !== "OWNER"} />
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <section aria-labelledby="orders-h" className="min-w-0 space-y-4">
          <h2 id="orders-h" className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Orders</h2>
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <label htmlFor="search" className="sr-only">Search orders</label>
              <input id="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone or SF-0001" className={cn(select, "w-full pl-9")} />
            </div>
            <label className="sr-only" htmlFor="status">Order status</label>
            <select id="status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={select}>
              <option value="">All order statuses</option>
              {Object.entries(FULFILLMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="sr-only" htmlFor="payment">Payment status</label>
            <select id="payment" value={payment} onChange={(e) => { setPayment(e.target.value); setPage(1); }} className={select}>
              <option value="">All payments</option>
              {Object.entries(PAYMENT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {admin.role === "OWNER" && (
              <Button variant="outline" onClick={() => void exportExcel()} disabled={exporting || !orders.data || orders.data.total === 0} className="h-10 px-4">
                <Download aria-hidden /> {exporting ? "Preparing file…" : "Export to Excel"}
              </Button>
            )}
          </div>
          {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}
          {admin.role === "OWNER" && orders.data && orders.data.total > 0 && (
            <p className="text-xs text-muted-foreground">Exports all {orders.data.total} order{orders.data.total === 1 ? "" : "s"} matching the period and filters above (not just this page).</p>
          )}

          {orders.error && !orders.data ? (
            <div className="space-y-3"><ErrorState>{orders.error}</ErrorState><Button variant="outline" onClick={orders.reload}>Try again</Button></div>
          ) : orders.loading ? (
            <div className="h-64 skeleton rounded-md" aria-busy aria-label="Loading orders" />
          ) : orders.data && orders.data.orders.length === 0 ? (
            <EmptyState title="No orders found">Try a different date range or clear the filters.</EmptyState>
          ) : orders.data ? (
            <>
              {orders.error && <p role="status" className="text-sm text-destructive">Couldn’t refresh: showing the last loaded orders.</p>}
              <ul className="divide-y divide-border rounded-md border border-border bg-card">
                {orders.data.orders.map((o) => <OrderRow key={o.id} order={o} />)}
              </ul>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{orders.data.total} order{orders.data.total === 1 ? "" : "s"}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <span>Page {orders.data.page} of {Math.max(1, Math.ceil(orders.data.total / orders.data.pageSize))}</span>
                  <Button variant="outline" disabled={page * orders.data.pageSize >= orders.data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </>
          ) : null}
        </section>

        <aside aria-labelledby="activity-h">
          <h2 id="activity-h" className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">Recent activity</h2>
          {dash.data && dash.data.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {(dash.data?.recentActivity ?? []).map((e) => (
                <li key={e.id}>
                  <span className="font-medium">{formatOrderNumber(e.orderNumber)}</span> {EVENT_LABEL[e.type] ?? e.type}
                  <span className="block text-xs text-muted-foreground">{new Date(e.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 text-xs text-muted-foreground">Updates every 30 seconds. Live updates and sound alerts arrive in the next release.</p>
        </aside>
      </div>
    </main>
  );
}

function Stat({ label, value, highlight, money, hidden }: { label: string; value: number | undefined; highlight?: boolean; money?: boolean; hidden?: boolean }) {
  if (hidden) return null;
  const urgent = highlight && (value ?? 0) > 0;
  return (
    <div className={cn("rounded-md border bg-card p-4", urgent ? "border-gold" : "border-border")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-medium tabular-nums", urgent ? "text-primary" : "text-foreground")}>
        {value === undefined ? <span className="text-muted-foreground" aria-label="loading">–</span> : money ? <AnimatedMoney cents={value} /> : <AnimatedCount value={value} />}
      </p>
    </div>
  );
}

function OrderRow({ order: o }: { order: AdminOrder }) {
  const [open, setOpen] = useState(false);
  const needsAction = o.fulfillmentStatus === "PENDING_ACCEPTANCE" || o.paymentStatus === "AWAITING_VERIFICATION";
  return (
    <li className={cn(needsAction && "bg-gold/5")}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring">
        <span className="w-20 shrink-0 font-medium tabular-nums">{formatOrderNumber(o.orderNumber)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{o.customerName}</span>
          <span className="block text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</span>
        </span>
        <span className="hidden flex-col items-end gap-1 text-xs sm:flex">
          <Badge tone={o.fulfillmentStatus === "PENDING_ACCEPTANCE" ? "warn" : o.fulfillmentStatus === "CANCELLED" ? "bad" : "neutral"}>{FULFILLMENT_LABEL[o.fulfillmentStatus]}</Badge>
          <Badge tone={o.paymentStatus === "PAID" ? "good" : o.paymentStatus === "AWAITING_VERIFICATION" ? "warn" : o.paymentStatus === "FAILED" ? "bad" : "neutral"}>{PAYMENT_LABEL[o.paymentStatus]}</Badge>
        </span>
        <span className="w-20 shrink-0 text-right text-sm tabular-nums">{formatUsd(o.totalCents)}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border bg-background px-4 py-4 text-sm">
          <div className="flex flex-wrap gap-2 sm:hidden">
            <Badge tone="neutral">{FULFILLMENT_LABEL[o.fulfillmentStatus]}</Badge>
            <Badge tone="neutral">{PAYMENT_LABEL[o.paymentStatus]}</Badge>
          </div>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            <Detail label="Email" value={o.customerEmail} />
            <Detail label="Phone" value={o.customerPhone ?? "–"} />
            <Detail label="Type" value={o.fulfillmentType === "PICKUP" ? "Pickup" : o.fulfillmentType === "DINE_IN" ? "Dine-in" : "Delivery"} />
            <Detail label="Payment reference" value={o.paymentReference ?? "–"} />
          </dl>
          {o.notes && <p><span className="text-muted-foreground">Notes: </span>{o.notes}</p>}
          <ul className="space-y-1">
            {o.items.map((i) => <li key={i.name} className="flex justify-between"><span>{i.quantity} × {i.name}</span><span className="tabular-nums">{formatUsd(i.lineTotalCents)}</span></li>)}
          </ul>
          <EmailHistory orderId={o.id} />
        </div>
      )}
    </li>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>;
}

function Badge({ tone, children }: { tone: "good" | "warn" | "bad" | "neutral"; children: React.ReactNode }) {
  const tones = { good: "bg-primary/10 text-primary", warn: "bg-gold/20 text-foreground", bad: "bg-destructive/10 text-destructive", neutral: "bg-muted text-muted-foreground" };
  return <span className={cn("rounded-md px-2 py-0.5", tones[tone])}>{children}</span>;
}
