import type { Metadata } from "next";
import { Suspense } from "react";
import { Featured } from "@/features/home/featured";
import { getSite } from "@/lib/data";
import { Hero } from "@/features/home/hero";
import { AffiliationsTeaser, ReviewsTeaser } from "@/features/home/link-sections";
import { StoryPreview } from "@/features/home/story-preview";
import { Visit } from "@/features/home/visit";
import { WhatsNew } from "@/features/home/whats-new";
import { getPage, seoMetadata } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const { seo } = await getPage("home");
  const m = seoMetadata(seo, { title: "Shree Foods · Maharashtrian & Gujarati Kitchen", description: "Fresh Maharashtrian and Gujarati dishes. Order online for pickup." });
  return { ...m, title: { absolute: String(m.title) } };
}

const skeleton = <div className="mx-auto h-72 max-w-6xl skeleton rounded-md" aria-hidden />;

async function HomeHero() {
  const [page, site] = await Promise.all([getPage("home"), getSite()]);
  return <Hero content={page.content} cartEnabled={site?.cartEnabled ?? true} />;
}

export default function Home() {
  return (
    <>
      <Suspense fallback={skeleton}>
        <HomeHero />
      </Suspense>
      <Suspense fallback={skeleton}>
        <WhatsNew />
      </Suspense>
      <Suspense fallback={skeleton}>
        <Featured />
      </Suspense>
      <Suspense fallback={skeleton}>
        <StoryPreview />
      </Suspense>
      <Suspense fallback={null}>
        <ReviewsTeaser />
      </Suspense>
      <Suspense fallback={null}>
        <AffiliationsTeaser />
      </Suspense>
      <Suspense fallback={skeleton}>
        <Visit />
      </Suspense>
    </>
  );
}
