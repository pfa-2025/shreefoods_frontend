import { expect, test } from "@playwright/test";

test("a customer gets a tracking link they can copy, open anywhere, and find again later", async ({ browser }) => {
  const customer = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await customer.newPage();

  // Place an order through the real checkout
  await page.goto("/menu");
  await page.getByRole("button", { name: "Add Mango Lassi to cart" }).click();
  await page.goto("/checkout");
  await page.getByLabel("Full name").fill("Track Tester");
  await page.getByLabel("Email").fill("e2e-track@orders.example");
  await page.getByLabel("Phone").fill("(555)010-2030");
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page).toHaveURL(/\/order\/[^/]+\/confirmation$/);

  // The tracking link is shown, and matches this order's private address
  const token = page.url().split("/order/")[1].split("/")[0];
  const card = page.getByRole("region", { name: "Track this order anytime" });
  await expect(card).toBeVisible();
  const shown = await card.getByLabel(/Tracking link for order/).inputValue();
  expect(shown).toBe(`${new URL(page.url()).origin}/order/${token}`);
  await page.screenshot({ path: "test-results/tracking-link.png", fullPage: true });

  // Copy puts exactly that address on the clipboard
  await card.getByRole("button", { name: "Copy link" }).click();
  await expect(card.getByText("Link copied.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown);

  // Someone with the link (a different browser, no cookies) sees the order, and no personal details
  const elsewhere = await (await browser.newContext()).newPage();
  await elsewhere.goto("/track");
  await expect(elsewhere.getByText("No orders found on this device")).toBeVisible();
  await elsewhere.goto(shown);
  await expect(elsewhere.getByRole("heading", { name: "Order status", level: 1 })).toBeVisible();
  await expect(elsewhere.getByText("Track this order anytime")).toBeVisible();
  await expect(elsewhere.getByText("Received")).toBeVisible();
  await expect(elsewhere.locator("body")).not.toContainText("Track Tester");
  await expect(elsewhere.locator("body")).not.toContainText("e2e-track@orders.example");

  // Opening a link adds the order to that device's list
  await elsewhere.goto("/track");
  await expect(elsewhere.getByRole("link", { name: /Track order SF-\d+/ })).toBeVisible();

  // The original device finds it too, and the link works
  await page.getByRole("link", { name: "Track Order" }).first().click();
  await expect(page).toHaveURL(/\/track$/);
  const mine = page.getByRole("link", { name: /Track order SF-\d+/ });
  await expect(mine).toHaveCount(1);
  await expect(page.locator("body")).not.toContainText("Track Tester"); // nothing personal is kept on the device
  await mine.click();
  await expect(page).toHaveURL(`/order/${token}`);

  // Only the order number, link and total are saved in the browser
  const saved = await page.evaluate(() => window.localStorage.getItem("shree-recent-orders-v1"));
  expect(saved).not.toMatch(/Track Tester|e2e-track|555/);

  // Clearing removes it from this device
  await page.goto("/track");
  await page.getByRole("button", { name: "Remove these from this device" }).click();
  await expect(page.getByText("No orders found on this device")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No orders found on this device")).toBeVisible();
});

test("a made-up tracking link shows a clear not-found message and is not remembered", async ({ page }) => {
  await page.goto("/order/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  await expect(page.getByText("We couldn’t find that order")).toBeVisible();
  await page.goto("/track");
  await expect(page.getByText("No orders found on this device")).toBeVisible();
});
