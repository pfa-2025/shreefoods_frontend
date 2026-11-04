import { expect, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/owner.json" });

const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";

test("staff can see the emails sent for an order, and the customer sees an honest, clear order page", async ({ page, request, browser }) => {
  // A customer orders and reports payment
  const menu = await (await request.get(`${API}/menu`)).json();
  const created = await request.post(`${API}/orders`, {
    data: {
      customerName: `Mail UI ${Date.now()}`,
      customerEmail: "e2e-email-ui@orders.example",
      customerPhone: "(555)010-2030",
      fulfillmentType: "PICKUP",
      idempotencyKey: crypto.randomUUID().replaceAll("-", ""),
      items: [{ menuItemId: menu.categories[0].items[0].id, quantity: 1 }],
    },
  });
  expect(created.status()).toBe(201);
  const { token } = await created.json();
  await request.post(`${API}/orders/${token}/report-payment`, { data: {} });
  const view = await (await request.get(`${API}/orders/${token}`)).json();
  const n = view.orderNumber as number;

  // Staff open the live board and look at this order's emails
  await page.goto("/admin/live");
  const card = page.getByTestId(`order-${n}`);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.getByRole("button", { name: "Email history" }).click();
  await expect(card.getByText("Order received")).toBeVisible();
  await expect(card.getByText("Logged (not sent)")).toBeVisible();
  await expect(card.getByText(/not actually sent/)).toBeVisible(); // development mode is spelled out, never passed off as delivery

  // Verify the payment: a "Payment confirmed" email is queued
  await card.getByRole("button", { name: "Payment received" }).click();
  await expect(card.getByText("Paid", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Hide email history" }).click();
  await card.getByRole("button", { name: "Email history" }).click();
  await expect(card.getByText("Payment confirmed")).toBeVisible();

  // Accept and mark ready (through the API with the owner's session, as the board's buttons do)
  await card.getByRole("button", { name: "Accept order" }).click();
  await page.getByRole("tab", { name: /^Accepted/ }).click();
  await page.getByTestId(`order-${n}`).getByRole("button", { name: "Start preparing" }).click();
  await page.getByRole("tab", { name: /^Preparing/ }).click();
  await page.getByTestId(`order-${n}`).getByRole("button", { name: "Mark ready" }).click();

  // The customer's page (own browser, no admin session) shows the ready banner
  const customer = await (await browser.newContext()).newPage();
  await customer.goto(`/order/${token}`);
  await expect(customer.getByText("Your order is ready for pickup!")).toBeVisible({ timeout: 20_000 });
  await expect(customer.getByText(`SF-${String(n).padStart(4, "0")}`).first()).toBeVisible();

  // Confirmation page in development: no false promise of an email
  await customer.goto(`/order/${token}/confirmation`);
  await expect(customer.getByText("Bookmark this page.")).toBeVisible();
  await expect(customer.getByText(/We’ve emailed you this link/)).toHaveCount(0);

  // Staff's email history now lists the ready email too
  await page.getByRole("tab", { name: /^Ready/ }).click();
  const readyCard = page.getByTestId(`order-${n}`);
  await readyCard.getByRole("button", { name: "Email history" }).click();
  await expect(readyCard.getByText("Order accepted")).toBeVisible();
  await expect(readyCard.getByText("Ready for pickup")).toBeVisible();
});
