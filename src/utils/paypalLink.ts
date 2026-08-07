/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

/**
 * Generates a one-click PayPal donate link for any campaign.
 * This link works anywhere: Facebook posts, emails, text messages, bios.
 * Donors can choose their own amount (no amount parameter = user picks).
 *
 * Business account: interplanetarysister@gmail.com
 */

const BUSINESS_EMAIL = "interplanetarysister@gmail.com";

export function generatePayPalLink(campaignTitle: string, amount?: number): string {
  const params = new URLSearchParams({
    cmd: "_donations",
    business: BUSINESS_EMAIL,
    item_name: `${campaignTitle} - Interplanetary Fund`,
    currency_code: "USD",
  });

  if (amount) {
    params.set("amount", amount.toString());
  }

  return `https://www.paypal.com/donate/?${params.toString()}`;
}

/**
 * Generates the full text block to append to every campaign post.
 * Includes a short call-to-action and the clickable PayPal link.
 * This travels with the post even if copy-pasted.
 */
export function generateDonationBlock(campaignTitle: string, amount?: number): string {
  const link = generatePayPalLink(campaignTitle, amount);
  return `\n\n💝 Support this campaign: ${link}\nEvery donation makes a difference. Thank you! 🙏`;
}

/**
 * Generates a short version for platforms with character limits (Twitter/X, etc.)
 */
export function generateShortDonationBlock(campaignTitle: string): string {
  const link = generatePayPalLink(campaignTitle);
  return `\n💝 Donate: ${link}`;
}
