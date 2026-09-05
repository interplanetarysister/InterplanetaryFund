/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Shared non-admin security helpers. Admin authorization is centralized in
 * adminUsers.ts and uses server-issued session tokens, never a PIN argument.
 */

import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const ADMIN_PIN_KEY = "admin_pin";

export async function requireAuth(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Authentication required. Sign in to perform this action.");
  return identity;
}

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();
export function checkRateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 60000) {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);
  if (!entry || now - entry.lastReset > windowMs) {
    rateLimitMap.set(identifier, { count: 1, lastReset: now });
    return true;
  }
  if (entry.count >= maxAttempts) {
    throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`);
  }
  entry.count++;
  return true;
}

export function validateDonation(amount: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= 100000;
}

export function validateWithdrawal(amount: number, availableBalance: number): boolean {
  return Number.isFinite(amount) && amount > 0 && amount <= availableBalance && amount <= 50000;
}

// Internal-only settings access prevents public reads of privileged values such as admin_pin.
export const getAdminSetting = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", key))
      .first();
    return setting?.value ?? null;
  },
});

// Bootstrap-only credential initialization. No public caller can claim the first PIN.
export const initAdminPin = internalMutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    if (!/^\d{4,}$/.test(pin)) throw new Error("Admin PIN must contain at least 4 digits.");
    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    if (existing) throw new Error("Admin PIN already initialized.");
    const settingId = await ctx.db.insert("adminSettings", {
      key: ADMIN_PIN_KEY,
      value: pin,
      updatedAt: new Date().toISOString(),
    });
    return { status: "success", settingId };
  },
});

// Bootstrap maintenance only. Interactive administrators change their own PIN
// through adminUsers.updateOwnPin after session verification.
export const changeAdminPin = internalMutation({
  args: { newPin: v.string() },
  handler: async (ctx, { newPin }) => {
    if (!/^\d{4,}$/.test(newPin)) throw new Error("Admin PIN must contain at least 4 digits.");
    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    if (!existing) throw new Error("Admin PIN is not initialized.");
    await ctx.db.patch(existing._id, { value: newPin, updatedAt: new Date().toISOString() });
    return { status: "success" };
  },
});
