import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/site/section";
import { CheckoutForm } from "@/features/checkout/checkout-form";
import { getSite } from "@/lib/data";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

async function Checkout() {
  return <CheckoutForm site={await getSite()} />;
}

export default function CheckoutPage() {
  return (
    <>
      <PageHeader title="Checkout" />
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <Suspense fallback={<div className="h-64 skeleton rounded-md" aria-hidden />}>
          <Checkout />
        </Suspense>
      </div>
    </>
  );
}
