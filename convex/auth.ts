/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { checkRateLimit } from "./security";
import { v } from "convex/values";

// Admin PIN — stored server-side only, never exposed to client.
// There is intentionally no hardcoded fallback credential. Bootstrap is handled
// through the controlled internal initialization path.

// Query: Verify configured admin PIN
export const verifyAdminPin = query({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const settings = await ctx.db.query("feeConfig").first();
    if (!settings?.adminPin) {
      return { valid: false };
    }
    return { valid: pin === settings.adminPin };
  },
});

// Mutation: Update an already-configured admin PIN (requires current PIN).
// First-time initialization is intentionally unavailable through this public
// mutation; use the controlled internal bootstrap path instead.
export const updateAdminPin = mutation({
  args: { currentPin: v.string(), newPin: v.string() },
  handler: async (ctx, { currentPin, newPin }) => {
    const settings = await ctx.db.query("feeConfig").first();
    if (!settings?.adminPin) {
      return { success: false, error: "Admin PIN is not configured" };
    }

    if (currentPin !== settings.adminPin) {
      return { success: false, error: "Current PIN is incorrect" };
    }

    if (newPin.length < 4) {
      return { success: false, error: "PIN must be at least 4 digits" };
    }

    await ctx.db.patch(settings._id, {
      adminPin: newPin,
      updatedAt: new Date().toISOString(),
      updatedBy: (await ctx.auth.getUserIdentity())?.subject ?? "system",
    });

    return { success: true };
  },
});
