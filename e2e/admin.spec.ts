import { expect, test, type Page } from "@playwright/test";

const OWNER = { email: "e2e-owner@admin.example", password: "e2e-owner-password-1" };
const STAFF = { email: "e2e-staff@admin.example", password: "e2e-staff-password-1" };
const CUSTOMER = "e2e-admin-view@orders.example";
const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";

async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("admin", () => {
  test("signed-out visitors are sent to the login page", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("the API refuses admin data without a session", async ({ request }) => {
    for (const path of ["/admin/dashboard", "/admin/orders", "/admin/auth/me"]) {
      expect((await request.get(`${API}${path}`)).status()).toBe(401);
    }
  });

  test("wrong password is rejected with a generic message", async ({ page }) => {
    await signIn(page, { email: OWNER.email, password: "totally-wrong-password" });
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("owner signs in, sees orders and revenue, survives refresh, and signs out", async ({ page, request }) => {
    // Seed one order through the public API, as a customer would (unique name: reruns don't collide)
    const name = `Admin View ${Date.now()}`;
    const menu = await (await request.get(`${API}/menu`)).json();
    const itemId = menu.categories[0].items[0].id as string;
    const created = await request.post(`${API}/orders`, {
      data: {
        customerName: name,
        customerEmail: CUSTOMER,
        customerPhone: "(555)010-2030",
        fulfillmentType: "PICKUP",
        idempotencyKey: crypto.randomUUID().replaceAll("-", ""),
        items: [{ menuItemId: itemId, quantity: 1 }],
      },
    });
    expect(created.status()).toBe(201);

    await signIn(page, OWNER);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Revenue (verified payments)")).toBeVisible();
    await expect(page.getByText("Awaiting acceptance").first()).toBeVisible();

    await page.getByLabel("Search orders").fill(name);
    const row = page.getByRole("button", { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await row.click();
    await expect(page.getByText(CUSTOMER)).toBeVisible();
    await expect(page.getByText("+15550102030")).toBeVisible();
    await page.screenshot({ path: "test-results/admin-dashboard.png", fullPage: true });

    await page.getByLabel("Search orders").fill("no-such-customer-xyz");
    await expect(page.getByText("No orders found")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Revenue (verified payments)")).toBeVisible(); // still signed in

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/login$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/); // session really ended
  });

  test("staff never receive revenue figures", async ({ page }) => {
    await signIn(page, STAFF);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Orders placed")).toBeVisible();
    await expect(page.getByText("Revenue (verified payments)")).toHaveCount(0);
  });

  test("forgot-password gives the same message for any email", async ({ page }) => {
    await page.goto("/admin/forgot-password");
    await page.getByLabel("Email").fill("nobody-at-all@example.com");
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If that email belongs to an admin account/)).toBeVisible();
  });

  test("reset page without a token explains the problem", async ({ page }) => {
    await page.goto("/admin/reset-password");
    await expect(page.getByText("This reset link is incomplete")).toBeVisible();
  });
});
