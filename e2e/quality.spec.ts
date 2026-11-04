import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const PUBLIC_PAGES = ["/", "/menu", "/our-story", "/reviews", "/affiliations", "/contact", "/cart", "/checkout", "/track", "/order/not-a-real-token", "/admin/login", "/admin/forgot-password"];
const ADMIN_PAGES = ["/admin", "/admin/live", "/admin/menu", "/admin/reviews", "/admin/news", "/admin/pages", "/admin/settings", "/admin/media"];

/** Wait until the page has rendered its real content (not a loading skeleton). Not "network idle": the live board keeps a stream open. */
async function settle(page: Page) {
  await page.waitForLoadState("load");
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), undefined, { timeout: 15_000 });
  // Scroll through the page so every scroll-reveal has played, then let the animations finish:
  // measuring contrast on half-faded content would be meaningless.
  await page.evaluate(async () => {
    const step = Math.max(300, window.innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1300);
}

async function audit(page: Page, path: string) {
  await page.goto(path);
  await settle(page);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return results.violations.map((v) => ({ rule: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
}

test.describe("accessibility (WCAG 2.1 A/AA, automated)", () => {
  for (const path of PUBLIC_PAGES) {
    test(`public: ${path}`, async ({ page }) => {
      expect(await audit(page, path)).toEqual([]);
    });
  }
  test.describe("signed in", () => {
    test.use({ storageState: "e2e/.auth/owner.json" });
    for (const path of ADMIN_PAGES) {
      test(`admin: ${path}`, async ({ page }) => {
        expect(await audit(page, path)).toEqual([]);
      });
    }
  });
});

test.describe("responsive layout", () => {
  for (const path of [...PUBLIC_PAGES.filter((p) => !p.startsWith("/admin")), "/admin/login"]) {
    test(`no sideways scrolling: ${path}`, async ({ page }) => {
      await page.goto(path);
      await settle(page);
      const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth }));
      expect(scroll).toBeLessThanOrEqual(width + 1);
    });
  }
});

test.describe("layout stability", () => {
  for (const path of ["/", "/menu", "/our-story"]) {
    test(`cumulative layout shift is low: ${path}`, async ({ page }) => {
      await page.addInitScript(() => {
        const w = window as unknown as { __cls: number };
        w.__cls = 0;
        new PerformanceObserver((list) => {
          for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) w.__cls += e.value;
        }).observe({ type: "layout-shift", buffered: true });
      });
      await page.goto(path);
      await settle(page);
      await page.mouse.wheel(0, 2500); // scroll so lazy images and reveals load
      await page.waitForTimeout(800);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls).toBeLessThan(0.1); // "good" per Core Web Vitals
    });
  }
});

test.describe("page weight budget", () => {
  // Uncompressed JavaScript the browser downloads (a host/CDN compresses this to roughly a quarter).
  // React + Next's runtime alone are about 390 KB of it, and the animation library about 130 KB; the budget catches anything accidental on top.
  const BUDGET_KB: Record<string, number> = { "/": 800, "/menu": 800, "/checkout": 960 };
  for (const [path, kb] of Object.entries(BUDGET_KB)) {
    test(`JavaScript stays under ${kb} KB: ${path}`, async ({ page }) => {
      let bytes = 0;
      page.on("response", async (r) => {
        if (r.request().resourceType() === "script") bytes += (await r.body().catch(() => Buffer.alloc(0))).length;
      });
      await page.goto(path);
      await page.waitForLoadState("load");
      await page.waitForTimeout(1200);
      expect(Math.round(bytes / 1024)).toBeLessThan(kb);
    });
  }
});

test.describe("keyboard and motion", () => {
  test("skip link, visible focus, and the mobile menu work from the keyboard", async ({ page, isMobile }) => {
    await page.goto("/");
    await settle(page);
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible(); // revealed when focused
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);

    // every control we tab to must show where focus is
    await page.goto("/menu");
    await settle(page);
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const visible = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return true;
        const s = getComputedStyle(el);
        return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none" || el.matches(":focus-visible");
      });
      expect(visible).toBe(true);
    }

    if (isMobile) {
      await page.goto("/");
      const toggle = page.getByRole("button", { name: "Open menu" });
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("navigation", { name: "Mobile" })).toHaveCount(0);
    }
  });

  test("a dish can be added to the cart and adjusted using only the keyboard", async ({ page }) => {
    await page.goto("/menu");
    await settle(page);
    await page.getByRole("button", { name: "Add Mango Lassi to cart" }).focus();
    await page.keyboard.press("Enter");
    const plus = page.getByRole("button", { name: "Increase quantity of Mango Lassi" });
    await expect(plus).toBeVisible();
    await plus.focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("link", { name: "Cart, 2 items" }).first()).toBeVisible();
    await page.getByRole("button", { name: "Decrease quantity of Mango Lassi" }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("link", { name: "Cart, empty" }).first()).toBeVisible();
  });

  test("with reduced motion requested, content appears promptly and nothing slides", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/menu");
    await page.waitForLoadState("load");
    const heading = page.getByRole("heading", { name: "Vada Pav" });
    await heading.scrollIntoViewIfNeeded();
    // Reduced motion removes movement; a brief fade is still allowed, so allow it a moment to finish (movement is checked in motion.spec.ts)
    const lowestOpacity = () =>
      heading.evaluate((el) => {
        let node: HTMLElement | null = el as HTMLElement;
        let min = 1;
        while (node) {
          min = Math.min(min, parseFloat(getComputedStyle(node).opacity));
          node = node.parentElement;
        }
        return min;
      });
    await expect.poll(lowestOpacity, { timeout: 1500 }).toBe(1);
    await ctx.close();
  });
});

test.describe("web app hardening", () => {
  test("security headers are present, and private pages are never cached", async ({ request }) => {
    const home = await request.get("/");
    expect(home.headers()["x-content-type-options"]).toBe("nosniff");
    expect(home.headers()["x-frame-options"]).toBe("DENY");
    expect(home.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(home.headers()["permissions-policy"]).toContain("camera=()");
    expect((await request.get("/admin")).headers()["cache-control"]).toContain("no-store");
    expect((await request.get("/order/some-token")).headers()["cache-control"]).toContain("no-store");
    expect(home.headers()["x-powered-by"]).toBeUndefined();
  });

  test("the cache-refresh endpoint rejects everyone without the secret", async ({ request }) => {
    expect((await request.post("/api/revalidate")).status()).toBe(401);
    expect((await request.post("/api/revalidate", { headers: { "x-revalidate-secret": "wrong-secret-value-123" } })).status()).toBe(401);
    expect((await request.get("/api/revalidate")).status()).toBe(405);
    const env = readFileSync(".env.local", "utf8");
    const secret = /^REVALIDATE_SECRET=(.+)$/m.exec(env)?.[1];
    expect(secret).toBeTruthy();
    expect((await request.post("/api/revalidate", { headers: { "x-revalidate-secret": secret as string } })).status()).toBe(200);
  });
});
