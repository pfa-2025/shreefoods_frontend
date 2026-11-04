import type { Metadata } from "next";
import { PageHeader } from "@/components/site/section";
import { RecentOrders } from "@/features/order/recent-orders";

// Personal to the visitor's device: keep it out of search results.
export const metadata: Metadata = { title: "Track your order", robots: { index: false } };

export default function TrackPage() {
  return (
    <>
      <PageHeader title="Track your order" intro="Orders you’ve placed or opened on this device." />
      <div className="mx-auto max-w-3xl px-6 pt-8 lg:ml-[max(1.5rem,calc((100vw-72rem)/2))]">
        <RecentOrders />
      </div>
    </>
  );
}
