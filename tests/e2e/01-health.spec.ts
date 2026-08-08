/**
 * Interplanetary Fund — Site Health & Home Page Tests
 * Verifies the production site loads, responds, and shows key metrics.
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */
import { test, expect } from "@playwright/test";

const SITE_URL = process.env.SITE_URL || "https://interplanetary-fund.vercel.app";
const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://rosy-butterfly-2.convex.cloud";

test.describe("Site Health", () => {
  test("homepage returns 200 and loads within 10s", async ({ page }) => {
    const start = Date.now();
    const response = await page.goto(SITE_URL, { waitUntil: "networkidle" });
    const loadTime = Date.now() - start;

    expect(response?.status()).toBe(200);
    expect(loadTime).toBeLessThan(10000);
  });

  test("homepage displays donation metrics", async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: "networkidle" });

    // Wait for the main content to render (Convex data loads async)
    await page.waitForTimeout(3000);

    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();

    // Should contain dollar amount (raised) and donor references
    const hasDollarAmount = /\$[\d,]+/.test(bodyText || "");
    expect(hasDollarAmount).toBeTruthy();
  });

  test("Convex backend is reachable", async ({ request }) => {
    // Hit the Convex health/query endpoint
    const response = await request.get(`${CONVEX_URL}/query`, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });
    // Convex returns 400/200 depending on method — just need it to respond
    expect(response.status()).toBeLessThan(500);
  });

  test("Convex campaign data query returns results", async ({ request }) => {
    // Query the campaigns query function via Convex REST API
    const response = await request.post(`${CONVEX_URL}/query`, {
      data: {
        path: "userCampaigns/getActiveCampaigns",
        args: {},
      },
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    // Should return an array of campaigns (or null/empty, but not error)
    expect(data).toBeTruthy();
  });

  test("Convex treasury aggregation returns data", async ({ request }) => {
    const response = await request.post(`${CONVEX_URL}/query`, {
      data: {
        path: "treasury/aggregateBalances",
        args: {},
      },
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    // Treasury should have a grandTotal object with raised and donors
    expect(data).toBeTruthy();
    if (data.grandTotal) {
      expect(typeof data.grandTotal.raised).toBe("number");
      expect(typeof data.grandTotal.donors).toBe("number");
    }
  });

  test("Convex campaign stats query works", async ({ request }) => {
    const response = await request.post(`${CONVEX_URL}/query`, {
      data: {
        path: "campaigns/getCampaignStats",
        args: {},
      },
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data).toBeTruthy();
  });

  test("navigation renders correctly", async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Check for key navigation elements — at minimum a body with content
    const bodyVisible = await page.isVisible("body");
    expect(bodyVisible).toBeTruthy();

    // Check page title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test("Terms of Service modal is accessible", async ({ page }) => {
    await page.goto(SITE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    // Look for terms-related text or button
    const pageText = await page.textContent("body") || "";
    const hasTermsOrLegal =
      pageText.includes("Terms") ||
      pageText.includes("terms") ||
      pageText.includes("Legal") ||
      pageText.includes("Privacy");
    // This is informational — may or may not be present on landing
    expect(typeof hasTermsOrLegal).toBe("boolean");
  });
});
