import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const OLD = "Old Order Check";

test.beforeAll(() => {
  // an order placed 45 days ago: older than "Last 30 days", so it only shows with "All time"
  execSync("npm run e2e:data -- seed-old-order", { cwd: "../backend", stdio: "pipe" });
});

test.describe("owner", () => {
  test.use({ storageState: "e2e/.auth/owner.json" });

  test("every previous order is visible by default, and narrowing the period hides older ones", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("button", { name: "All time" })).toHaveAttribute("aria-pressed", "true");

    await page.getByLabel("Search orders").fill(OLD);
    const row = page.getByRole("button", { name: new RegExp(OLD) });
    await expect(row).toBeVisible(); // 45 days old, still listed

    await page.getByRole("button", { name: "Last 30 days" }).click();
    await expect(page.getByText("No orders found")).toBeVisible();
    await page.getByRole("button", { name: "All time" }).click();
    await expect(row).toBeVisible();
  });

  test("Export to Excel downloads the orders matching the current filters, as a real workbook", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Search orders").fill(OLD);
    await expect(page.getByRole("button", { name: new RegExp(OLD) })).toBeVisible();
    await expect(page.getByText(/Exports all 1 order matching the period and filters above/)).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export to Excel" }).click()]);
    expect(download.suggestedFilename()).toMatch(/^shree-foods-orders-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const path = await download.path();

    // open the workbook and look inside (an .xlsx is a zip of XML files)
    const xml = execSync(`unzip -p "${path}"`, { maxBuffer: 20 * 1024 * 1024 }).toString("utf8");
    expect(xml).toContain(OLD); // the order is in the file...
    expect(xml).toContain("Vada Pav");
    expect(xml).toContain("Revenue (verified payments)");
    expect(xml).not.toContain("Yash Raj"); // ...and the search filter was honoured: other customers are not
    expect(xml).not.toMatch(/<f[ >]/); // no formulas
    await expect(page.getByRole("alert").filter({ hasText: /export|Excel/i })).toHaveCount(0);
  });

  test("a failed export shows a clear message instead of failing silently", async ({ page }) => {
    await page.route("**/api/v1/admin/orders/export*", (r) => r.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "That is 25000 orders, which is too many for one file. Choose a shorter date range." }) }));
    await page.goto("/admin");
    await expect(page.getByRole("button", { name: "Export to Excel" })).toBeEnabled();
    await page.getByRole("button", { name: "Export to Excel" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "too many for one file" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export to Excel" })).toBeEnabled(); // can try again
  });

  test("the button is disabled when there is nothing to export", async ({ page }) => {
    await page.goto("/admin");
    await page.getByLabel("Search orders").fill("zzz-no-such-customer-xyz");
    await expect(page.getByText("No orders found")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export to Excel" })).toBeDisabled();
  });
});

test.describe("staff", () => {
  test.use({ storageState: "e2e/.auth/staff.json" });

  test("cannot export: no button, and the API refuses", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("button", { name: "All time" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export to Excel" })).toHaveCount(0);
    const status = await page.evaluate(async () => (await fetch("/api/v1/admin/orders/export", { headers: { "X-Requested-With": "shree-admin" } })).status);
    expect(status).toBe(403);
  });
});
