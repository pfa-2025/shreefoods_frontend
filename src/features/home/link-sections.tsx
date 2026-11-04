import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Section, SectionHeading } from "@/components/site/section";
import { RatingSummary, ReviewCard } from "@/features/reviews/review-card";
import { getPage, getReviews, getSite } from "@/lib/data";
import { safeHref } from "@/lib/safe-href";

/** Shown only when there is something real to show: approved reviews from real orders and/or links to review sites. */
export async function ReviewsTeaser() {
  const [{ content }, data, site] = await Promise.all([getPage("reviews"), getReviews(), getSite()]);
  const links = content.links.filter((l) => safeHref(l.url));
  const latest = (data?.reviews ?? []).slice(0, 3);
  if (latest.length === 0 && links.length === 0) return null;

  return (
    <Section aria-labelledby="reviews-teaser">
      <SectionHeading id="reviews-teaser" eyebrow="Guests say" title="What guests say" href="/reviews" hrefLabel="All reviews" />
      {data && data.summary.count > 0 && data.summary.average !== null && (
        <div className="mb-8"><RatingSummary average={data.summary.average} count={data.summary.count} /></div>
      )}
      {latest.length > 0 && (
        <Stagger>
          <ul className="grid gap-5 md:grid-cols-3">
            {latest.map((r) => (
              <StaggerItem as="li" key={r.id}>
                <ReviewCard review={r} restaurantName={site?.restaurantName ?? "Shree Foods"} />
              </StaggerItem>
            ))}
          </ul>
        </Stagger>
      )}
      {links.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-4">
          {links.map((r) => (
            <li key={r.platform}>
              <a href={safeHref(r.url) as string} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                Read our reviews on {r.platform}
              </a>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/** Renders only when real affiliations exist. */
export async function AffiliationsTeaser() {
  const affiliations = (await getPage("affiliations")).content.items;
  if (affiliations.length === 0) return null;
  return (
    <Section aria-labelledby="affiliations-teaser">
      <SectionHeading id="affiliations-teaser" title="Proud to be part of" href="/affiliations" />
      <ul className="flex flex-wrap gap-x-10 gap-y-4 font-display text-2xl text-muted-foreground">
        {affiliations.map((a) => (
          <li key={a.name}>{safeHref(a.url) ? <a href={safeHref(a.url) as string} target="_blank" rel="noopener noreferrer">{a.name}</a> : a.name}</li>
        ))}
      </ul>
    </Section>
  );
}
