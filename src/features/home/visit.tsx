import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Section, SectionHeading } from "@/components/site/section";
import { getSite } from "@/lib/data";

export async function Visit() {
  const site = await getSite();
  if (!site) return null;
  return (
    <Section aria-labelledby="visit">
      <SectionHeading id="visit" eyebrow="Find us" title="Hours & location" href="/contact" hrefLabel="Contact details" />
      <Reveal className="grid gap-10 md:grid-cols-2">
        <Stagger as="dl" className="space-y-3 text-sm">
          {site.openingHours.map((h) => (
            <StaggerItem key={h.day} className="flex justify-between gap-6 border-b border-border pb-3">
              <dt>{h.day}</dt>
              <dd className="text-muted-foreground">{h.hours}</dd>
            </StaggerItem>
          ))}
        </Stagger>
        <div className="text-sm text-muted-foreground">
          {site.address && <p>{site.address}</p>}
          {site.phone && <p className="mt-2">{site.phone}</p>}
          <Link href="/menu" className="mt-6 inline-block text-primary underline underline-offset-4">
            Start an order
          </Link>
        </div>
      </Reveal>
    </Section>
  );
}
