import type { MetadataRoute } from "next";
import { getPage } from "@/lib/data";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const pages = [["", "home"], ["/menu", "menu"], ["/our-story", "story"], ["/reviews", "reviews"], ["/affiliations", "affiliations"], ["/contact", "contact"]] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await Promise.all(pages.map(async ([path, key]) => ({ path, noIndex: (await getPage(key)).seo.noIndex })));
  return entries.filter((e) => !e.noIndex).map((e) => ({ url: `${base}${e.path}` }));
}
