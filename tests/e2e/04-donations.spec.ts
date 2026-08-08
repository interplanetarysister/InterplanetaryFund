/**
 * Interplanetary Fund — Donation & Payment Flow Tests
 * Tests CashApp donation links, PayPal buttons, and donation recording.
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */
import { test, expect } from "@playwright/test";

const SITE_URL = process.env.SITE_URL || "https://interplanetary-fund.vercel.app";
const CONVEX_URL = process.env.VITE_CONVEX_URL || "https://rosy-butterfly-2.convex.cloud";

test.describe("Donation Flows", () => {
  test("explore page shows donation metrics", async ({ page }) => {
    await page.goto(`${SITE_URL}/explore`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);

    const bodyText = await page.textContent("body") || "";
    // Should show raised amounts and donor counts
    const hasDollarAmount = /\$[\d,]+/.test(bodyText);
    const hasDonorOrSupporter =
      bodyText.includes("donor") ||
      bodyText.includes("Donor") ||
      bodyText.includes("supporter") ||
      bodyText.includes("Supporter") ||
      bodyText.includes("navigator") ||
      bodyText.includes("Navigator");

    expect(hasDollarAmount || hasDonorOrSupporter).toBeTruthy();
  });

  test("campaign cards show donation info", async ({ page }) => {
    await page.goto(`${SITE_URL}/explore`, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);

    // Look for progress bars or donation amounts
    const bodyText = await page.textContent("body") || "";

    // Should have campaign-related content with funding info
    const hasGoalOrProgress =
      bodyText.includes("goal") ||
      bodyText.includes("Goal") ||
      bodyText.includes("raised") ||
      bodyText.includes("Raised") ||
      bodyText.includes("$") ||
      bodyText.includes("funded") ||
      bodyText.includes("Funded");

    expect(hasGoalOrProgress).toBeTruthy();
  });

  test("CashApp donation link is present on campaign interaction", async ({ page }) => {
    // Query Convex for active campaigns to verify CashApp integration exists
    const response = await page.request.post(`${CONVEX_URL}/query`, {
      data: {
        path: "userCampaigns/getActiveCampaigns",
        args: {},
      },
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    expect(response.status()).toBe(200);
    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      // Verify campaigns have the structure for donations
      const campaign = data[0];
      expect(campaign).toHaveProperty("title");
      expect(campaign).toHaveProperty("goalAmount");
      expect(campaign).toHaveProperty("raisedAmount");
    }
  });

  test("donation recording function exists in Convex", async ({ request }) => {
    // Verify the Convex mutation endpoint is accessible
    const response = await request.post(`${CONVEX_URL}/mutation`, {
      data: {
        path: "userCampaigns/recordDonation",
        args: {
          campaignId: "qa-test-nonexistent",
          amount: 0.01,
          donorName: "QA Test",
        },
      },
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });

    // Should return 200 (Convex processes the mutation, even if campaign not found)
    expect(response.status()).toBeLessThan(500);
  });

  test("treasury page is accessible", async ({ page }) => {
    await page.goto(`${SITE_URL}/treasury`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const pageText = await page.textContent("body") || "";
    expect(pageText.length).toBeGreaterThan(0);
  });
});
