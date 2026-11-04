import type { Metadata } from "next";
import { Suspense } from "react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { EmptyState, PageHeader } from "@/components/site/section";
import { RatingSummary, ReviewCard } from "@/features/reviews/review-card";
import { getPage, getReviews, getSite, seoMetadata } from "@/lib/data";
import { safeHref } from "@/lib/safe-href";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getPage("reviews");
  return seoMetadata(seo, { title: "Reviews", description: "What guests say about Shree Foods." });
}

async function Reviews() {
  const [{ content: raw }, data, site] = await Promise.all([getPage("reviews"), getReviews(), getSite()]);
  const links = raw.links.filter((l) => safeHref(l.url));
  const reviews = data?.reviews ?? [];
  const name = site?.restaurantName ?? "Shree Foods";

  return (
    <>
      <PageHeader title="Reviews" intro={raw.intro} />
      <div className="mx-auto max-w-6xl space-y-12 px-6 pt-8">
        {data && data.summary.count > 0 && data.summary.average !== null && <RatingSummary average={data.summary.average} count={data.summary.count} />}

        {reviews.length > 0 && (
          <Stagger>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <StaggerItem as="li" key={r.id}>
                  <ReviewCard review={r} restaurantName={name} />
                </StaggerItem>
              ))}
            </ul>
          </Stagger>
        )}

        {links.length > 0 && (
          <section aria-labelledby="elsewhere">
            <h2 id="elsewhere" className="mb-4 font-display text-3xl text-primary">Find us elsewhere</h2>
            <ul className="space-y-3">
              {links.map((r) => (
                <li key={r.platform}>
                  <a href={safeHref(r.url) as string} target="_blank" rel="noopener noreferrer" className="font-display text-2xl text-primary underline underline-offset-4">
                    Read our reviews on {r.platform}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {reviews.length === 0 && links.length === 0 && (
          <EmptyState title={data ? "No reviews yet" : "Reviews are unavailable right now"}>
            {data ? "After you order, you’ll be invited to review your meal. Approved reviews from real orders appear here." : "Please try again in a moment."}
          </EmptyState>
        )}
      </div>
    </>
  );
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={<PageHeader title="Reviews" />}>
      <Reviews />
    </Suspense>
  );
}
