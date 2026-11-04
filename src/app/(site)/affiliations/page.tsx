import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState, PageHeader } from "@/components/site/section";
import { getPage, seoMetadata } from "@/lib/data";
import { safeHref } from "@/lib/safe-href";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getPage("affiliations");
  return seoMetadata(seo, { title: "Affiliations", description: "Organisations and partners Shree Foods works with." });
}

async function Affiliations() {
  const { content } = await getPage("affiliations");
  return (
    <>
      <PageHeader title="Affiliations" intro={content.intro} />
      <div className="mx-auto max-w-6xl px-6 pt-8">
        {content.items.length === 0 ? (
          <EmptyState title="No affiliations listed yet">Our partners will be listed here.</EmptyState>
        ) : (
          <ul className="flex flex-wrap gap-x-12 gap-y-6 font-display text-3xl text-muted-foreground">
            {content.items.map((a) => (
              <li key={a.name}>
                {safeHref(a.url) ? (
                  <a href={safeHref(a.url) as string} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                    {a.name}
                  </a>
                ) : (
                  a.name
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export default function AffiliationsPage() {
  return (
    <Suspense fallback={<PageHeader title="Affiliations" />}>
      <Affiliations />
    </Suspense>
  );
}
