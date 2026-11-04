"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { AnimatedCheck } from "@/components/motion/animated-check";
import { AnimatedMoney } from "@/components/motion/animated-number";
import { Appear } from "@/components/motion/appear";
import { EmptyState, ErrorState } from "@/components/site/section";
import { FieldError } from "@/components/ui/field-error";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCart } from "@/features/cart/use-cart";
import { useQuote } from "@/features/cart/use-quote";
import { rememberOrder } from "@/features/order/recent-orders-store";
import { ApiError, api } from "@/lib/api";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SiteInfo } from "@/types/site";

const TYPE_LABEL = { PICKUP: "Pickup", DINE_IN: "Dine-in", DELIVERY: "Delivery" } as const;
type OrderType = keyof typeof TYPE_LABEL;

const digits = (v: string) => v.replace(/\D/g, "");
// Mirrors the server rules for fast feedback. The server is still the authority.
const schema = z
  .object({
    customerName: z.string().trim().min(2, "Enter your full name").max(80),
    customerEmail: z.string().trim().email("Enter a valid email address").max(254),
    customerPhone: z.string().max(30),
    fulfillmentType: z.enum(["PICKUP", "DINE_IN", "DELIVERY"]),
    notes: z.string().max(500, "Please keep notes under 500 characters"),
  })
  .superRefine((v, ctx) => {
    const d = digits(v.customerPhone);
    const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
    if (v.fulfillmentType !== "DINE_IN" && !v.customerPhone.trim()) {
      ctx.addIssue({ code: "custom", path: ["customerPhone"], message: "Phone number is required for this order type" });
    } else if (v.customerPhone.trim() && !/^[2-9]\d{9}$/.test(ten)) {
      ctx.addIssue({ code: "custom", path: ["customerPhone"], message: "Enter a valid 10-digit US phone number" });
    }
  });
type FormValues = z.infer<typeof schema>;

const KEY = "shree-checkout-key-v1";
/** One idempotency key per distinct cart, kept across refreshes so a retry can never double-order. */
function idempotencyKeyFor(signature: string): string {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null") as { sig: string; key: string } | null;
    if (saved?.sig === signature) return saved.key;
  } catch {
    /* fall through to a new key */
  }
  const key = crypto.randomUUID().replaceAll("-", "");
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ sig: signature, key }));
  } catch {
    /* storage blocked: the in-memory key below still protects against double clicks */
  }
  return key;
}

const field =
  "mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive";

export function CheckoutForm({ site }: { site: SiteInfo | null }) {
  const router = useRouter();
  const { lines, clearCart } = useCart();
  const { state, retry } = useQuote(lines);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const types: OrderType[] = site
    ? (["PICKUP", "DINE_IN", "DELIVERY"] as const).filter((t) =>
        t === "PICKUP" ? site.fulfillment.pickup : t === "DINE_IN" ? site.fulfillment.dineIn : false, // delivery isn't offered in the UI yet
      )
    : ["PICKUP"];

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { customerName: "", customerEmail: "", customerPhone: "", fulfillmentType: types[0] ?? "PICKUP", notes: "" },
  });
  const type = useWatch({ control, name: "fulfillmentType" });

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      const res = await api<{ token: string; orderNumber: number }>("/orders", {
        method: "POST",
        json: {
          ...values,
          idempotencyKey: idempotencyKeyFor(JSON.stringify(lines)),
          items: lines,
        },
      });
      rememberOrder({ token: res.token, orderNumber: res.orderNumber, totalCents: quote.totalCents });
      setDone(true);
      clearCart();
      try {
        window.sessionStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      router.push(`/order/${res.token}/confirmation`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400 && Array.isArray(e.details)) {
        for (const d of e.details as { path: string; message: string }[]) {
          if (d.path in values) setError(d.path as keyof FormValues, { message: d.message });
        }
        setSubmitError("Please fix the highlighted fields.");
      } else if (e instanceof ApiError && e.status === 409) {
        setSubmitError(`${e.message}. Please review your cart.`);
        retry();
      } else {
        setSubmitError(e instanceof ApiError ? e.message : "We couldn’t place your order. Please check your connection and try again.");
      }
    }
  }

  if (done) {
    return (
      <Appear role="status" className="flex items-center gap-4 py-8 text-primary">
        <AnimatedCheck className="size-14 shrink-0" />
        <p className="font-display text-2xl">Order placed. Taking you to your confirmation…</p>
      </Appear>
    );
  }

  if (lines.length === 0) {
    return (
      <EmptyState title="Your cart is empty">
        <p>Add something from the menu before checking out.</p>
        <Link href="/menu" className={cn(buttonVariants(), "mt-5 h-11 px-6")}>
          Browse the menu
        </Link>
      </EmptyState>
    );
  }
  if (state.status === "loading") return <div className="h-64 skeleton rounded-md" aria-busy aria-label="Loading checkout" />;
  if (state.status === "error") {
    return (
      <div className="space-y-4">
        <ErrorState>We couldn’t load your order total. Please try again.</ErrorState>
        <Button onClick={retry} className="h-10 px-5">Try again</Button>
      </div>
    );
  }
  const { quote } = state;
  if (!quote.canCheckout) {
    return (
      <div className="space-y-4">
        <ErrorState>
          {!quote.ordersOpen ? "Online ordering is currently closed." : "Some items in your cart can’t be ordered right now."}
        </ErrorState>
        <Link href="/cart" className={cn(buttonVariants({ variant: "outline" }), "h-10 px-5")}>
          Back to cart
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6" aria-label="Checkout">
        <div>
          <label htmlFor="customerName" className="text-sm font-medium">Full name</label>
          <input id="customerName" autoComplete="name" className={field} aria-invalid={!!errors.customerName} aria-describedby={errors.customerName ? "err-name" : undefined} {...register("customerName")} />
          <FieldError id="err-name" message={errors.customerName?.message} />
        </div>
        <div>
          <label htmlFor="customerEmail" className="text-sm font-medium">Email</label>
          <input id="customerEmail" type="email" autoComplete="email" className={field} aria-invalid={!!errors.customerEmail} aria-describedby={errors.customerEmail ? "err-email" : undefined} {...register("customerEmail")} />
          <FieldError id="err-email" message={errors.customerEmail?.message} />
        </div>

        <fieldset>
          <legend className="text-sm font-medium">Order type</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {types.map((t) => (
              <label key={t} className={cn("cursor-pointer rounded-md border px-4 py-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40", "border-border")}>
                <input type="radio" value={t} className="sr-only" {...register("fulfillmentType")} />
                {TYPE_LABEL[t]}
              </label>
            ))}
          </div>
          {types.length === 1 && <p className="mt-2 text-xs text-muted-foreground">Pickup is currently the only option. We’ll tell you when it’s ready.</p>}
        </fieldset>

        <div>
          <label htmlFor="customerPhone" className="text-sm font-medium">
            Phone {type === "DINE_IN" && <span className="font-normal text-muted-foreground">(optional)</span>}
          </label>
          <input id="customerPhone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(201) 555-0123" className={field} aria-invalid={!!errors.customerPhone} aria-describedby={errors.customerPhone ? "err-phone" : undefined} {...register("customerPhone")} />
          <FieldError id="err-phone" message={errors.customerPhone?.message} />
        </div>

        <div>
          <label htmlFor="notes" className="text-sm font-medium">Special instructions <span className="font-normal text-muted-foreground">(optional)</span></label>
          <textarea id="notes" rows={3} className={field} aria-invalid={!!errors.notes} {...register("notes")} />
          <FieldError message={errors.notes?.message} />
        </div>

        {submitError && <Appear><ErrorState>{submitError}</ErrorState></Appear>}
        <Button type="submit" disabled={isSubmitting} className="h-12 w-full text-base sm:w-auto sm:px-10">
          {isSubmitting ? "Placing order…" : `Place order · ${formatUsd(quote.totalCents)}`}
        </Button>
        <p className="text-xs text-muted-foreground">You’ll pay by scanning our QR code on the next screen. Your order is prepared once we confirm the payment.</p>
      </form>

      <aside aria-label="Order summary" className="h-fit rounded-md border border-border bg-card p-6">
        <h2 className="font-display text-2xl text-primary">Your order</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {quote.lines.map((l) => (
            <li key={l.menuItemId} className="flex justify-between gap-4">
              <span>{l.quantity} × {l.name}</span>
              <span className="tabular-nums"><AnimatedMoney cents={l.lineTotalCents} /></span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums"><AnimatedMoney cents={quote.subtotalCents} /></dd></div>
          <div className="flex justify-between"><dt>Tax ({(quote.taxRateBps / 100).toFixed(2)}%)</dt><dd className="tabular-nums"><AnimatedMoney cents={quote.taxCents} /></dd></div>
          {quote.feeCents > 0 && <div className="flex justify-between"><dt>Fees</dt><dd className="tabular-nums">{formatUsd(quote.feeCents)}</dd></div>}
          <div className="flex justify-between border-t border-border pt-3 text-base font-medium"><dt>Total</dt><dd className="tabular-nums"><AnimatedMoney cents={quote.totalCents} /></dd></div>
        </dl>
        <Link href="/cart" className="mt-4 inline-block text-sm text-primary underline underline-offset-4">Edit cart</Link>
      </aside>
    </div>
  );
}
