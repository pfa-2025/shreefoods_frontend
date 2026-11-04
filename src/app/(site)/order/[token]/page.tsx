import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/site/section";
import { OrderView } from "@/features/order/order-view";

// Link-based access: keep the token out of Referer headers and out of search results.
export const metadata: Metadata = { title: "Order status", robots: { index: false }, referrer: "no-referrer" };

async function Status({ params }: PageProps<"/order/[token]">) {
  const { token } = await params;
  return <OrderView token={token} mode="status" />;
}

export default function OrderStatusPage(props: PageProps<"/order/[token]">) {
  return (
    <>
      <PageHeader title="Order status" />
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <Suspense fallback={<div className="h-72 skeleton rounded-md" aria-hidden />}>
          <Status {...props} />
        </Suspense>
      </div>
    </>
  );
}
