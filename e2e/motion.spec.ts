import { expect, test, type Locator, type Page } from "@playwright/test";

/** Lowest opacity of an element and its ancestors: 1 means it is fully visible. */
const effectiveOpacity = (l: Locator) =>
  l.evaluate((el) => {
    let node: HTMLElement | null = el as HTMLElement;
    let min = 1;
    while (node) {
      min = Math.min(min, parseFloat(getComputedStyle(node).opacity));
      node = node.parentElement;
    }
    return min;
  });

const featured = (p: Page) => p.getByRole("heading", { name: "Featured dishes" });

test.describe("motion", () => {
  test("scroll reveals: content below the fold waits, then appears as it is scrolled into view", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    expect(await effectiveOpacity(featured(page))).toBeLessThan(1); // not on screen yet, so not shown yet
    await featured(page).scrollIntoViewIfNeeded();
    await expect.poll(() => effectiveOpacity(featured(page)), { timeout: 4000 }).toBe(1);
  });

  test("if the scripts fail to start, scroll-reveal content is shown after a few seconds instead of staying invisible", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.route("**/_next/static/**/*.js", (r) => r.abort()); // the page arrives, but the app never starts
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset.hydrated)).toBeUndefined();
    await expect.poll(() => effectiveOpacity(featured(page)), { timeout: 9000 }).toBe(1); // the CSS safety net kicked in
    await ctx.close();
  });

  test("in normal use the safety net is switched off, so scroll reveals still wait for the scroll", async ({ page }) => {
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.hydrated)).toBe("true");
    await page.waitForTimeout(4800); // past the safety-net delay
    expect(await effectiveOpacity(featured(page))).toBeLessThan(1); // still waiting to be scrolled to
  });

  test("reduced motion: nothing slides or lingers, everything is in its final place at once", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await page.waitForLoadState("load");
    await page.waitForTimeout(150);

    // CSS entrances are collapsed to their end state
    expect(await effectiveOpacity(page.getByRole("heading", { level: 1 }))).toBe(1);
    const rising = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".rise, .page-in, .settle")].map((e) => getComputedStyle(e).transform));
    expect(rising.length).toBeGreaterThan(2);
    expect(rising.every((t) => t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)")).toBe(true);

    // scroll reveals do not slide: whatever has appeared sits at its final position
    await featured(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const slid = await featured(page).evaluate((el) => {
      let node: HTMLElement | null = el as HTMLElement;
      while (node) {
        const t = getComputedStyle(node).transform;
        if (t !== "none" && t !== "matrix(1, 0, 0, 1, 0, 0)") return t;
        node = node.parentElement;
      }
      return "none";
    });
    expect(slid === "none" || slid === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);

    // skeleton shimmer is not running forever
    const infinite = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity).length);
    expect(infinite).toBe(0);
    await ctx.close();
  });

  test("cart totals glide to their new value but are always valid money, and end exactly on the server's figure", async ({ page }) => {
    await page.goto("/menu");
    await page.getByRole("button", { name: "Add Mango Lassi to cart" }).click();
    await page.getByRole("button", { name: "Add Vada Pav to cart" }).click();
    await page.goto("/cart");
    const summary = page.getByRole("complementary", { name: "Order summary" });
    const total = summary.locator("dd").last();
    await expect(total).toHaveText("$14.07"); // (6.00 + 7.00) + 8.25% tax (1.0725, rounded to 1.07), from the server

    // sample the total every few ms while it moves to the new value
    await page.evaluate(() => {
      const w = window as unknown as { __seen: string[] };
      w.__seen = [];
      const el = [...document.querySelectorAll('aside[aria-label="Order summary"] dd')].at(-1) as HTMLElement;
      const id = setInterval(() => w.__seen.push(el.textContent ?? ""), 15);
      (window as unknown as { __stop: () => void }).__stop = () => clearInterval(id);
    });
    await page.getByRole("button", { name: "Increase quantity of Vada Pav" }).click();
    await expect(total).toHaveText("$21.65");
    await page.waitForTimeout(100);
    const seen: string[] = await page.evaluate(() => {
      (window as unknown as { __stop: () => void }).__stop();
      return (window as unknown as { __seen: string[] }).__seen;
    });
    expect(seen.length).toBeGreaterThan(5);
    for (const s of seen) expect(s).toMatch(/^\$\d+\.\d{2}$/); // never NaN, blank or a stray fraction
    const cents = seen.map((s) => Math.round(parseFloat(s.slice(1)) * 100));
    expect(Math.min(...cents)).toBeGreaterThanOrEqual(1407); // never dips below where it started
    expect(Math.max(...cents)).toBeLessThanOrEqual(2165); // never overshoots where it ends
    expect(seen.at(-1)).toBe("$21.65");
  });

  test("moving between pages gives each page a fresh fade-in, and the header gains a shadow once scrolled", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    const header = page.getByRole("banner");
    await expect(header).not.toHaveClass(/shadow-/);
    await page.mouse.wheel(0, 400);
    await expect(header).toHaveClass(/shadow-/);

    await page.evaluate(() => document.querySelector(".page-in")?.setAttribute("data-old", "1"));
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Our Story" }).click();
    await expect(page).toHaveURL(/\/our-story$/);
    // Next keeps the previous page (hidden) for quick back-navigation; the new page has its own fresh wrapper, so its fade replayed
    await expect(page.locator(".page-in:not([data-old])")).toHaveCount(1);
    await expect(page.locator(".page-in:not([data-old])")).toBeVisible();
    await expect(page.locator(".page-in[data-old]")).toBeHidden();
  });

  test("the add button becomes a quantity stepper and back, without leaving a stray copy behind", async ({ page }) => {
    await page.goto("/menu");
    await page.waitForLoadState("load");
    const add = page.getByRole("button", { name: "Add Mango Lassi to cart" });
    await add.click();
    await expect(page.getByRole("button", { name: "Decrease quantity of Mango Lassi" })).toBeVisible();
    await expect(add).toHaveCount(0);
    await page.getByRole("button", { name: "Decrease quantity of Mango Lassi" }).click();
    await expect(page.getByRole("button", { name: "Add Mango Lassi to cart" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Decrease quantity of Mango Lassi" })).toHaveCount(0);
  });
});
