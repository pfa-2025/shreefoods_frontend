import { cacheLife, cacheTag } from "next/cache";
import { API_URL } from "./env";
import { defaultContent, type PageContent, type PageKey } from "./content";
import type { MenuCategory } from "@/types/menu";
import type { ReviewsData } from "@/types/review";
import type { Announcement, SiteInfo } from "@/types/site";

export interface PageSeo {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
}

/**
 * Public content is cached briefly and tagged "content". The API pings /api/revalidate after
 * every CMS save, so edits appear at once; the short cache life is only the safety net.
 * Throwing on failure (instead of returning null here) keeps an outage from being cached.
 */
async function cachedGet<T>(path: string): Promise<T> {
  "use cache";
  cacheLife("minutes");
  cacheTag("content");
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(`API ${path} responded ${res.status}`);
  return (await res.json()) as T;
}

// Callers must sit inside <Suspense> (Cache Components). Each returns null on failure so pages can show an error state.
export const getSite = () => cachedGet<SiteInfo>("/site").catch(() => null);

export const getAnnouncements = () =>
  cachedGet<{ announcements: Announcement[] }>("/announcements")
    .then((r) => r.announcements)
    .catch(() => null);

export const getMenu = () =>
  cachedGet<{ categories: MenuCategory[] }>("/menu")
    .then((r) => r.categories)
    .catch(() => null);

/** Approved customer reviews and their average (null if the API is unreachable). */
export const getReviews = () => cachedGet<ReviewsData>("/reviews").catch(() => null);

/** Editable page copy + SEO. Falls back to built-in defaults if the API is down or nothing was saved. */
export async function getPage<K extends PageKey>(key: K): Promise<{ content: PageContent[K]; seo: PageSeo }> {
  const page = await cachedGet<{ content: Partial<PageContent[K]>; seo: PageSeo }>(`/pages/${key}`).catch(() => null);
  return {
    content: { ...defaultContent[key], ...(page?.content ?? {}) },
    seo: page?.seo ?? { title: null, description: null, imageUrl: null, canonicalUrl: null, noIndex: false },
  };
}

/** Turns saved SEO fields into Next metadata, leaving unset ones to the page's defaults. */
export function seoMetadata(seo: PageSeo, fallback: { title?: string; description?: string }) {
  const image = seo.imageUrl ?? undefined;
  return {
    title: seo.title ?? fallback.title,
    description: seo.description ?? fallback.description,
    alternates: seo.canonicalUrl ? { canonical: seo.canonicalUrl } : undefined,
    robots: seo.noIndex ? { index: false, follow: false } : undefined,
    openGraph: { title: seo.title ?? fallback.title, description: seo.description ?? fallback.description, images: image ? [image] : undefined },
  };
}
