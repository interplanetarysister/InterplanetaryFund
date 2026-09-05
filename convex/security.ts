/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminSession, requireSuperAdminSession } from "./adminSession";

const ADMIN_PIN_KEY = "admin_pin";

export async function requireAuth(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required. Sign in to perform this action.");
  }
  return identity;
}

async function explicitLegacyPin(ctx: any) {
  const stored = await ctx.db
    .query("adminSettings")
    .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
    .first();
  if (stored?.value) return stored.value;
  const feeConfig = await ctx.db.query("feeConfig").first();
  return feeConfig?.adminPin || null;
}

// Backward-compatible PIN helpers for legacy functions that have not yet moved
// to sessions. They accept only an explicitly configured credential. There is
// deliberately no source-code/default PIN fallback.
export async function requireAdmin(ctx: any, adminPin: string) {
  if (!adminPin || adminPin.length < 4) throw new Error("Admin PIN required for this action.");
  const configured = await explicitLegacyPin(ctx);
  if (!configured || configured !== adminPin) {
    throw new Error("Invalid admin credentials. Access denied.");
  }
  return true;
}

export async function requireSuperAdmin(ctx: any, adminPin: string) {
  if (!adminPin || adminPin.length < 4) throw new Error("Admin PIN required for this action.");

  const adminUser = await ctx.db
    .query("adminUsers")
    .withIndex("byPin", (q: any) => q.eq("pin", adminPin))
    .first();
  if (adminUser?.active && adminUser.role === "super_admin") return true;

  const configured = await explicitLegacyPin(ctx);
  if (configured && configured === adminPin) return true;

  throw new Error("Super admin access required. This action is restricted to the platform owner.");
}

export async function requirePermission(ctx: any, adminPin: string, permission: string) {
  if (!adminPin || adminPin.length < 4) throw new Error("Admin PIN required for this action.");

  const adminUser = await ctx.db
    .query("adminUsers")
    .withIndex("byPin", (q: any) => q.eq("pin", adminPin))
    .first();
  if (adminUser?.active) {
    if (adminUser.role === "super_admin" || adminUser.permissions.includes(permission)) return true;
    throw new Error(`Access denied. You need the "${permission}" permission.`);
  }

  const configured = await explicitLegacyPin(ctx);
  if (configured && configured === adminPin) return true;
  throw new Error("Invalid admin credentials. Access denied.");
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
  return amount > 0 && amount <= 100000 && !Number.isNaN(amount);
}

export function validateWithdrawal(amount: number, availableBalance: number): boolean {
  return amount > 0 && amount <= availableBalance && amount <= 50000 && !Number.isNaN(amount);
}

// Admin settings are no longer publicly readable. This prevents callers from
// querying security material such as admin_pin by key.
export const getAdminSetting = query({
  args: { sessionId: v.id("adminSettings"), key: v.string() },
  handler: async (ctx, { sessionId, key }) => {
    await requireAdminSession(ctx, sessionId, "settings");
    if (key === ADMIN_PIN_KEY || key.startsWith("admin_session")) {
      throw new Error("Security credentials cannot be read through settings APIs.");
    }
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", key))
      .first();
    return setting?.value || null;
  },
});

// In-app unauthenticated bootstrap is intentionally disabled. Initial owner
// credential provisioning must happen through a trusted backend/deployment path.
export const initAdminPin = mutation({
  args: { pin: v.string() },
  handler: async () => {
    throw new Error("Admin credential bootstrap is disabled in the public application API.");
  },
});

export const changeAdminPin = mutation({
  args: { sessionId: v.id("adminSettings"), newPin: v.string() },
  handler: async (ctx, { sessionId, newPin }) => {
    await requireSuperAdminSession(ctx, sessionId);
    if (newPin.length < 4) throw new Error("PIN must be at least 4 digits.");

    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch(existing._id, { value: newPin, updatedAt: now });
    } else {
      await ctx.db.insert("adminSettings", { key: ADMIN_PIN_KEY, value: newPin, updatedAt: now });
    }
    return { status: "success", reloginRequired: true };
  },
});
