/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";

// Admin PIN is stored server-side only. There is intentionally no fallback
// credential: missing initialization must fail closed.

// Internal-only verification helper. The repository audit found no legitimate
// public callers, so this credential oracle is deliberately removed from the
// public Convex API. Privileged flows should use the authenticated admin
// authorization functions instead of exposing PIN validity to clients.
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
    const settings = await ctx.db.query("feeConfig").first();
    const adminPin = settings?.adminPin;

    // Never bootstrap or authorize from a hardcoded/default credential.
    if (!adminPin || currentPin !== adminPin) {
      return { success: false, error: "Current PIN is incorrect" };
    }

    if (newPin.length < 4) {
      return { success: false, error: "PIN must be at least 4 digits" };
    }

    if (settings) {
      await ctx.db.patch(settings._id, { adminPin: newPin, updatedAt: new Date().toISOString(), updatedBy: (await ctx.auth.getUserIdentity())?.subject ?? "system" });
    }

    return { success: true };
  },
});
