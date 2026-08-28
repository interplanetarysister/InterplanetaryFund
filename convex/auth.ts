/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { internalQuery, mutation } from "./_generated/server";
import { requireAuth, checkRateLimit } from "./security";
import { v } from "convex/values";

// Query: Verify admin PIN
// Internal-only: callers must not receive a public PIN-validity oracle.
export const verifyAdminPin = internalQuery({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const settings = await ctx.db.query("feeConfig").first();
    const adminPin = settings?.adminPin;
    return { valid: Boolean(adminPin) && pin === adminPin };
  },
});

// Mutation: Update admin PIN (requires current PIN)
export const updateAdminPin = mutation({
  args: { currentPin: v.string(), newPin: v.string() },
  handler: async (ctx, { currentPin, newPin }) => {
    const identity = await requireAuth(ctx);
    const settings = await ctx.db.query("feeConfig").first();
    const adminPin = settings?.adminPin;

    if (!adminPin || currentPin !== adminPin) {
      return { success: false, error: "Current PIN is incorrect" };
    }

    if (newPin.length < 4 || !/^\d+$/.test(newPin)) {
      return { success: false, error: "PIN must be at least 4 digits" };
    }

    if (settings) {
      await ctx.db.patch(settings._id, { adminPin: newPin, updatedAt: new Date().toISOString(), updatedBy: identity.subject });
    } else {
      return { success: false, error: "Admin PIN is not configured" };
    }

    return { success: true };
  },
});
