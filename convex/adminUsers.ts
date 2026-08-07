/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * ADMIN USERS & PERMISSIONS SYSTEM
 *
 * Roles:
 *   super_admin — Michelle only. Full access. Cannot be removed.
 *   admin — Scoped admin. Can only access permitted features.
 *
 * Permission scopes:
 *   finance — Treasury, payouts, fee config, fund migration
 *   campaigns — Create, update, sync campaigns
 *   users — Manage admin users and permissions (super_admin only)
 *   platforms — External platform connections
 *   content — Posts, outreach management
 *   settings — Platform settings
 *   reports — View reports and analytics
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// All possible permissions
export const ALL_PERMISSIONS = [
  "finance",      // Treasury, payouts, fees, fund migration
  "campaigns",    // Campaign CRUD and sync
  "platforms",    // External platform management
  "content",      // Posts and outreach
  "settings",     // Platform configuration
  "reports",      // Analytics and reports
] as const;

// Super admin has ALL permissions, always
const SUPER_ADMIN_PERMISSIONS = [...ALL_PERMISSIONS, "users"];

// Query: Authenticate admin by PIN — returns user info + permissions
export const authenticateAdmin = query({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    if (!pin || pin.length < 4) {
      return { valid: false, error: "Invalid PIN" };
    }

    // Check adminUsers table first
    const adminUser = await ctx.db
      .query("adminUsers")
      .withIndex("byPin", (q: any) => q.eq("pin", pin))
      .first();

    if (adminUser && adminUser.active) {
      return {
        valid: true,
        userId: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        permissions: adminUser.role === "super_admin" 
          ? SUPER_ADMIN_PERMISSIONS 
          : adminUser.permissions,
      };
    }

    // Fallback: check legacy PIN in feeConfig (Michelle's original PIN)
    const settings = await ctx.db.query("feeConfig").first();
    const legacyPin = settings?.adminPin ?? "0426";
    
    if (pin === legacyPin) {
      // Auto-create super_admin record for Michelle if not exists
      return {
        valid: true,
        userId: "legacy_super_admin",
        name: "Michelle Rogers",
        email: "interplanetarysister@gmail.com",
        role: "super_admin",
        permissions: SUPER_ADMIN_PERMISSIONS,
      };
    }

    return { valid: false, error: "Invalid PIN" };
  },
});

// Query: Get all admin users (super_admin only — checked by PIN)
export const getAdminUsers = query({
  args: { requestorPin: v.string() },
  handler: async (ctx, { requestorPin }) => {
    const requestor = await authenticateByPin(ctx, requestorPin);
    if (!requestor || requestor.role !== "super_admin") {
      throw new Error("Access denied. Super admin required.");
    }

    const users = await ctx.db.query("adminUsers").collect();
    
    // Don't expose PINs to the client — only show masked
    return users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      permissions: u.role === "super_admin" ? SUPER_ADMIN_PERMISSIONS : u.permissions,
      active: u.active,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      pinMasked: u.pin ? "\u2022\u2022\u2022\u2022" : null,
    }));
  },
});

// Mutation: Create a new admin user (super_admin only)
export const createAdminUser = mutation({
  args: {
    requestorPin: v.string(),
    name: v.string(),
    email: v.string(),
    pin: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, { requestorPin, name, email, pin, permissions }) => {
    const requestor = await authenticateByPin(ctx, requestorPin);
    if (!requestor || requestor.role !== "super_admin") {
      throw new Error("Access denied. Only super admin can create admin users.");
    }

    // Validate PIN
    if (pin.length < 4) {
      return { success: false, error: "PIN must be at least 4 digits" };
    }

    // Check if PIN already exists
    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("byPin", (q: any) => q.eq("pin", pin))
      .first();
    if (existing) {
      return { success: false, error: "PIN already in use by another admin" };
    }

    // Filter permissions to only valid ones (never allow "users" for non-super)
    const validPermissions = permissions.filter(p => ALL_PERMISSIONS.includes(p as any));

    const id = await ctx.db.insert("adminUsers", {
      name,
      email,
      pin,
      role: "admin", // New users are always "admin", never "super_admin"
      permissions: validPermissions,
      active: true,
      createdBy: requestor.name,
      createdAt: new Date().toISOString(),
    });

    return { success: true, id };
  },
});

// Mutation: Update admin user permissions (super_admin only)
export const updateAdminPermissions = mutation({
  args: {
    requestorPin: v.string(),
    userId: v.id("adminUsers"),
    permissions: v.array(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { requestorPin, userId, permissions, active }) => {
    const requestor = await authenticateByPin(ctx, requestorPin);
    if (!requestor || requestor.role !== "super_admin") {
      throw new Error("Access denied. Only super admin can modify permissions.");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return { success: false, error: "Admin user not found" };
    }

    // Never allow modifying a super_admin
    if (user.role === "super_admin") {
      return { success: false, error: "Cannot modify super admin account" };
    }

    const validPermissions = permissions.filter(p => ALL_PERMISSIONS.includes(p as any));
    
    const updates: any = { permissions: validPermissions };
    if (active !== undefined) updates.active = active;

    await ctx.db.patch(userId, updates);

    return { success: true };
  },
});

// Mutation: Delete admin user (super_admin only)
export const deleteAdminUser = mutation({
  args: {
    requestorPin: v.string(),
    userId: v.id("adminUsers"),
  },
  handler: async (ctx, { requestorPin, userId }) => {
    const requestor = await authenticateByPin(ctx, requestorPin);
    if (!requestor || requestor.role !== "super_admin") {
      throw new Error("Access denied. Only super admin can remove admin users.");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      return { success: false, error: "Admin user not found" };
    }

    if (user.role === "super_admin") {
      return { success: false, error: "Cannot delete super admin account" };
    }

    await ctx.db.delete(userId);
    return { success: true };
  },
});

// Mutation: Update admin PIN (self-service — user knows their current PIN)
export const updateOwnPin = mutation({
  args: {
    currentPin: v.string(),
    newPin: v.string(),
  },
  handler: async (ctx, { currentPin, newPin }) => {
    if (newPin.length < 4) {
      return { success: false, error: "PIN must be at least 4 digits" };
    }

    // Find the admin user by current PIN
    const user = await ctx.db
      .query("adminUsers")
      .withIndex("byPin", (q: any) => q.eq("pin", currentPin))
      .first();

    if (user) {
      // Check new PIN isn't taken
      const existing = await ctx.db
        .query("adminUsers")
        .withIndex("byPin", (q: any) => q.eq("pin", newPin))
        .first();
      if (existing && existing._id !== user._id) {
        return { success: false, error: "PIN already in use" };
      }

      await ctx.db.patch(user._id, { pin: newPin });
      return { success: true };
    }

    // Fallback: legacy PIN in feeConfig
    const settings = await ctx.db.query("feeConfig").first();
    const legacyPin = settings?.adminPin ?? "0426";
    if (currentPin === legacyPin) {
      if (settings) {
        await ctx.db.patch(settings._id, { adminPin: newPin });
      }
      return { success: true };
    }

    return { success: false, error: "Current PIN is incorrect" };
  },
});

// Mutation: Record last login time
export const recordLogin = mutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const user = await ctx.db
      .query("adminUsers")
      .withIndex("byPin", (q: any) => q.eq("pin", pin))
      .first();
    
    if (user) {
      await ctx.db.patch(user._id, { lastLoginAt: new Date().toISOString() });
    }
    
    return { success: true };
  },
});

// Helper: authenticate by PIN (internal)
async function authenticateByPin(ctx: any, pin: string) {
  if (!pin || pin.length < 4) return null;

  const adminUser = await ctx.db
    .query("adminUsers")
    .withIndex("byPin", (q: any) => q.eq("pin", pin))
    .first();

  if (adminUser && adminUser.active) {
    return {
      _id: adminUser._id,
      name: adminUser.name,
      role: adminUser.role,
      permissions: adminUser.role === "super_admin"
        ? SUPER_ADMIN_PERMISSIONS
        : adminUser.permissions,
    };
  }

  // Legacy PIN check
  const settings = await ctx.db.query("feeConfig").first();
  const legacyPin = settings?.adminPin ?? "0426";
  if (pin === legacyPin) {
    return {
      _id: "legacy_super_admin",
      name: "Michelle Rogers",
      role: "super_admin",
      permissions: SUPER_ADMIN_PERMISSIONS,
    };
  }

  return null;
}
