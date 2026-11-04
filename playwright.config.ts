import { defineConfig, devices } from "@playwright/test";

// Expects the API (:4000, seeded) and the web app (:3000) to already be running, and the
// throwaway admin accounts to exist:  (cd ../backend && npm run e2e:data -- prepare)
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  workers: 1,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", trace: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", testIgnore: /auth\.setup\.ts/, use: { browserName: "chromium" }, dependencies: ["setup"] },
    // Phone-sized browser (Chromium emulating a Pixel 5): the customer journey and the quality audits.
    { name: "mobile", testMatch: /(customer-flow|quality)\.spec\.ts/, use: { ...devices["Pixel 5"] }, dependencies: ["setup"] },
  ],
});
