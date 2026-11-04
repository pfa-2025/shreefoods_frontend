"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";
import { cn } from "@/lib/utils";
import { useAdminQuery } from "./use-admin-query";

interface EmailRow {
  id: string;
  template: string;
  subject: string | null;
  status: "QUEUED" | "SENT" | "FAILED";
  attempts: number;
  error: string | null;
  provider: string | null;
  sentAt: string | null;
  nextAttemptAt: string | null;
}

const LABEL: Record<string, string> = {
  order_received: "Order received",
  payment_confirmed: "Payment confirmed",
  payment_not_received: "Payment not found",
  order_accepted: "Order accepted",
  order_ready: "Ready for pickup",
  order_cancelled: "Order cancelled",
};

/** What the customer was (or wasn't) emailed about this order. Loads only when opened. */
export function EmailHistory({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const { data, error, loading, reload } = useAdminQuery<{ provider: string; emails: EmailRow[] }>(`/orders/${orderId}/emails`, { refreshMs: 15_000, enabled: open });
  const [busy, setBusy] = useState<string | null>(null);

  return (
    <div className="text-sm">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">
        {open ? "Hide email history" : "Email history"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {error && !data && <p role="alert" className="text-destructive">{error}</p>}
          {loading && <p className="text-muted-foreground">Loading…</p>}
          {data?.provider === "log" && (
            <p className="rounded-md border border-gold bg-gold/10 px-3 py-2 text-xs">Development mode: emails are only logged on the server and are <strong>not actually sent</strong>. Set up Resend to email customers.</p>
          )}
          {data && data.emails.length === 0 && <p className="text-muted-foreground">No emails for this order yet.</p>}
          <ul className="space-y-1.5">
            {data?.emails.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="min-w-36 font-medium">{LABEL[e.template] ?? e.template}</span>
                <span className={cn("rounded-md px-2 py-0.5 text-xs", e.status === "SENT" ? "bg-primary/10 text-primary" : e.status === "FAILED" ? "bg-destructive/10 text-destructive" : "bg-gold/25")}>
                  {e.status === "SENT" ? (e.provider === "log" ? "Logged (not sent)" : "Sent") : e.status === "FAILED" ? "Failed" : "Retrying"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {e.attempts > 1 || e.status !== "SENT" ? `${e.attempts} attempt${e.attempts === 1 ? "" : "s"}` : ""}
                  {e.sentAt ? ` · ${new Date(e.sentAt).toLocaleTimeString("en-US", { timeStyle: "short" })}` : ""}
                </span>
                {e.error && <span className="w-full text-xs text-destructive">{e.error}</span>}
                {e.status === "FAILED" && (
                  <Button
                    variant="outline"
                    disabled={busy === e.id}
                    onClick={() => {
                      setBusy(e.id);
                      void adminApi(`/emails/${e.id}/retry`, { method: "POST" }).finally(() => {
                        setBusy(null);
                        reload();
                      });
                    }}
                    className="h-8 px-3"
                  >
                    Try sending again
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
