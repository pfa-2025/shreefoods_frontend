/**
 * Built-in default copy for editable pages. The admin (Pages) overrides any field; when the API
 * has nothing saved, or is unreachable, the site shows these. Reviews and affiliations default
 * to empty on purpose: we never invent testimonials or partner logos.
 */
export interface PageContent {
  home: { heroEyebrow: string; heroTitle: string; heroText: string };
  menu: { intro: string };
  story: { headline: string; paragraphs: string[] };
  reviews: { intro: string; links: { platform: string; url: string }[] };
  contact: { intro: string };
  affiliations: { intro: string; items: { name: string; url: string | null }[] };
}
export type PageKey = keyof PageContent;

export const defaultContent: PageContent = {
  home: {
    heroEyebrow: "Maharashtra · Gujarat",
    heroTitle: "Home cooking, from two kitchens of India",
    heroText: "Misal pav, dhokla, puran poli and more, made fresh each day. Order online and pick up when it’s ready.",
  },
  menu: { intro: "Sample dishes with placeholder descriptions and prices. Add items to your cart to order for pickup." },
  story: {
    headline: "Cooked the way it is at home",
    paragraphs: [
      "Shree Foods began with a simple idea: the food of Maharashtra and Gujarat deserves a place at your table, made with patience and without shortcuts.",
      "Our spice blends are ground in small batches, our dhokla is steamed fresh each morning, and every pav is buttered to order. These are the dishes we grew up eating, served the way we remember them.",
    ],
  },
  reviews: { intro: "Every review here comes from a real order, and we read them all.", links: [] },
  contact: { intro: "Visit us, call ahead, or send an email." },
  affiliations: { intro: "Organisations and partners we’re proud to work with.", items: [] },
};
