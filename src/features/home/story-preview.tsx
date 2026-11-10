import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { Section } from "@/components/site/section";
import { getPage } from "@/lib/data";
import { siteImage } from "@/lib/site-images";

export async function StoryPreview() {
  const { content: story } = await getPage("story");
  return (
    <Section aria-labelledby="story-preview" className="grid items-center gap-10 md:grid-cols-2">
      <Reveal direction="left" distance={40} className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
        <Image src={siteImage.story} alt="Pav bhaji served with buttered pav" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
      </Reveal>
      <Reveal direction="right" distance={40} delay={0.1}>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-gold-text">Our story</p>
        <h2 id="story-preview" className="font-display text-4xl text-primary md:text-5xl">
          {story.headline}
        </h2>
        <p className="mt-5 max-w-md text-muted-foreground">{story.paragraphs[0]}</p>
        <Link href="/our-story" className="mt-6 inline-block text-primary underline underline-offset-4">
          Read our story
        </Link>
      </Reveal>
    </Section>
  );
}
