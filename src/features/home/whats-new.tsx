import Image from "next/image";
import Link from "next/link";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Section, SectionHeading } from "@/components/site/section";
import { getAnnouncements } from "@/lib/data";
import { isExternal, safeHref } from "@/lib/safe-href";

export async function WhatsNew() {
  const items = await getAnnouncements();
  if (!items || items.length === 0) return null; // nothing published: hide the section

  return (
    <section aria-labelledby="whats-new" className="bg-secondary/60">
      <Section>
        <SectionHeading id="whats-new" eyebrow="Fresh from the kitchen" title="What’s New" />
        <Stagger>
          <ul
            tabIndex={0}
            aria-label="What’s new, scrollable"
            className="-mx-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-6 pb-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            {items.map((a) => (
              <StaggerItem as="li" key={a.id} className="group w-64 shrink-0 snap-start sm:w-72">
                <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
                  {a.imageUrl && (
                    <Image src={a.imageUrl} alt={a.imageAlt} fill sizes="288px" className="object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                  )}
                </div>
                <h3 className="mt-4 font-display text-2xl">{a.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                {safeHref(a.linkUrl) && (
                  <Link
                    href={safeHref(a.linkUrl) as string}
                    {...(isExternal(safeHref(a.linkUrl) as string) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Learn more
                  </Link>
                )}
              </StaggerItem>
            ))}
          </ul>
        </Stagger>
      </Section>
    </section>
  );
}
