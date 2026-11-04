import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { after } from "next/server";

/**
 * Called by the API after a CMS save so public pages show edits immediately.
 *
 * Invalidation happens twice: now, and again about 1.5s later in the background. Without the second pass, two
 * edits made within a second or two of each other (e.g. flipping a dish to "sold out" right after changing its
 * price) could leave the public page showing the first edit's data until the cache expired on its own: the
 * cache treats an invalidation that lands in the same moment as the previous refresh as already handled.
 */
export async function POST(request: Request) {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || expected.length < 16) return Response.json({ error: "Not configured" }, { status: 503 });

  const given = request.headers.get("x-revalidate-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  revalidateTag("content", { expire: 0 }); // next request waits for fresh data instead of serving stale
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    revalidateTag("content", { expire: 0 });
  });
  return Response.json({ ok: true });
}
