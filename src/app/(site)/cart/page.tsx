import type { Metadata } from "next";
import { PageHeader } from "@/components/site/section";
import { CartView } from "@/features/cart/cart-view";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

export default function CartPage() {
  return (
    <>
      <PageHeader title="Your cart" />
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <CartView />
      </div>
    </>
  );
}
