import { defineConfig, devices } from "@playwright/test";

/**
 * Interplanetary Fund — Playwright QA Configuration
 * Credit-free automated testing via GitHub Actions
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["json", { outputFile: "qa-report.json" }],
    ["list"],
  ],
  use: {
    baseURL: process.env.SITE_URL || "https://interplanetary-fund.vercel.app",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    timeout: 30000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
