import { expect, test as setup } from "@playwright/test";

// Sign in once and reuse the session, so the suite stays under the login rate limit.
setup("sign in as the e2e owner", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("e2e-owner@admin.example");
  await page.getByLabel("Password").fill("e2e-owner-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.context().storageState({ path: "e2e/.auth/owner.json" });
});

setup("sign in as the e2e staff member", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill("e2e-staff@admin.example");
  await page.getByLabel("Password").fill("e2e-staff-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.context().storageState({ path: "e2e/.auth/staff.json" });
});
