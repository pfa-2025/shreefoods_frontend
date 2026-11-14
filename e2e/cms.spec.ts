import { expect, test, type Page } from "@playwright/test";

// A real (64x64) PNG: a 1x1 image is a degenerate case for the image optimizer
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAeklEQVR4nO3PUQkAIBTAwJfJTIY1liH8OITBAtzm7PV1wwUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWNKAFDWhBA1rQgBY0oAUNaEEDWtCAFjSgBQ1oQQNa0IAWPHYBfpzhPARTZgUAAAAASUVORK5CYII=", "base64");
const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";

test.describe("owner CMS", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  /** Put the seeded Vada Pav back to $7.00 / available, whatever an earlier failure left behind. */
  async function resetVadaPav(page: Page) {
    const menu = await (await page.request.get(`${API}/menu`)).json();
    const id = (menu.categories as { items: { id: string; name: string }[] }[]).flatMap((c) => c.items).find((i) => i.name === "Vada Pav")!.id;
    const res = await page.request.patch(`/api/v1/admin/menu/items/${id}`, { data: { priceCents: 700, isAvailable: true, isArchived: false }, headers: { "X-Requested-With": "shree-admin" } });
    expect(res.status()).toBe(200);
  }
  test.beforeEach(async ({ page }) => resetVadaPav(page));
  test.afterEach(async ({ page }) => resetVadaPav(page));

  /** Poll the public site, which must reflect an admin save without any redeploy. */
  async function publicShows(page: Page, path: string, text: string | RegExp) {
    await expect(async () => {
      await page.goto(path);
      await expect(page.locator("body")).toContainText(text);
    }).toPass({ timeout: 15_000 });
  }

  test("a price and availability edit appears on the public menu straight away, then is restored", async ({ page, browser }) => {
    const visitor = await (await browser.newContext()).newPage();
    await page.goto("/admin/menu");
    await expect(page.getByRole("heading", { name: "Menu", level: 1 })).toBeVisible();

    const row = page.getByRole("listitem").filter({ hasText: "Vada Pav" }).first();
    try {
      await row.getByRole("button", { name: "Edit" }).click();
      await page.getByLabel("Price (USD)").fill("7.25");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Item saved")).toBeVisible();
      await publicShows(visitor, "/menu", "$7.25");

      await row.getByRole("button", { name: "Mark unavailable" }).click();
      await expect(row.getByText("Unavailable").first()).toBeVisible();
      await publicShows(visitor, "/menu", "Currently unavailable");
    } finally {
      // restore the seed values so other tests see the original menu
      await page.goto("/admin/menu");
      const r = page.getByRole("listitem").filter({ hasText: "Vada Pav" }).first();
      await expect(r.getByRole("button", { name: "Edit" })).toBeVisible(); // wait for the list to load before inspecting it
      if (await r.getByRole("button", { name: "Mark available" }).isVisible()) {
        await r.getByRole("button", { name: "Mark available" }).click();
        await expect(r.getByRole("button", { name: "Mark unavailable" })).toBeVisible();
      }
      await r.getByRole("button", { name: "Edit" }).click();
      await page.getByLabel("Price (USD)").fill("7.00");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Item saved")).toBeVisible();
    }
    // "$7.00" is also another dish's price, so check Vada Pav's own card, and wait for the refresh to land
    await expect(async () => {
      await visitor.goto("/menu");
      const card = visitor.getByRole("listitem").filter({ has: visitor.getByRole("heading", { name: "Vada Pav" }) });
      await expect(card).toContainText("$7.00");
      await expect(card).not.toContainText("Currently unavailable");
    }).toPass({ timeout: 15_000 });
  });

  test("saving one field never overwrites a change someone else made meanwhile", async ({ page, browser }) => {
    await page.goto("/admin/menu");
    const row = page.getByRole("listitem").filter({ hasText: "Vada Pav" }).first();
    await row.getByRole("button", { name: "Edit" }).click(); // owner opens the form while the dish is available...
    const staff = await (await browser.newContext({ storageState: "e2e/.auth/staff.json" })).newPage();
    try {
      await staff.goto("/admin/menu");
      const staffRow = staff.getByRole("listitem").filter({ hasText: "Vada Pav" }).first();
      await staffRow.getByRole("button", { name: "Mark unavailable" }).click(); // ...staff sell it out
      await expect(staffRow.getByRole("button", { name: "Mark available" })).toBeVisible();

      await page.getByLabel("Price (USD)").fill("7.10"); // owner saves only a price change
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Item saved")).toBeVisible();
      await expect(row.getByText("Unavailable").first()).toBeVisible(); // still sold out
    } finally {
      await page.goto("/admin/menu");
      const r = page.getByRole("listitem").filter({ hasText: "Vada Pav" }).first();
      await expect(r.getByRole("button", { name: "Edit" })).toBeVisible(); // wait for the list to load before inspecting it
      if (await r.getByRole("button", { name: "Mark available" }).isVisible()) {
        await r.getByRole("button", { name: "Mark available" }).click();
        await expect(r.getByRole("button", { name: "Mark unavailable" })).toBeVisible();
      }
      await r.getByRole("button", { name: "Edit" }).click();
      await page.getByLabel("Price (USD)").fill("7.00");
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Item saved")).toBeVisible();
    }
  });

  test("price input rejects invalid amounts before anything is sent", async ({ page }) => {
    await page.goto("/admin/menu");
    const row = page.getByRole("listitem").filter({ hasText: "Vada Pav" }).first();
    await row.getByRole("button", { name: "Edit" }).click();
    const price = page.getByLabel("Price (USD)");
    for (const bad of ["abc", "-5", "1.234", "0"]) {
      await price.fill(bad);
      await expect(page.getByRole("button", { name: "Save changes" })).toBeDisabled();
    }
    await expect(page.getByText(/Enter a price like|Price must be above/)).toBeVisible();
  });

  test("uploading validates the file, and a new image can be edited and deleted", async ({ page }) => {
    await page.goto("/admin/media");
    await expect(page.getByRole("heading", { name: "Images", level: 1 })).toBeVisible();

    // wrong type is stopped in the browser with a clear message (no crop window, nothing to upload)
    await page.getByLabel("Image file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
    await expect(page.getByText("Choose a JPEG, PNG or WebP image.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload image" })).toBeDisabled();

    // a text file pretending to be a PNG gets past the type check, but the crop window can't open it as a picture
    // (and the server independently refuses such files, which is tested in the API tests)
    await page.getByLabel("Image file").setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("definitely not an image") });
    const dialog = page.getByRole("dialog", { name: "Crop image" });
    await expect(dialog.getByRole("alert")).toContainText("couldn’t be opened as a picture");
    await expect(dialog.getByRole("button", { name: "Use this crop" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Upload image" })).toBeDisabled();

    // a real image: crop it, describe it, upload it
    const alt = `E2E upload ${Date.now()}`;
    await page.getByLabel("Image file").setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("dialog", { name: "Crop image" }).getByRole("button", { name: "Use this crop" }).click();
    await expect(page.getByTestId("crop-preview")).toContainText("Ready to upload");
    await page.getByLabel("Description (alt text)").first().fill(alt);
    await page.getByRole("button", { name: "Upload image" }).click();
    await expect(page.getByText("Uploaded")).toBeVisible();
    const card = page.getByRole("listitem").filter({ has: page.locator(`input[value="${alt}"]`) });
    await expect(card).toBeVisible();
    await expect(card.getByText("Not used anywhere")).toBeVisible();

    const img = card.getByRole("img");
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0); // the stored file really loads (it may come from remote storage)

    await card.getByRole("button", { name: "Delete" }).click();
    await card.getByRole("button", { name: "Confirm delete" }).click();
    await expect(page.locator(`input[value="${alt}"]`)).toHaveCount(0);
  });

  test("the payment QR can't be deleted while in use", async ({ page }) => {
    await page.goto("/admin/media");
    await expect(page.getByText("Used by the payment QR").or(page.getByText(/payment QR/).first())).toBeVisible();
    const qrCard = page.getByRole("listitem").filter({ hasText: "payment QR" }).first();
    await expect(qrCard.getByText("Can’t delete while in use")).toBeVisible();
  });

  test("an announcement can be created with an image, published, and unpublished; the home page follows", async ({ page, browser }) => {
    const visitor = await (await browser.newContext()).newPage();
    const title = `E2E Special ${Date.now()}`;
    await page.goto("/admin/news");
    await page.getByRole("button", { name: "New announcement" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Short description").fill("Fresh batch today");
    await page.getByRole("button", { name: "Choose image" }).click();
    await page.locator("details summary", { hasText: "Upload a new image" }).click();
    await page.getByLabel("Image file").setInputFiles({ name: "special.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("dialog", { name: "Crop image" }).getByRole("button", { name: "Use this crop" }).click(); // news cards are tall, so this opens on 4:5
    await expect(page.getByTestId("crop-preview")).toBeVisible();
    await page.getByLabel("Description (alt text)").last().fill("E2E special image");
    await page.getByRole("button", { name: "Upload image" }).click();
    await expect(page.getByRole("img", { name: "E2E special image" }).first()).toBeVisible();

    // draft: not public yet
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(title)).toBeVisible();
    await visitor.goto("/");
    await expect(visitor.locator("body")).not.toContainText(title);

    // publish
    const item = page.getByRole("listitem").filter({ hasText: title });
    await item.getByRole("button", { name: "Edit" }).click();
    await item.getByLabel("Status").selectOption("PUBLISHED");
    await item.getByRole("button", { name: "Save", exact: true }).click();
    await publicShows(visitor, "/", title);
    const publicImg = visitor.getByRole("img", { name: "E2E special image" });
    await publicImg.scrollIntoViewIfNeeded(); // images are lazy-loaded, so bring it into view
    await expect(publicImg).toBeVisible();
    await expect.poll(() => publicImg.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

    // unpublish
    await item.getByRole("button", { name: "Edit" }).click();
    await item.getByLabel("Status").selectOption("ARCHIVED");
    await item.getByRole("button", { name: "Save", exact: true }).click();
    await expect(async () => {
      await visitor.goto("/");
      await expect(visitor.locator("body")).not.toContainText(title);
    }).toPass({ timeout: 15_000 });

    // An archived announcement still references its image, so the library refuses to delete it...
    await page.goto("/admin/media");
    await expect(page.getByRole("listitem").filter({ has: page.locator('input[value="E2E special image"]') }).first().getByText("Can’t delete while in use")).toBeVisible();
    // ...until the image is detached from the announcement
    await page.goto("/admin/news");
    const archived = page.getByRole("listitem").filter({ hasText: title });
    await archived.getByRole("button", { name: "Edit" }).click();
    await archived.getByRole("button", { name: "Remove" }).click();
    await archived.getByRole("button", { name: "Save", exact: true }).click();
    await expect(archived.getByText("No image")).toBeVisible();
    await page.goto("/admin/media");
    const cards = page.getByRole("listitem").filter({ has: page.locator('input[value="E2E special image"]') });
    await expect(cards.first()).toBeVisible();
    while ((await cards.count()) > 0) {
      const before = await cards.count();
      await cards.first().getByRole("button", { name: "Delete" }).click();
      await cards.first().getByRole("button", { name: "Confirm delete" }).click();
      await expect(cards).toHaveCount(before - 1);
    }
  });

  test("page text and SEO changes show on the public page, including noindex and the sitemap, then are reverted", async ({ page, browser }) => {
    const visitor = await (await browser.newContext()).newPage();
    await page.goto("/admin/pages");
    await page.getByRole("tab", { name: "Our Story" }).click();
    const headline = `E2E headline ${Date.now()}`;
    try {
      await page.getByLabel("Headline").fill(headline);
      await page.getByLabel("Page title").fill("E2E SEO title");
      await page.getByLabel("Description", { exact: true }).fill("E2E SEO description");
      await page.getByLabel("Hide this page from search engines").check();
      await page.getByRole("button", { name: "Save Our Story page" }).click();
      await expect(page.getByText(/Saved\./)).toBeVisible();

      await publicShows(visitor, "/our-story", headline);
      await expect(visitor).toHaveTitle(/E2E SEO title/);
      await expect(visitor.locator('meta[name="description"]')).toHaveAttribute("content", "E2E SEO description");
      await expect(visitor.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      const sitemap = await (await visitor.request.get("/sitemap.xml")).text();
      expect(sitemap).not.toContain("/our-story"); // noindex pages are left out
    } finally {
      await page.goto("/admin/pages");
      await page.getByRole("tab", { name: "Our Story" }).click();
      await page.getByLabel("Headline").fill("Cooked the way it is at home");
      await page.getByLabel("Page title").fill("");
      await page.getByLabel("Description", { exact: true }).fill("");
      await page.getByLabel("Hide this page from search engines").uncheck();
      await page.getByRole("button", { name: "Save Our Story page" }).click();
      await expect(page.getByText(/Saved\./)).toBeVisible();
    }
    await publicShows(visitor, "/our-story", "Cooked the way it is at home");
    expect(await (await visitor.request.get("/sitemap.xml")).text()).toContain("/our-story");
  });

  test("server-side SEO validation errors show next to the field", async ({ page }) => {
    await page.goto("/admin/pages");
    await page.getByRole("tab", { name: "Menu" }).click();
    await page.getByLabel("Canonical address (advanced)").fill("javascript:alert(1)");
    await page.getByRole("button", { name: "Save Menu page" }).click();
    await expect(page.getByText("Please fix the highlighted fields.")).toBeVisible();
    await expect(page.getByText("Enter a full web address starting with https://")).toBeVisible();
  });

  test("the Our Story picture can be changed in the admin, shows on the site, and can be reset", async ({ page, browser }) => {
    const visitor = await (await browser.newContext()).newPage();
    const alt = `E2E story picture ${Date.now()}`;
    const save = async () => {
      await page.getByRole("button", { name: "Save Our Story page" }).click();
      await expect(page.getByText(/Saved\./)).toBeVisible();
    };
    const openStory = async () => {
      await page.goto("/admin/pages");
      await page.getByRole("tab", { name: "Our Story" }).click();
    };
    try {
      await openStory();
      await page.getByRole("button", { name: "Choose image" }).first().click();
      await page.locator("details summary", { hasText: "Upload a new image" }).click();
      await page.getByLabel("Image file").setInputFiles({ name: "story.png", mimeType: "image/png", buffer: PNG });
      await page.getByRole("dialog", { name: "Crop image" }).getByRole("button", { name: "Use this crop" }).click();
      await expect(page.getByTestId("crop-preview")).toBeVisible();
      await page.getByLabel("Description (alt text)").last().fill(alt);
      await page.getByRole("button", { name: "Upload image" }).click();
      await expect(page.getByRole("img", { name: alt }).first()).toBeVisible();
      await save();

      for (const path of ["/our-story", "/"]) {
        await publicShows(visitor, path, "Cooked the way it is at home");
        await expect(async () => {
          await visitor.goto(path);
          await expect(visitor.getByRole("img", { name: alt })).toBeVisible();
        }).toPass({ timeout: 15_000 });
      }
      const img = visitor.getByRole("img", { name: alt });
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    } finally {
      // back to the picture that ships with the website
      await openStory();
      const remove = page.getByRole("button", { name: "Remove" }).first();
      if (await remove.isVisible()) {
        await remove.click();
        await save();
      }
    }
    await expect(async () => {
      await visitor.goto("/our-story");
      await expect(visitor.getByRole("img", { name: alt })).toHaveCount(0);
      await expect(visitor.getByRole("img", { name: "Pav bhaji served with buttered pav" })).toBeVisible();
    }).toPass({ timeout: 15_000 });
  });

  test("menu-only switch hides Add to cart and the cart, and brings them back", async ({ page }) => {
    const setCart = async (on: boolean) => {
      await page.goto("/admin/settings");
      await page.getByLabel("Show Add to cart and cart").setChecked(on);
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible();
    };
    try {
      await setCart(false);
      await expect(async () => {
        await page.goto("/menu");
        await expect(page.getByRole("heading", { name: "Vada Pav" })).toBeVisible();
        await expect(page.getByRole("button", { name: /^Add .* to cart$/ })).toHaveCount(0);
        await expect(page.getByRole("link", { name: /^Cart/ })).toHaveCount(0);
        await expect(page.getByRole("link", { name: "Order Now" })).toHaveCount(0);
        await expect(page.getByRole("link", { name: /^Track (Order|your order)$/ })).toHaveCount(0); // header and footer
      }).toPass({ timeout: 15_000 });
      await page.goto("/cart");
      await expect(page.getByText("Online ordering isn’t available right now.")).toBeVisible();
      await page.goto("/track");
      await expect(page.getByText("Online ordering isn’t available right now.")).toBeVisible();
      await expect(page.getByText("No orders found on this device")).toHaveCount(0);
    } finally {
      await setCart(true);
    }
    await expect(async () => {
      await page.goto("/menu");
      await expect(page.getByRole("button", { name: /^Add .* to cart$/ }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /^Cart/ }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: "Track Order" }).first()).toBeVisible();
    }).toPass({ timeout: 15_000 });
  });

  test("settings: phone appears in the footer, tax drives checkout totals, and bad tax is refused; then reverted", async ({ page, browser, request }) => {
    const visitor = await (await browser.newContext()).newPage();
    await page.goto("/admin/settings");
    const phone = page.getByLabel("Phone");
    const original = await phone.inputValue();
    const taxOriginal = await page.getByLabel("Sales tax rate (%)").inputValue();
    try {
      await phone.fill("(555) 777-0000");
      await page.getByLabel("Sales tax rate (%)").fill("10");
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible();
      await publicShows(visitor, "/contact", "(555) 777-0000");
      const menu = await (await request.get(`${API}/menu`)).json();
      const quote = await (await request.post(`${API}/cart/quote`, { data: { items: [{ menuItemId: menu.categories[0].items[0].id, quantity: 1 }] } })).json();
      expect(quote.taxRateBps).toBe(1000);

      await page.getByLabel("Sales tax rate (%)").fill("8.255");
      await expect(page.getByText("Enter a percentage like 8.25")).toBeVisible();
      await expect(page.getByRole("button", { name: "Save settings" })).toBeDisabled();
    } finally {
      await page.goto("/admin/settings");
      await page.getByLabel("Phone").fill(original);
      await page.getByLabel("Sales tax rate (%)").fill(taxOriginal);
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Settings saved")).toBeVisible();
    }
  });
});

test.describe("staff", () => {
  test.use({ storageState: "e2e/.auth/staff.json" });

  test("can mark dishes unavailable but sees no editing controls, and owner pages are blocked", async ({ page }) => {
    await page.goto("/admin/menu");
    await expect(page.getByText("You can mark dishes available or unavailable")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark unavailable" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add section" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Images" })).toHaveCount(0);

    for (const path of ["/admin/settings", "/admin/pages", "/admin/news", "/admin/media"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Owner access only" })).toBeVisible();
    }
  });

  test("the API itself refuses staff owner-only writes", async ({ page }) => {
    await page.goto("/admin/menu"); // establishes the same-origin session
    const res = await page.evaluate(async () => {
      const r = await fetch("/api/v1/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json", "X-Requested-With": "shree-admin" }, body: JSON.stringify({ taxRateBps: 0 }) });
      return r.status;
    });
    expect(res).toBe(403);
  });
});
