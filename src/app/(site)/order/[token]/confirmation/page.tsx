import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/site/section";
import { OrderView } from "@/features/order/order-view";

export const metadata: Metadata = { title: "Order confirmation", robots: { index: false }, referrer: "no-referrer" };

async function Confirmation({ params }: PageProps<"/order/[token]/confirmation">) {
  const { token } = await params;
  return <OrderView token={token} mode="confirmation" />;
}

export default function OrderConfirmationPage(props: PageProps<"/order/[token]/confirmation">) {
  return (
    <>
      <PageHeader title="Order confirmation" />
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <Suspense fallback={<div className="h-72 skeleton rounded-md" aria-hidden />}>
          <Confirmation {...props} />
        </Suspense>
      </div>
    </>
  );
}
