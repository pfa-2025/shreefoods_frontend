import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

test.use({ storageState: "e2e/.auth/owner.json" });

const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";
const csrf = { "X-Requested-With": "shree-admin" };

async function violations(page: Page) {
  await page.waitForTimeout(1300); // let entrance animations finish: contrast measured mid-fade means nothing
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.map((v) => ({ rule: v.id, nodes: v.nodes.slice(0, 2).map((n) => n.target.join(" ")) }));
}

test("customers can review a ready order; reviews stay private until the owner approves them", async ({ page, browser, request }) => {
  const unique = `Rev${Date.now()}`;
  const comment = `Lovely food ${unique} <b>not bold</b>`;

  // A customer places an order and reports payment
  const menu = await (await request.get(`${API}/menu`)).json();
  const created = await request.post(`${API}/orders`, {
    data: { customerName: "Review Tester", customerEmail: "e2e-reviews@orders.example", customerPhone: "(555)010-2030", fulfillmentType: "PICKUP", idempotencyKey: crypto.randomUUID().replaceAll("-", ""), items: [{ menuItemId: menu.categories[0].items[0].id, quantity: 1 }] },
  });
  const { token, orderNumber } = await created.json();
  await request.post(`${API}/orders/${token}/report-payment`, { data: {} });
  const snapshot = await (await page.request.get("/api/v1/admin/live/snapshot")).json();
  const id = (snapshot.orders as { id: string; orderNumber: number }[]).find((o) => o.orderNumber === orderNumber)!.id;
  const act = (path: string, data: object = {}) => page.request.post(`/api/v1/admin/orders/${id}/${path}`, { data, headers: csrf });
  await act("verify-payment");
  await act("status", { status: "ACCEPTED" });
  await act("status", { status: "PREPARING" });

  // While it's cooking: no form, just a friendly note
  const customer = await (await browser.newContext()).newPage();
  await customer.goto(`/order/${token}`);
  await expect(customer.getByText("You’ll be able to leave a review once your order is ready.")).toBeVisible();
  await expect(customer.getByRole("button", { name: "Send review" })).toHaveCount(0);

  // Ready: the form appears
  await act("status", { status: "READY" });
  await customer.goto(`/order/${token}`);
  await expect(customer.getByRole("heading", { name: "How was your order?" })).toBeVisible();
  expect(await violations(customer)).toEqual([]); // the form itself is accessible
  await customer.screenshot({ path: "test-results/review-form.png", fullPage: true });

  // Validation: a rating is required; contact details are refused in the shown name
  await customer.getByRole("button", { name: "Send review" }).click();
  await expect(customer.getByText("Please choose a star rating.")).toBeVisible();

  // The star picker works with the keyboard (arrow keys move between 1 and 5 stars)
  await customer.getByRole("radio", { name: /^1 star/ }).focus();
  await customer.keyboard.press("ArrowRight");
  await customer.keyboard.press("ArrowRight");
  await expect(customer.getByRole("radio", { name: /^3 stars/ })).toBeChecked();
  await customer.locator("label").filter({ has: customer.getByRole("radio", { name: /^5 stars/ }) }).click(); // click the star, as a person would
  await expect(customer.getByRole("radio", { name: /^5 stars/ })).toBeChecked();
  await expect(customer.getByText("Excellent")).toBeVisible();

  await customer.getByLabel(/Tell us more/).fill(comment);
  await customer.getByLabel(/Name shown with your review/).fill("me@example.com");
  await customer.getByRole("button", { name: "Send review" }).click();
  await expect(customer.getByText(/Use just your first name/)).toBeVisible();

  await customer.getByLabel(/Name shown with your review/).fill("Rae T.");
  await customer.getByRole("button", { name: "Send review" }).click();
  await expect(customer.getByRole("heading", { name: "Thanks for your review!" })).toBeVisible();
  await expect(customer.getByText("It will appear on our Reviews page once we’ve approved it.")).toBeVisible();
  await expect(customer.getByRole("button", { name: "Send review" })).toHaveCount(0); // one review per order
  await customer.reload();
  await expect(customer.getByRole("heading", { name: "Thanks for your review!" })).toBeVisible();

  // Private until approved
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/reviews");
  await expect(visitor.locator("body")).not.toContainText(unique);

  // The owner sees it waiting, with who wrote it
  await page.goto("/admin");
  await expect(page.getByText("Reviews to approve")).toBeVisible();
  await page.goto("/admin/reviews");
  const row = page.getByRole("listitem").filter({ hasText: unique });
  await expect(row).toBeVisible();
  await expect(row.getByText("Waiting for approval")).toBeVisible();
  await expect(row.getByText(/Review Tester/)).toBeVisible(); // the owner sees the real name; the public never does
  expect(await violations(page)).toEqual([]);

  // Approve with a public reply
  await row.getByLabel("Public reply (optional)").fill("Thank you, Rae! See you again soon.");
  await row.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Published. It is now on the website.")).toBeVisible();

  // Now it is on the public site, as plain text, with the reply and without personal details
  await expect(async () => {
    await visitor.goto("/reviews");
    await expect(visitor.locator("body")).toContainText(unique);
  }).toPass({ timeout: 15_000 });
  const card = visitor.getByRole("article").filter({ hasText: unique });
  await expect(card.getByRole("img", { name: "5 out of 5 stars" })).toBeVisible();
  await expect(card).toContainText("Rae T.");
  await expect(card).toContainText("Verified order");
  await expect(card).toContainText("<b>not bold</b>"); // shown literally, not interpreted as HTML
  await expect(card.locator("b")).toHaveCount(0);
  await expect(card).toContainText("Thank you, Rae! See you again soon.");
  await expect(visitor.locator("body")).not.toContainText("Review Tester");
  await expect(visitor.locator("body")).not.toContainText("e2e-reviews@orders.example");
  await expect(visitor.getByText(/from \d+ verified reviews?/)).toBeVisible();
  expect(await violations(visitor)).toEqual([]);
  await visitor.screenshot({ path: "test-results/reviews-page.png", fullPage: true });

  // The home page shows it too
  await visitor.goto("/");
  await expect(visitor.getByRole("heading", { name: "What guests say" })).toBeVisible();
  await expect(visitor.locator("body")).toContainText(unique);
  expect(await violations(visitor)).toEqual([]);

  // The customer sees it's live, with the reply
  await customer.reload();
  await expect(customer.getByText("Your review is shown on our Reviews page.")).toBeVisible();
  await expect(customer.getByText("Thank you, Rae! See you again soon.")).toBeVisible();

  // Hide it: gone from the public site; the customer isn't told it was hidden
  await page.goto("/admin/reviews");
  await page.getByRole("tab", { name: /^Published/ }).click();
  const published = page.getByRole("listitem").filter({ hasText: unique });
  await published.getByRole("button", { name: "Hide from website" }).click();
  await expect(page.getByText("Hidden from the website.")).toBeVisible();
  await expect(async () => {
    await visitor.goto("/reviews");
    await expect(visitor.locator("body")).not.toContainText(unique);
  }).toPass({ timeout: 15_000 });
  await customer.reload();
  await expect(customer.getByText("We’ve received it.")).toBeVisible();

  // Delete it for good
  await page.goto("/admin/reviews");
  await page.getByRole("tab", { name: /^Hidden/ }).click();
  const hidden = page.getByRole("listitem").filter({ hasText: unique });
  await hidden.getByRole("button", { name: "Delete" }).click();
  await hidden.getByRole("button", { name: "Confirm delete" }).click();
  await expect(page.getByText("Review deleted.")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: unique })).toHaveCount(0);
});

test("staff cannot moderate reviews", async ({ browser }) => {
  const staff = await (await browser.newContext({ storageState: "e2e/.auth/staff.json" })).newPage();
  await staff.goto("/admin/reviews");
  await expect(staff.getByRole("heading", { name: "Owner access only" })).toBeVisible();
  await expect(staff.getByRole("link", { name: "Reviews" })).toHaveCount(0);
});
