import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run the production build (out/) under the production security headers,
 * at phone sizes, with the phone set to a non-Malaysian timezone to prove times stay in KL.
 * Build first: npm run build
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    timezoneId: "America/New_York",
    locale: "en-US",
    trace: "off",
  },
  webServer: {
    command: "node scripts/serve-static.mjs 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
});
