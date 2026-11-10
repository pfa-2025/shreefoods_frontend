import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { cacheLife } from "next/cache";
import { getSite } from "@/lib/data";
import { safeHref } from "@/lib/safe-href";

async function currentYear(): Promise<number> {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export async function Footer() {
  const site = await getSite();
  const year = await currentYear();

  return (
    <footer className="mt-24 border-t border-border bg-secondary/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-3">
        <Reveal>
          <Image src="/images/brand/logo.png" alt={site?.restaurantName ?? "Shree Foods"} width={1200} height={1132} className="h-24 w-auto" />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Maharashtrian and Gujarati home cooking, made fresh daily.
          </p>
        </Reveal>
        <Reveal delay={0.08} className="text-sm">
        <nav aria-label="Footer">
          <p className="mb-3 font-medium">Explore</p>
          <ul className="space-y-2 text-muted-foreground">
            {[
              ["/menu", "Menu"],
              ["/our-story", "Our Story"],
              ["/reviews", "Reviews"],
              ["/affiliations", "Affiliations"],
              ["/contact", "Contact"],
              ...(site?.cartEnabled === false ? [] : [["/track", "Track your order"]]),
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="hover:text-primary">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        </Reveal>
        <Reveal delay={0.16} className="text-sm">
          <p className="mb-3 font-medium">Visit</p>
          {site ? (
            <ul className="space-y-2 text-muted-foreground">
              {site.address && <li>{site.address}</li>}
              {site.phone && (
                <li>
                  <a href={`tel:${site.phone.replace(/[^\d+]/g, "")}`} className="hover:text-primary">
                    {site.phone}
                  </a>
                </li>
              )}
              {site.socialLinks.length > 0 && (
                <li className="flex flex-wrap gap-x-4 gap-y-1 pt-2">
                  {site.socialLinks.flatMap((s) => {
                    const href = safeHref(s.url);
                    return href ? [<a key={s.label} href={href} target="_blank" rel="noopener noreferrer" className="hover:text-primary">{s.label}</a>] : [];
                  })}
                </li>
              )}
            </ul>
          ) : (
            <p className="text-muted-foreground">Contact details are unavailable right now.</p>
          )}
        </Reveal>
      </div>
      <p className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {year} {site?.restaurantName ?? "Shree Foods"}. All rights reserved.
      </p>
    </footer>
  );
}
