/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { internalQuery, mutation } from "./_generated/server";
import { requireAdmin, requireAuth } from "./security";
import { v } from "convex/values";

// Admin PIN has one canonical persistence location: adminSettings.admin_pin.
// feeConfig remains financial configuration and is not an authorization source.
const ADMIN_PIN_KEY = "admin_pin";

// Internal-only PIN verification helper. No public client should be able to use
// the privileged credential as a validity oracle.
export const verifyAdminPin = internalQuery({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const settings = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    const adminPin = settings?.value;
    return { valid: Boolean(adminPin) && pin === adminPin };
  },
});

// Mutation: Update admin PIN (requires authenticated authorized admin + current PIN)
export const updateAdminPin = mutation({
  args: { currentPin: v.string(), newPin: v.string() },
  handler: async (ctx, { currentPin, newPin }) => {
    const identity = await requireAuth(ctx);

    const adminUser = identity.email
      ? await ctx.db
          .query("adminUsers")
          .withIndex("byEmail", (q: any) => q.eq("email", identity.email))
          .first()
      : null;

    const authorized =
      !!adminUser &&
      adminUser.active &&
      (adminUser.role === "super_admin" ||
        adminUser.permissions.includes("settings") ||
        adminUser.permissions.includes("finance"));

    if (!authorized) {
      return { success: false, error: "Admin authorization required" };
    }

    await requireAdmin(ctx, currentPin);

    if (!/^\d{4,}$/.test(newPin)) {
      return { success: false, error: "PIN must be at least 4 digits" };
    }

    const settings = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();

    if (!settings) {
      return { success: false, error: "Admin PIN is not initialized" };
    }

    await ctx.db.patch(settings._id, {
      value: newPin,
      updatedAt: new Date().toISOString(),
      updatedBy: identity.subject,
    });

    return { success: true };
  },
});
