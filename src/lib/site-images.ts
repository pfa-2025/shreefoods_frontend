/**
 * Pictures that are part of the page design (not the admin's image library). They are served from Cloudflare R2 when
 * R2_PUBLIC_URL is set at build time, and from the copies bundled in /public/images otherwise (local development).
 * File names carry a content hash, so replacing a picture means uploading a new name and updating it here.
 */
const R2 = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

export const siteImage = {
  hero: R2 ? `${R2}/site/hero-4d11237ca3.jpg` : "/images/hero.jpg",
  story: R2 ? `${R2}/site/story-2ad2a1d67f.jpg` : "/images/story.jpg",
};
