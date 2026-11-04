/**
 * Defence in depth for links whose address comes from editable content. The API already refuses
 * anything else, but a link is only rendered if it is an on-site path or an http(s) address,
 * so a bad value (javascript:, data:, //evil) can never become a clickable link.
 */
export function safeHref(url: string | null | undefined): string | null {
  if (!url) return null;
  const v = url.trim();
  if (/^\/(?![/\\])[^\s]*$/.test(v)) return v;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export const isExternal = (href: string): boolean => /^https?:\/\//i.test(href);
