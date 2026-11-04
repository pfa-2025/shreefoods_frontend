import type { Metadata } from "next";
import { Suspense } from "react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { ErrorState, PageHeader } from "@/components/site/section";
import { getPage, getSite, seoMetadata } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getPage("contact");
  return seoMetadata(seo, { title: "Contact", description: "Address, phone, email and opening hours." });
}

async function Header() {
  return <PageHeader title="Contact" intro={(await getPage("contact")).content.intro} />;
}

async function ContactDetails() {
  const site = await getSite();
  if (!site) return <ErrorState>Contact details couldn’t be loaded. Please try again shortly.</ErrorState>;
  const mapsUrl = site.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}` : null;

  return (
    <Stagger className="grid gap-12 md:grid-cols-2">
      <StaggerItem className="space-y-6 text-lg">
        {site.address && (
          <div>
            <h2 className="mb-1 font-display text-2xl text-primary">Address</h2>
            <p>{site.address}</p>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline underline-offset-4">
                Open in Google Maps
              </a>
            )}
          </div>
        )}
        {site.phone && (
          <div>
            <h2 className="mb-1 font-display text-2xl text-primary">Phone</h2>
            <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`}>{site.phone}</a>
          </div>
        )}
        {site.email && (
          <div>
            <h2 className="mb-1 font-display text-2xl text-primary">Email</h2>
            <a href={`mailto:${site.email}`}>{site.email}</a>
          </div>
        )}
      </StaggerItem>
      <StaggerItem>
        <h2 className="mb-3 font-display text-2xl text-primary">Opening hours</h2>
        <dl className="space-y-3 text-sm">
          {site.openingHours.map((h) => (
            <div key={h.day} className="flex justify-between gap-6 border-b border-border pb-3">
              <dt>{h.day}</dt>
              <dd className="text-muted-foreground">{h.hours}</dd>
            </div>
          ))}
        </dl>
      </StaggerItem>
    </Stagger>
  );
}

export default function ContactPage() {
  return (
    <>
      <Suspense fallback={<PageHeader title="Contact" />}>
        <Header />
      </Suspense>
      <div className="mx-auto max-w-6xl px-6 pt-8">
        <Suspense fallback={<div className="h-64 skeleton rounded-md" aria-hidden />}>
          <ContactDetails />
        </Suspense>
      </div>
    </>
  );
}
