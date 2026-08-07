/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * SECURITY GUARD — All sensitive Convex functions must pass through these checks.
 * Without these guards, anyone with the deployment URL could call mutations directly.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Admin PIN — stored in the database, verified before any admin action
const ADMIN_PIN_KEY = "admin_pin";

// Check if caller is authenticated
export async function requireAuth(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Authentication required. Sign in to perform this action.");
  }
  return identity;
}

// Check if caller is admin (by PIN verification)
export async function requireAdmin(ctx: any, adminPin: string) {
  if (!adminPin || adminPin.length < 4) {
    throw new Error("Admin PIN required for this action.");
  }
  
  const stored = await ctx.db
    .query("adminSettings")
    .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
    .first();
  
  if (!stored || stored.value !== adminPin) {
    throw new Error("Invalid admin credentials. Access denied.");
  }
  
  return true;
}


// Check if caller is super_admin (full access)
export async function requireSuperAdmin(ctx: any, adminPin: string) {
  if (!adminPin || adminPin.length < 4) {
    throw new Error("Admin PIN required for this action.");
  }

  // Check adminUsers table
  const adminUser = await ctx.db
    .query("adminUsers")
    .withIndex("byPin", (q: any) => q.eq("pin", adminPin))
    .first();

  if (adminUser && adminUser.active && adminUser.role === "super_admin") {
    return true;
  }

  // Legacy PIN check (Michelle's original)
  const settings = await ctx.db.query("feeConfig").first();
  const legacyPin = settings?.adminPin ?? "0426";
  
  if (adminPin === legacyPin) {
    return true;
  }

  throw new Error("Super admin access required. This action is restricted to the platform owner.");
}

// Check if caller has a specific permission
export async function requirePermission(ctx: any, adminPin: string, permission: string) {
  if (!adminPin || adminPin.length < 4) {
    throw new Error("Admin PIN required for this action.");
  }

  // Check adminUsers table
  const adminUser = await ctx.db
    .query("adminUsers")
    .withIndex("byPin", (q: any) => q.eq("pin", adminPin))
    .first();

  if (adminUser && adminUser.active) {
    if (adminUser.role === "super_admin") return true;
    if (adminUser.permissions.includes(permission)) return true;
    throw new Error(`Access denied. You need the "${permission}" permission.`);
  }

  // Legacy PIN check (super admin)
  const settings = await ctx.db.query("feeConfig").first();
  const legacyPin = settings?.adminPin ?? "0426";
  
  if (adminPin === legacyPin) {
    return true;
  }

  throw new Error("Invalid admin credentials. Access denied.");
}

// Rate limiting — prevents brute force on sensitive operations
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

// Verify a donation amount is valid (prevents fake donations)
export function validateDonation(amount: number): boolean {
  if (amount <= 0) return false;
  if (amount > 100000) return false; // Max $100k per donation
  if (isNaN(amount)) return false;
  return true;
}

// Verify a withdrawal request is legitimate
export function validateWithdrawal(amount: number, availableBalance: number): boolean {
  if (amount <= 0) return false;
  if (amount > availableBalance) return false;
  if (isNaN(amount)) return false;
  if (amount > 50000) return false; // Max $50k per withdrawal
  return true;
}

// Admin settings query
export const getAdminSetting = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", args.key))
      .first();
    return setting?.value || null;
  },
});

// Initialize admin PIN (called once during setup)
export const initAdminPin = mutation({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    // Only allow if no PIN is set yet
    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    
    if (existing) {
      throw new Error("Admin PIN already initialized. Use updateAdminPin to change it.");
    }
    
    await ctx.db.insert("adminSettings", {
      key: ADMIN_PIN_KEY,
      value: args.pin,
      updatedAt: new Date().toISOString(),
    });
    
    return { status: "success" };
  },
});

// Update admin PIN (requires current PIN)
export const changeAdminPin = mutation({
  args: { currentPin: v.string(), newPin: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.currentPin);
    
    const existing = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", ADMIN_PIN_KEY))
      .first();
    
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.newPin,
        updatedAt: new Date().toISOString(),
      });
    }
    
    return { status: "success" };
  },
});
