import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { after } from "next/server";

/**
 * Called by the API after a CMS save so public pages show edits immediately.
 *
 * Invalidation happens several times: now, and again 1.5s, 4s and 8s later in the background. The cache ignores an
 * invalidation that lands within a few seconds of the page's previous refresh, so two edits made close together
 * (e.g. flipping a dish to "sold out" right after changing its price) could otherwise leave the public page
 * showing the first edit's data until the cache expired on its own. Measured here: an invalidation about 2s after a
 * refresh is dropped, one about 4s after it is honoured, so the later passes catch whatever the early ones missed.
 */
const FOLLOW_UPS_MS = [1500, 4000, 8000];

export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || expected.length < 16) return Response.json({ error: "Not configured" }, { status: 503 });

  const given = request.headers.get("x-revalidate-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  revalidateTag("content", { expire: 0 }); // next request waits for fresh data instead of serving stale
  after(async () => {
    let waited = 0;
    for (const at of FOLLOW_UPS_MS) {
      await new Promise((resolve) => setTimeout(resolve, at - waited));
      waited = at;
      revalidateTag("content", { expire: 0 });
    }
  });
  return Response.json({ ok: true });
}
