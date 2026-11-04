import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

test.use({ storageState: "e2e/.auth/owner.json" });

const API = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";
const EMAIL = "e2e-live-ui@orders.example";

/** Count unmuted plays of the hooter, and optionally make the browser refuse audio. */
async function instrumentAudio(page: Page, opts: { block?: boolean } = {}) {
  await page.addInitScript((block) => {
    const w = window as unknown as { __plays: number };
    w.__plays = 0;
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      if (block) return Promise.reject(new DOMException("blocked", "NotAllowedError"));
      if (!this.muted && this.src.includes("hooter")) w.__plays += 1;
      return original.call(this);
    };
  }, opts.block ?? false);
}
const plays = (page: Page) => page.evaluate(() => (window as unknown as { __plays: number }).__plays);

/** A real customer places an order and reports payment. */
async function customerOrder(request: APIRequestContext, name: string) {
  const menu = await (await request.get(`${API}/menu`)).json();
  const created = await request.post(`${API}/orders`, {
    data: {
      customerName: name,
      customerEmail: EMAIL,
      customerPhone: "(555)010-2030",
      fulfillmentType: "PICKUP",
      idempotencyKey: crypto.randomUUID().replaceAll("-", ""),
      notes: "no onions",
      items: [{ menuItemId: menu.categories[0].items[0].id, quantity: 2 }],
    },
  });
  expect(created.status()).toBe(201);
  const { token } = await created.json();
  const reported = await request.post(`${API}/orders/${token}/report-payment`, { data: { reference: "UI-REF" } });
  expect(reported.status()).toBe(200);
  const view = await (await request.get(`${API}/orders/${token}`)).json();
  return { token, orderNumber: view.orderNumber as number };
}
const card = (page: Page, n: number) => page.getByTestId(`order-${n}`);
const live = (page: Page) => page.locator('[data-connection="live"]');

test("a new order appears without refreshing, sounds the hooter once, and flows through every status", async ({ page, request }) => {
  await instrumentAudio(page);
  await page.goto("/admin/live");
  await expect(live(page)).toBeVisible();

  await page.getByRole("button", { name: "Enable sound alerts" }).click();
  await expect(page.getByText("Sound alerts on")).toBeVisible();
  await expect.poll(() => plays(page)).toBe(1); // the confirmation beep
  const baseline = await plays(page);

  const o = await customerOrder(request, `Live UI ${Date.now()}`);
  await expect(card(page, o.orderNumber)).toBeVisible({ timeout: 8000 }); // no reload
  await expect(card(page, o.orderNumber)).toHaveAttribute("data-alert", "true");
  await expect(card(page, o.orderNumber).getByText("NEW")).toBeVisible();
  await expect.poll(() => plays(page)).toBe(baseline + 1); // sounded once
  await expect(page.getByText(/need(s)? your attention/)).toBeVisible();
  await page.screenshot({ path: "test-results/live-board.png", fullPage: true });

  // staff acknowledge: no longer prominent, and still no second sound
  await card(page, o.orderNumber).getByRole("button", { name: "Acknowledge" }).click();
  await expect(card(page, o.orderNumber)).toHaveAttribute("data-alert", "false");
  await page.waitForTimeout(500);
  expect(await plays(page)).toBe(baseline + 1);

  // payment, then each status through the buttons; the board follows without refreshing
  await card(page, o.orderNumber).getByRole("button", { name: "Payment received" }).click();
  await expect(card(page, o.orderNumber).getByText("Paid", { exact: true })).toBeVisible();
  await card(page, o.orderNumber).getByRole("button", { name: "Accept order" }).click();
  await page.getByRole("tab", { name: /^Accepted/ }).click();
  await card(page, o.orderNumber).getByRole("button", { name: "Start preparing" }).click();
  await page.getByRole("tab", { name: /^Preparing/ }).click();
  await card(page, o.orderNumber).getByRole("button", { name: "Mark ready" }).click();
  await page.getByRole("tab", { name: /^Ready/ }).click();
  await card(page, o.orderNumber).getByRole("button", { name: "Mark completed" }).click();
  await page.getByRole("tab", { name: /^Done/ }).click();
  await expect(card(page, o.orderNumber).getByText("Completed", { exact: true })).toBeVisible();
  expect(await plays(page)).toBe(baseline + 1); // status changes never replay the hooter

  // the customer's own page agrees
  const pub = await (await request.get(`${API}/orders/${o.token}`)).json();
  expect(pub).toMatchObject({ fulfillmentStatus: "COMPLETED", paymentStatus: "PAID" });
});

test("a refresh does not replay the hooter for an order that already alerted", async ({ page, request }) => {
  await instrumentAudio(page);
  await page.goto("/admin/live");
  await expect(live(page)).toBeVisible();
  await page.getByRole("button", { name: "Enable sound alerts" }).click();
  await expect.poll(() => plays(page)).toBe(1);

  const o = await customerOrder(request, `Refresh ${Date.now()}`);
  await expect(card(page, o.orderNumber)).toBeVisible({ timeout: 8000 });
  await expect.poll(() => plays(page)).toBe(2);

  await page.reload();
  await expect(live(page)).toBeVisible();
  await expect(card(page, o.orderNumber)).toHaveAttribute("data-alert", "true"); // still prominent: nobody has acted
  await page.mouse.click(5, 5); // satisfy the browser's one-click audio rule
  await page.waitForTimeout(1500);
  expect(await plays(page)).toBe(0); // fresh page, and no replay
});

test("muting silences new orders but they still show prominently", async ({ page, request }) => {
  await instrumentAudio(page);
  await page.goto("/admin/live");
  await expect(live(page)).toBeVisible();
  await page.getByRole("button", { name: "Enable sound alerts" }).click();
  await expect.poll(() => plays(page)).toBe(1);
  await page.getByRole("button", { name: "Mute" }).click();
  await expect(page.getByRole("button", { name: "Enable sound alerts" })).toBeVisible();

  const o = await customerOrder(request, `Muted ${Date.now()}`);
  await expect(card(page, o.orderNumber)).toHaveAttribute("data-alert", "true", { timeout: 8000 });
  await page.waitForTimeout(500);
  expect(await plays(page)).toBe(1);
});

test("if the browser blocks audio, staff see a visible warning", async ({ page }) => {
  await instrumentAudio(page, { block: true });
  await page.goto("/admin/live");
  await expect(live(page)).toBeVisible();
  await page.getByRole("button", { name: "Enable sound alerts" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "blocked the alert sound" })).toBeVisible();
});

/** Remember the page's live streams so a test can break them the way a network outage would. */
async function trackStreams(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __streams: EventSource[] };
    w.__streams = [];
    const Original = window.EventSource;
    window.EventSource = class extends Original {
      constructor(url: string | URL, init?: EventSourceInit) {
        super(url, init);
        w.__streams.push(this);
      }
    };
  });
}
const dropStreams = (page: Page) =>
  page.evaluate(() => {
    for (const s of (window as unknown as { __streams: EventSource[] }).__streams) {
      s.close();
      s.dispatchEvent(new Event("error")); // what the browser does when the connection dies
    }
  });
const STREAM = "**/api/v1/admin/live/stream";
const ALL_LIVE = "**/api/v1/admin/live/**";

test("while the live stream is down, the board says so and keeps itself fresh by polling, then recovers cleanly", async ({ page, request }) => {
  await instrumentAudio(page);
  await trackStreams(page);
  await page.goto("/admin/live");
  await expect(live(page)).toBeVisible();
  await page.getByRole("button", { name: "Enable sound alerts" }).click();
  await expect.poll(() => plays(page)).toBe(1);

  await page.route(STREAM, (r) => r.abort()); // the stream can't reconnect, the rest of the API still works
  await dropStreams(page);
  await expect(page.getByText(/Disconnected/)).toBeVisible();

  const o = await customerOrder(request, `Polled ${Date.now()}`);
  await expect(card(page, o.orderNumber)).toBeVisible({ timeout: 20_000 }); // found by the 10s polling fallback
  await expect.poll(() => plays(page)).toBe(2);

  await page.unroute(STREAM); // connectivity returns: exponential backoff reconnects by itself
  await expect(live(page)).toBeVisible({ timeout: 30_000 });
  await expect(card(page, o.orderNumber)).toHaveCount(1); // no duplicate card
  await page.waitForTimeout(1500);
  expect(await plays(page)).toBe(2); // reconnecting did not replay the alert
});

test("an order placed while the dashboard is completely offline is recovered and sounds exactly once", async ({ page, request }) => {
  await instrumentAudio(page);
  await trackStreams(page);
  await page.goto("/admin/live");
  await expect(live(page)).toBeVisible();
  await page.getByRole("button", { name: "Enable sound alerts" }).click();
  await expect.poll(() => plays(page)).toBe(1);

  await page.route(ALL_LIVE, (r) => r.abort()); // total outage: neither the stream nor the snapshot is reachable
  await dropStreams(page);
  await expect(page.getByText(/Disconnected/)).toBeVisible();

  const missed = await customerOrder(request, `Missed ${Date.now()}`);
  await page.waitForTimeout(1500);
  await expect(card(page, missed.orderNumber)).toHaveCount(0); // genuinely unaware of it
  expect(await plays(page)).toBe(1);

  await page.unroute(ALL_LIVE); // back online
  await expect(card(page, missed.orderNumber)).toBeVisible({ timeout: 30_000 });
  await expect(live(page)).toBeVisible({ timeout: 30_000 });
  await expect(card(page, missed.orderNumber)).toHaveCount(1);
  await expect.poll(() => plays(page)).toBe(2); // the missed order sounds
  await page.waitForTimeout(1500);
  expect(await plays(page)).toBe(2); // exactly once
});
