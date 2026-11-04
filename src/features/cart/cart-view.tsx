"use client";

import { AnimatePresence, m } from "motion/react";
import { Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Appear } from "@/components/motion/appear";
import { AnimatedMoney } from "@/components/motion/animated-number";
import { EmptyState, ErrorState } from "@/components/site/section";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { QuantityStepper } from "./quantity-stepper";
import { useCart } from "./use-cart";
import { useQuote } from "./use-quote";

export function CartView() {
  const { lines, setQuantity, removeItem, clearCart } = useCart();
  const { state, retry } = useQuote(lines);

  if (lines.length === 0) {
    return (
      <EmptyState title="Your cart is empty">
        <p>Add something delicious from the menu.</p>
        <Link href="/menu" className={cn(buttonVariants(), "mt-5 h-11 px-6")}>
          Browse the menu
        </Link>
      </EmptyState>
    );
  }
  if (state.status === "loading") return <div className="h-64 skeleton rounded-md" aria-busy aria-label="Loading your cart" />;
  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <ErrorState>We couldn’t load your cart prices. Please check your connection and try again.</ErrorState>
        <Button onClick={retry} className="h-10 px-5">
          Try again
        </Button>
      </div>
    );
  }

  const { quote } = state;
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
      <div>
        {quote.issues.length > 0 && (
          <Appear role="alert" className="mb-6 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Some items can’t be ordered right now</p>
            <ul className="mt-2 space-y-2">
              {quote.issues.map((i) => (
                <li key={i.menuItemId} className="flex items-center justify-between gap-4">
                  <span>{i.name ?? "An item"} {i.code === "UNAVAILABLE" ? "is currently unavailable." : "is no longer on the menu."}</span>
                  <Button variant="outline" size="sm" onClick={() => removeItem(i.menuItemId)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </Appear>
        )}
        <ul className="divide-y divide-border border-y border-border">
          <AnimatePresence initial={false}>
          {quote.lines.map((l) => (
            <m.li key={l.menuItemId} className="flex gap-4 overflow-hidden py-5" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
              <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-muted sm:size-24">
                {l.imageUrl && <Image src={l.imageUrl} alt={l.imageAlt} fill sizes="96px" className="object-cover" />}
              </div>
              <div className="flex flex-1 flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <p className="font-display text-xl">{l.name}</p>
                  <p className="text-sm text-muted-foreground">{formatUsd(l.unitPriceCents)} each</p>
                </div>
                <div className="flex items-center gap-4">
                  <QuantityStepper name={l.name} quantity={l.quantity} onChange={(n) => setQuantity(l.menuItemId, n)} />
                  <p className="w-20 text-right text-sm tabular-nums"><AnimatedMoney cents={l.lineTotalCents} /></p>
                  <button
                    type="button"
                    onClick={() => removeItem(l.menuItemId)}
                    aria-label={`Remove ${l.name} from cart`}
                    className="rounded-md p-2 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            </m.li>
          ))}
          </AnimatePresence>
        </ul>
        <button type="button" onClick={clearCart} className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-destructive">
          Clear cart
        </button>
      </div>

      <Appear className="h-fit"><aside aria-label="Order summary" className="h-fit rounded-md border border-border bg-card p-6">
        <h2 className="font-display text-2xl text-primary">Summary</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums"><AnimatedMoney cents={quote.subtotalCents} /></dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax ({(quote.taxRateBps / 100).toFixed(2)}%)</dt>
            <dd className="tabular-nums"><AnimatedMoney cents={quote.taxCents} /></dd>
          </div>
          {quote.feeCents > 0 && (
            <div className="flex justify-between">
              <dt>Fees</dt>
              <dd className="tabular-nums"><AnimatedMoney cents={quote.feeCents} /></dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-3 text-base font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums"><AnimatedMoney cents={quote.totalCents} /></dd>
          </div>
        </dl>
        {quote.canCheckout ? (
          <Link href="/checkout" className={cn(buttonVariants(), "mt-6 h-11 w-full")}>
            Proceed to checkout
          </Link>
        ) : (
          <>
            <Button disabled className="mt-6 h-11 w-full">
              Proceed to checkout
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              {!quote.ordersOpen ? "Online ordering is currently closed." : "Remove the unavailable items above to continue."}
            </p>
          </>
        )}
        <p className="mt-4 text-xs text-muted-foreground">Prices and tax are confirmed by the restaurant when you order.</p>
      </aside></Appear>
    </div>
  );
}
