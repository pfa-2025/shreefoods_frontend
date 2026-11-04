import Image from "next/image";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { ErrorState, Section, SectionHeading } from "@/components/site/section";
import { getMenu } from "@/lib/data";
import { formatUsd } from "@/lib/format";

export async function Featured() {
  const categories = await getMenu();
  const items = categories?.flatMap((c) => c.items).filter((i) => i.isFeatured && i.isAvailable).slice(0, 4);

  return (
    <Section aria-labelledby="featured">
      <SectionHeading id="featured" eyebrow="Favourites" title="Featured dishes" href="/menu" hrefLabel="See the full menu" />
      {!items ? (
        <ErrorState>Featured dishes couldn’t be loaded right now.</ErrorState>
      ) : (
        <Stagger>
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <StaggerItem as="li" key={item.id} className="group">
              <div>
                <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                  {item.imageUrl && (
                    <Image src={item.imageUrl} alt={item.imageAlt} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                  )}
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl">{item.name}</h3>
                  <span className="text-sm tabular-nums">{formatUsd(item.priceCents)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
              </div>
            </StaggerItem>
          ))}
        </ul>
        </Stagger>
      )}
    </Section>
  );
}
