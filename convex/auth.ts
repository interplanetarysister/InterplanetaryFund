/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { checkRateLimit } from "./security";
import { v } from "convex/values";

// Admin PIN — stored server-side only, never exposed to client
// Default PIN: 0426 (change via updateAdminPin mutation)
const DEFAULT_ADMIN_PIN = "0426";

// Query: Verify admin PIN
export const verifyAdminPin = query({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    // Check if a custom PIN is stored in the database
    const settings = await ctx.db.query("feeConfig").first();
    const adminPin = settings?.adminPin ?? DEFAULT_ADMIN_PIN;
    return { valid: pin === adminPin };
  },
});

// Mutation: Update admin PIN (requires current PIN)
export const updateAdminPin = mutation({
  args: { currentPin: v.string(), newPin: v.string() },
  handler: async (ctx, { currentPin, newPin }) => {
    const settings = await ctx.db.query("feeConfig").first();
    const adminPin = settings?.adminPin ?? DEFAULT_ADMIN_PIN;

    if (currentPin !== adminPin) {
      return { success: false, error: "Current PIN is incorrect" };
    }

    if (newPin.length < 4) {
      return { success: false, error: "PIN must be at least 4 digits" };
    }

    if (settings) {
      await ctx.db.patch(settings._id, { adminPin: newPin });
    } else {
      // If no feeConfig record exists, create one with just the PIN
      await ctx.db.insert("feeConfig", {
        platformFeePercent: 5,
        processingFeePercent: 2.9,
        processingFeeFlat: 0.30,
        adminPin: newPin,
      });
    }

    return { success: true };
  },
});
