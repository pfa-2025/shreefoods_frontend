import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Parallax } from "@/components/motion/parallax";
import { buttonVariants } from "@/components/ui/button-variants";
import type { PageContent } from "@/lib/content";
import { cn } from "@/lib/utils";

const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

/** Entrance is CSS-only (staggered "rise"), so it plays immediately, before any JavaScript has loaded. */
export function Hero({ content }: { content: PageContent["home"] }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 md:py-20 lg:grid-cols-[1fr_1.15fr]">
      <div className="order-2 lg:order-1">
        <p className="rise mb-4 text-xs font-medium uppercase tracking-[0.2em] text-gold-text" style={delay(0)}>{content.heroEyebrow}</p>
        <h1 className="rise font-display text-5xl leading-[1.05] text-primary md:text-7xl" style={delay(0.05)}>
          {content.heroTitle}
        </h1>
        <p className="rise mt-6 max-w-md text-lg text-muted-foreground" style={delay(0.12)}>
          {content.heroText}
        </p>
        <div className="rise mt-8 flex flex-wrap gap-3" style={delay(0.18)}>
          <Link href="/menu" className={cn(buttonVariants(), "h-12 px-7 text-base")}>
            Order Now
          </Link>
          <Link href="/our-story" className={cn(buttonVariants({ variant: "outline" }), "h-12 px-7 text-base")}>
            Our Story
          </Link>
        </div>
      </div>
      <div className="fade-in relative order-1 aspect-[4/3] overflow-hidden rounded-md bg-muted lg:order-2 lg:aspect-[5/4]" style={delay(0)}>
        <Parallax className="absolute inset-0" distance={28}>
          <div className="settle relative size-full">
            <Image
              src="/images/hero.jpg"
              alt="A plate of misal pav with farsan, onion and lime"
              fill
              priority
              sizes="(min-width: 1024px) 55vw, 100vw"
              className="object-cover"
            />
          </div>
        </Parallax>
      </div>
    </section>
  );
}
