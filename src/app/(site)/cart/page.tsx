import type { Metadata } from "next";
import { Suspense } from "react";
import { MenuOnlyNotice } from "@/components/site/menu-only-notice";
import { getSite } from "@/lib/data";
import { PageHeader } from "@/components/site/section";
import { CartView } from "@/features/cart/cart-view";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

async function Cart() {
  const site = await getSite();
  if (site && !site.cartEnabled) return <MenuOnlyNotice />;
  return <CartView />;
}

export default function CartPage() {
  return (
    <>
      <PageHeader title="Your cart" />
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <Suspense fallback={<div className="h-64 skeleton rounded-md" aria-hidden />}>
          <Cart />
        </Suspense>
      </div>
    </>
  );
}
