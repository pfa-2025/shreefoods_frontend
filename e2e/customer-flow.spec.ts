import { expect, test } from "@playwright/test";

const EMAIL = "e2e-playwright@orders.example";

test("customer orders, reports payment, and tracks the order", async ({ page }) => {
  // Menu: filter by category and add items
  await page.goto("/menu");
  await expect(page.getByRole("heading", { name: "Menu", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Drinks", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mango Lassi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vada Pav" })).toHaveCount(0);
  await page.getByRole("button", { name: "All", exact: true }).click();

  await page.getByRole("button", { name: "Add Vada Pav to cart" }).click();
  await page.getByRole("button", { name: "Increase quantity of Vada Pav" }).click();
  await page.getByRole("button", { name: "Add Mango Lassi to cart" }).click();
  await expect(page.getByRole("link", { name: "Cart, 3 items" }).first()).toBeVisible();

  // Cart survives a refresh
  await page.reload();
  await expect(page.getByRole("link", { name: "Cart, 3 items" }).first()).toBeVisible();

  // Cart: server-priced totals ($7.00*2 + $6.00 = $20.00, tax 8.25% = $1.65)
  await page.goto("/cart");
  const summary = page.getByRole("complementary", { name: "Order summary" });
  await expect(summary.getByText("$20.00")).toBeVisible();
  await expect(summary.getByText("$1.65")).toBeVisible();
  await expect(summary.getByText("$21.65")).toBeVisible();
  await page.screenshot({ path: "test-results/cart.png", fullPage: true });

  // Checkout: validation, then a successful order
  await page.getByRole("link", { name: "Proceed to checkout" }).click();
  await page.getByRole("button", { name: /Place order/ }).click();
  await expect(page.getByText("Enter your full name")).toBeVisible();
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByText("Phone number is required for this order type")).toBeVisible();

  await page.getByLabel("Full name").fill("Playwright Tester");
  await page.getByLabel("Email").fill(EMAIL);
  await page.getByLabel("Phone").fill("(555)010-2030");
  await page.getByLabel(/Special instructions/).fill("Extra chutney please");
  await page.screenshot({ path: "test-results/checkout.png", fullPage: true });
  await page.getByRole("button", { name: /Place order · \$21\.65/ }).click();

  // Confirmation: payment instructions with the QR, cart emptied
  await expect(page).toHaveURL(/\/order\/[^/]+\/confirmation$/);
  await expect(page.getByText(/Your order SF-\d+ is placed/)).toBeVisible();
  await expect(page.getByRole("img", { name: /payment QR code/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cart, empty" }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/confirmation.png", fullPage: true });

  // The customer can only *report* payment; it is not marked paid
  await page.getByLabel(/Transaction reference/).fill("PP-E2E-1");
  await page.getByRole("button", { name: "I’ve paid" }).click();
  await expect(page.getByText("Confirming your payment")).toBeVisible();
  await expect(page.getByText("Payment confirmed")).toHaveCount(0);

  // Status page works from the same link, and customer details are not shown
  const token = page.url().split("/order/")[1].split("/")[0];
  await page.goto(`/order/${token}`);
  await expect(page.getByRole("heading", { name: "Order status", level: 1 })).toBeVisible();
  await expect(page.getByText("Confirming your payment")).toBeVisible();
  await expect(page.getByText("Received")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(EMAIL);
  await expect(page.locator("body")).not.toContainText("Playwright Tester");
});

test("unknown order link shows a not-found state", async ({ page }) => {
  await page.goto("/order/not-a-real-token");
  await expect(page.getByText("We couldn’t find that order")).toBeVisible();
});

test("empty cart checkout shows an empty state", async ({ page }) => {
  await page.goto("/checkout");
  await expect(page.getByText("Your cart is empty")).toBeVisible();
});
