/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Legacy/bootstrap admin credential helpers are internal-only. Interactive
 * administration uses server-issued sessions from adminUsers.ts.
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const ADMIN_PIN_KEY = "admin_pin";

// Internal bootstrap verification only. Never expose a PIN-validity oracle to clients.
export const verifyAdminPin = internalQuery({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    return { valid: Boolean(setting?.value) && pin === setting?.value };
  },
});

// Internal bootstrap maintenance only. Interactive PIN changes use
// adminUsers.updateOwnPin with a valid admin session.
export const updateAdminPin = internalMutation({
  args: { newPin: v.string() },
  handler: async (ctx, { newPin }) => {
    if (!/^\d{4,}$/.test(newPin)) throw new Error("Admin PIN must contain at least 4 digits.");
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    const now = new Date().toISOString();
    if (setting) {
      await ctx.db.patch(setting._id, { value: newPin, updatedAt: now });
      return { success: true, settingId: setting._id };
    }
    const settingId = await ctx.db.insert("adminSettings", {
      key: ADMIN_PIN_KEY,
      value: newPin,
      updatedAt: now,
    });
    return { success: true, settingId };
  },
});
