import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ storageState: "e2e/.auth/owner.json" });

type RGB = number[];
const COLORS = { red: [220, 30, 30], green: [30, 170, 30], blue: [30, 30, 220], yellow: [230, 210, 30] } as const;
type Name = keyof typeof COLORS;
const nearest = (c: RGB): Name => (Object.entries(COLORS) as [Name, readonly number[]][]).map(([n, v]) => [n, (v[0] - c[0]) ** 2 + (v[1] - c[1]) ** 2 + (v[2] - c[2]) ** 2] as const).sort((a, b) => a[1] - b[1])[0][0];

/** A picture whose four quadrants are red (top-left), green (top-right), blue (bottom-left), yellow (bottom-right). */
async function quadrants(page: Page, w: number, h: number, mime = "image/png"): Promise<Buffer> {
  const url = await page.evaluate(([w, h, mime]) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    const fill = (x: number, y: number, col: string) => { ctx.fillStyle = col; ctx.fillRect(x, y, w / 2, h / 2); };
    fill(0, 0, "rgb(220,30,30)"); fill(w / 2, 0, "rgb(30,170,30)"); fill(0, h / 2, "rgb(30,30,220)"); fill(w / 2, h / 2, "rgb(230,210,30)");
    return c.toDataURL(mime as string);
  }, [w, h, mime] as const);
  return Buffer.from(url.split(",")[1], "base64");
}

/** Random pixels: the worst case for compression (a very large, hard-to-shrink photo). */
async function noise(page: Page, w: number, h: number): Promise<Buffer> {
  const url = await page.evaluate(([w, h]) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(w, h);
    const buf = new Uint8Array(w * h * 4);
    for (let off = 0; off < buf.length; off += 65536) crypto.getRandomValues(buf.subarray(off, Math.min(off + 65536, buf.length)));
    for (let i = 3; i < buf.length; i += 4) buf[i] = 255;
    img.data.set(buf);
    ctx.putImageData(img, 0, 0);
    return c.toDataURL("image/png");
  }, [w, h] as const);
  return Buffer.from(url.split(",")[1], "base64");
}

/**
 * Load an uploaded picture and report its size and the colour at some points (given as fractions of width/height).
 * The bytes are fetched outside the page: images now live on another domain (Cloudflare R2), and a canvas that has
 * drawn a cross-origin image can't be read back.
 */
async function inspect(page: Page, src: string, points: [number, number][]) {
  const body = (await (await page.request.get(new URL(src, page.url()).toString())).body()).toString("base64");
  return page.evaluate(async ({ body, points }) => {
    const bin = Uint8Array.from(atob(body), (ch) => ch.charCodeAt(0));
    const img = await createImageBitmap(new Blob([bin]));
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return { width: img.width, height: img.height, colors: points.map(([fx, fy]) => Array.from(ctx.getImageData(Math.floor(fx * img.width), Math.floor(fy * img.height), 1, 1).data).slice(0, 3)) };
  }, { body, points });
}
// the middle of each quadrant of the output picture
const QUARTERS: [number, number][] = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
const names = (colors: RGB[]) => colors.map(nearest);

const dialog = (p: Page) => p.getByRole("dialog", { name: "Crop image" });
const result = (p: Page) => dialog(p).getByTestId("crop-result");
const setZoom = (d: Locator, v: number) => d.getByRole("slider", { name: "Zoom" }).fill(String(v));

async function openLibrary(page: Page) {
  await page.goto("/admin/media");
  await expect(page.getByRole("heading", { name: "Images", level: 1 })).toBeVisible();
}
/** Upload the currently cropped picture and return the stored picture's address. */
async function upload(page: Page, alt: string) {
  // the native dialog is still closing for a moment; anything typed before the preview shows is ignored
  await expect(page.getByTestId("crop-preview")).toBeVisible();
  await page.getByLabel("Description (alt text)").first().fill(alt);
  await page.getByRole("button", { name: "Upload image" }).click();
  await expect(page.getByText("Uploaded")).toBeVisible();
  const card = page.getByRole("listitem").filter({ has: page.locator(`input[value="${alt}"]`) });
  await expect(card).toBeVisible();
  return (await card.getByRole("img").getAttribute("src"))!;
}
const alt = (tag: string) => `E2E crop ${tag} ${Date.now()}`;

test.describe("image cropper", () => {
  test("a square crop keeps the centre of the picture, in the right place", async ({ page }) => {
    await openLibrary(page);
    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: await quadrants(page, 800, 600) });
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByRole("button", { name: "Square 1:1" }).click();
    await expect(result(page)).toContainText("600×600"); // the largest square that fits an 800×600 picture
    await page.screenshot({ path: "test-results/cropper.png" });
    await dialog(page).getByRole("button", { name: "Use this crop" }).click();
    await expect(page.getByTestId("crop-preview")).toContainText("600×600");

    const src = await upload(page, alt("square"));
    const out = await inspect(page, src, QUARTERS);
    expect([out.width, out.height]).toEqual([600, 600]);
    expect(names(out.colors)).toEqual(["red", "green", "blue", "yellow"]); // all four quadrants survived, none swapped
  });

  test("zooming in keeps only the middle: the four colours meet at the centre", async ({ page }) => {
    await openLibrary(page);
    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: await quadrants(page, 800, 600) });
    const d = dialog(page);
    await d.getByRole("button", { name: "Square 1:1" }).click();
    await setZoom(d, 2);
    await expect(result(page)).toContainText("300×300"); // half the width, and small crops are never enlarged
    await d.getByRole("button", { name: "Use this crop" }).click();
    const stored = await upload(page, alt("zoom"));
    const out = await inspect(page, stored, QUARTERS);
    expect([out.width, out.height]).toEqual([300, 300]);
    expect(names(out.colors)).toEqual(["red", "green", "blue", "yellow"]);
    // at the very corners of a centred 2x crop we are still inside each quadrant's own colour
    const corners = await inspect(page, stored, [[0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95]]);
    expect(names(corners.colors)).toEqual(["red", "green", "blue", "yellow"]);
  });

  test("rotating right turns the picture a quarter turn clockwise", async ({ page }) => {
    await openLibrary(page);
    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: await quadrants(page, 800, 600) });
    const d = dialog(page);
    await d.getByRole("button", { name: "Rotate right" }).click();
    await expect(result(page)).toContainText("600×800"); // "Original" shape follows the rotated picture
    await d.getByRole("button", { name: "Use this crop" }).click();
    const out = await inspect(page, await upload(page, alt("rotate")), QUARTERS);
    expect([out.width, out.height]).toEqual([600, 800]);
    // clockwise: old bottom-left (blue) is now top-left, old top-left (red) top-right, old top-right (green) bottom-right, old bottom-right (yellow) bottom-left
    expect(names(out.colors)).toEqual(["blue", "red", "yellow", "green"]);
  });

  test("rotating left is the opposite turn, and Reset puts everything back", async ({ page }) => {
    await openLibrary(page);
    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: await quadrants(page, 800, 600) });
    const d = dialog(page);
    await d.getByRole("button", { name: "Rotate left" }).click();
    await d.getByRole("button", { name: "Use this crop" }).click();
    const out = await inspect(page, await upload(page, alt("rotleft")), QUARTERS);
    expect([out.width, out.height]).toEqual([600, 800]);
    expect(names(out.colors)).toEqual(["green", "yellow", "red", "blue"]); // anticlockwise

    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: await quadrants(page, 800, 600) });
    await d.getByRole("button", { name: "Rotate right" }).click();
    await setZoom(d, 3);
    await d.getByRole("button", { name: "Reset" }).click();
    await expect(result(page)).toContainText("800×600");
    await d.getByRole("button", { name: "Cancel" }).click();
  });

  test("'Use original file' sends the picture untouched", async ({ page }) => {
    await openLibrary(page);
    const original = await quadrants(page, 800, 600);
    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: original });
    await dialog(page).getByRole("button", { name: /Use original file/ }).click();
    await expect(page.getByTestId("crop-preview")).toContainText("800×600");
    const src = await upload(page, alt("original"));
    const out = await inspect(page, src, QUARTERS);
    expect([out.width, out.height]).toEqual([800, 600]);
    const list = (await (await page.request.get("/api/v1/admin/media")).json()).assets as { url: string; bytes: number; mimeType: string }[];
    const stored = list.find((a) => a.url === src)!;
    expect(stored).toMatchObject({ bytes: original.length, mimeType: "image/png" }); // byte-for-byte what was chosen
  });

  test("cancelling (button or Escape) uploads nothing and leaves the form empty", async ({ page }) => {
    await openLibrary(page);
    const posts: string[] = [];
    page.on("request", (r) => r.method() === "POST" && r.url().includes("/admin/media") && posts.push(r.url()));
    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: await quadrants(page, 400, 300) });
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Upload image" })).toBeDisabled();
    await expect(page.getByTestId("crop-preview")).toHaveCount(0);

    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: await quadrants(page, 400, 300) });
    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Upload image" })).toBeDisabled();
    expect(posts).toEqual([]);
  });

  test("a big photo is shrunk before upload, and never enlarged", async ({ page }) => {
    await openLibrary(page);
    await page.getByLabel("Image file").setInputFiles({ name: "big.png", mimeType: "image/png", buffer: await quadrants(page, 4000, 3000) });
    await expect(result(page)).toContainText("2000×1500"); // longest side limited to 2000
    await dialog(page).getByRole("button", { name: "Use this crop" }).click();
    const out = await inspect(page, await upload(page, alt("big")), QUARTERS);
    expect([out.width, out.height]).toEqual([2000, 1500]);
    expect(names(out.colors)).toEqual(["red", "green", "blue", "yellow"]);
  });

  test("a photo far over the upload limit still uploads, after shrinking", async ({ page }) => {
    test.setTimeout(150_000);
    await openLibrary(page);
    const huge = await noise(page, 2400, 1800); // ~17 MB of random pixels: the toughest case
    expect(huge.length).toBeGreaterThan(5 * 1024 * 1024);
    await page.getByLabel("Image file").setInputFiles({ name: "huge.png", mimeType: "image/png", buffer: huge });
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: /Use original file/ })).toHaveCount(0); // over the limit, so cropping is required
    await dialog(page).getByRole("button", { name: "Use this crop" }).click();
    await expect(page.getByTestId("crop-preview")).toContainText("Ready to upload", { timeout: 60_000 });
    const text = (await page.getByTestId("crop-preview").textContent()) ?? "";
    const mb = /([\d.]+) MB/.exec(text);
    if (mb) expect(Number(mb[1])).toBeLessThanOrEqual(5);
    const src = await upload(page, alt("huge"));
    const stored = ((await (await page.request.get("/api/v1/admin/media")).json()).assets as { url: string; bytes: number }[]).find((a) => a.url === src)!;
    expect(stored.bytes).toBeLessThanOrEqual(5 * 1024 * 1024);
  });

  test("each place opens on the shape that suits it: dishes 4:3, news tall, payment QR square and lossless", async ({ page }) => {
    // menu item photo
    await page.goto("/admin/menu");
    await page.getByRole("listitem").filter({ hasText: "Vada Pav" }).first().getByRole("button", { name: "Edit" }).click();
    await page.getByRole("button", { name: /Change image|Choose image/ }).click();
    await page.locator("details summary", { hasText: "Upload a new image" }).click();
    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: await quadrants(page, 800, 800) });
    await expect(dialog(page).getByRole("button", { name: "4:3", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog(page)).toContainText("Dishes appear as 4:3");
    await expect(result(page)).toContainText("JPEG");
    await dialog(page).getByRole("button", { name: "Cancel" }).click();

    // payment QR
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: /Change image|Choose image/ }).click();
    await page.locator("details summary", { hasText: "Upload a new image" }).click();
    await page.getByLabel("Image file").setInputFiles({ name: "qr.png", mimeType: "image/png", buffer: await quadrants(page, 800, 600) });
    await expect(dialog(page).getByRole("button", { name: "Square 1:1" })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog(page)).toContainText("Keep the WHOLE QR code in the frame");
    await expect(result(page)).toContainText("PNG"); // sharp edges, so QR codes still scan
    await dialog(page).getByRole("button", { name: "Use this crop" }).click();
    const qrAlt = alt("qr");
    await expect(page.getByTestId("crop-preview")).toBeVisible(); // the dialog is still closing until the preview shows
    await page.getByLabel("Description (alt text)").last().fill(qrAlt);
    await page.getByRole("button", { name: "Upload image" }).click();
    await expect(page.getByRole("img", { name: qrAlt }).first()).toBeVisible();
    const assets = (await (await page.request.get("/api/v1/admin/media")).json()).assets as { altText: string; mimeType: string; url: string }[];
    expect(assets.find((a) => a.altText === qrAlt)).toMatchObject({ mimeType: "image/png" });
    const out = await inspect(page, assets.find((a) => a.altText === qrAlt)!.url, [[0.5, 0.5]]);
    expect(out.width).toBe(out.height); // square
  });

  test("replacing an existing image goes through the cropper too and keeps the image's identity", async ({ page }) => {
    await openLibrary(page);
    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: await quadrants(page, 400, 300) });
    await dialog(page).getByRole("button", { name: "Use this crop" }).click();
    const tag = alt("replace");
    const before = await upload(page, tag);
    const card = page.getByRole("listitem").filter({ has: page.locator(`input[value="${tag}"]`) });

    await card.getByLabel(/Replacement image for/).setInputFiles({ name: "new.png", mimeType: "image/png", buffer: await quadrants(page, 800, 600) });
    await dialog(page).getByRole("button", { name: "Square 1:1" }).click();
    await dialog(page).getByRole("button", { name: "Use this crop" }).click();
    await expect(page.getByText("Image replaced everywhere it’s used")).toBeVisible();
    await expect(async () => {
      const after = await card.getByRole("img").getAttribute("src");
      expect(after).not.toBe(before);
    }).toPass();
    const out = await inspect(page, (await card.getByRole("img").getAttribute("src"))!, QUARTERS);
    expect([out.width, out.height]).toEqual([600, 600]);
  });

  test("the crop window is accessible and keyboard friendly", async ({ page }) => {
    await openLibrary(page);
    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: await quadrants(page, 800, 600) });
    const d = dialog(page);
    await expect(d).toBeVisible();
    await expect(d.getByTestId("crop-result")).toBeVisible();
    await page.waitForTimeout(600);
    const violations = (await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations.map((v) => ({ rule: v.id, nodes: v.nodes.slice(0, 2).map((n) => n.target.join(" ")) }));
    expect(violations).toEqual([]);

    // Tab never reaches the page behind the window (the browser may hand focus to its own address bar, i.e. <body>)
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press("Tab");
      expect(await page.evaluate(() => { const a = document.activeElement; return a === document.body || !!a?.closest("dialog"); })).toBe(true);
    }
    // the zoom slider works from the keyboard
    const zoom = d.getByRole("slider", { name: "Zoom" });
    await zoom.focus();
    const start = Number(await zoom.inputValue());
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    expect(Number(await zoom.inputValue())).toBeGreaterThan(start);
    // aspect buttons say which one is chosen
    await expect(d.getByRole("button", { name: "Original", exact: true })).toHaveAttribute("aria-pressed", "true");
    await d.getByRole("button", { name: "Wide 16:9" }).click();
    await expect(d.getByRole("button", { name: "Wide 16:9" })).toHaveAttribute("aria-pressed", "true");
    await expect(d.getByRole("button", { name: "Original", exact: true })).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Escape");
    await expect(d).toHaveCount(0);
  });

  test("with the picture focused, the arrow keys move the crop", async ({ page }) => {
    await openLibrary(page);
    await page.getByLabel("Image file").setInputFiles({ name: "quad.png", mimeType: "image/png", buffer: await quadrants(page, 800, 600) });
    const d = dialog(page);
    await d.getByRole("button", { name: "Square 1:1" }).click();
    await setZoom(d, 2);
    // before moving: the top-left of the crop is red
    await d.getByTestId("crop-area").locator("[tabindex='0']").first().focus();
    for (let i = 0; i < 40; i++) await page.keyboard.press("ArrowLeft"); // drag the picture left, so the crop shifts right across it
    await d.getByRole("button", { name: "Use this crop" }).click();
    const out = await inspect(page, await upload(page, alt("keys")), [[0.1, 0.1], [0.9, 0.1]]);
    expect(names(out.colors)).not.toEqual(["red", "green"]); // it moved: the crop no longer sits on the centre
  });
});
