import type { Metadata } from "next";
import { Suspense } from "react";
import { MenuOnlyNotice } from "@/components/site/menu-only-notice";
import { PageHeader } from "@/components/site/section";
import { RecentOrders } from "@/features/order/recent-orders";
import { getSite } from "@/lib/data";

// Personal to the visitor's device: keep it out of search results.
export const metadata: Metadata = { title: "Track your order", robots: { index: false } };

async function Track() {
  const site = await getSite();
  if (site && !site.cartEnabled) return <MenuOnlyNotice />; // menu-only mode: there are no orders to track
  return <RecentOrders />;
}

export default function TrackPage() {
  return (
    <>
      <PageHeader title="Track your order" intro="Orders you’ve placed or opened on this device." />
      <div className="mx-auto max-w-3xl px-6 pt-8 lg:ml-[max(1.5rem,calc((100vw-72rem)/2))]">
        <Suspense fallback={<div className="h-48 skeleton rounded-md" aria-hidden />}>
          <Track />
        </Suspense>
      </div>
    </>
  );
}
