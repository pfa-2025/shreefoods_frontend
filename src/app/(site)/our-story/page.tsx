import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Reveal } from "@/components/motion/reveal";
import { PageHeader } from "@/components/site/section";
import { buttonVariants } from "@/components/ui/button";
import { getPage, seoMetadata } from "@/lib/data";
import { siteImage } from "@/lib/site-images";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getPage("story");
  return seoMetadata(seo, { title: "Our Story", description: "How Shree Foods brings Maharashtrian and Gujarati home cooking to your table." });
}

async function Story() {
  const { content } = await getPage("story");
  return (
    <>
      <PageHeader title={content.headline} />
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-6 pb-8 pt-6 md:grid-cols-2">
        <Reveal direction="left" distance={40} className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
          <Image src={content.imageUrl ?? siteImage.story} alt={content.imageUrl ? content.imageAlt : "Pav bhaji served with buttered pav"} fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
        </Reveal>
        <Reveal direction="right" distance={40} delay={0.1} className="space-y-5 text-lg leading-relaxed text-foreground/90">
          {content.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
          <Link href="/menu" className={cn(buttonVariants(), "h-11 px-6")}>
            See the menu
          </Link>
        </Reveal>
      </div>
    </>
  );
}

export default function OurStoryPage() {
  return (
    <Suspense fallback={<PageHeader title="Our Story" />}>
      <Story />
    </Suspense>
  );
}
