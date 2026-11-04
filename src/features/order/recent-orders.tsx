"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { EmptyState } from "@/components/site/section";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatOrderNumber, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { forgetOrders, getServerSnapshot, getSnapshot, subscribe } from "./recent-orders-store";

export function RecentOrders() {
  const orders = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (orders.length === 0) {
    return (
      <EmptyState title="No orders found on this device">
        <p>Open the tracking link from your order confirmation page or from your order email. Once you do, the order will be listed here.</p>
        <Link href="/menu" className={cn(buttonVariants(), "mt-5 h-11 px-6")}>Browse the menu</Link>
      </EmptyState>
    );
  }
  return (
    <div className="space-y-6">
      <ul className="divide-y divide-border rounded-md border border-border bg-card">
        {orders.map((o) => (
          <li key={o.token} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="font-medium">{formatOrderNumber(o.orderNumber)}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(o.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                {o.totalCents !== null && ` · ${formatUsd(o.totalCents)}`}
              </p>
            </div>
            <Link href={`/order/${o.token}`} aria-label={`Track order ${formatOrderNumber(o.orderNumber)}`} className={cn(buttonVariants({ variant: "outline" }), "h-10 px-4")}>
              Track order
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">These orders are remembered only in this browser. Nothing personal is stored here, just the order numbers and private links.</p>
      <Button variant="ghost" onClick={forgetOrders} className="h-9 px-3 text-destructive hover:text-destructive">Remove these from this device</Button>
    </div>
  );
}
