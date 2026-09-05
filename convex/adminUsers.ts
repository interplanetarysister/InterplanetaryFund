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

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// All non-super-admin permissions. "users" remains super-admin-only.
export const ALL_PERMISSIONS = [
  "finance",
  "campaigns",
  "platforms",
  "content",
  "settings",
  "reports",
] as const;

const SUPER_ADMIN_PERMISSIONS = [...ALL_PERMISSIONS, "users"];

export const authenticateAdmin = query({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    if (!pin || pin.length < 4) {
      return { valid: false, error: "Invalid PIN" };
    }

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

    return { valid: false, error: "Invalid PIN" };
  },
});

export const getAdminUsers = query({
  args: { requestorPin: v.string() },
  handler: async (ctx, { requestorPin }) => {
    const requestor = await authenticateByPin(ctx, requestorPin);
    if (!requestor || requestor.role !== "super_admin") {
      throw new Error("Access denied. Super admin required.");
    }

    const users = await ctx.db.query("adminUsers").collect();
    return users.map(u => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      permissions: u.role === "super_admin" ? SUPER_ADMIN_PERMISSIONS : u.permissions,
      active: u.active,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      pinMasked: u.pin ? "••••" : null,
    }));
  },
});

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

    if (pin.length < 4) {
      return { success: false, error: "PIN must be at least 4 digits" };
    }

    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("byPin", (q: any) => q.eq("pin", pin))
      .first();
    if (existing) {
      return { success: false, error: "PIN already in use by another admin" };
    }

    const validPermissions = permissions.filter(p => ALL_PERMISSIONS.includes(p as any));

    const id = await ctx.db.insert("adminUsers", {
      name,
      email,
      pin,
      role: "admin",
      permissions: validPermissions,
      active: true,
      createdBy: requestor.name,
      createdAt: new Date().toISOString(),
    });

    return { success: true, id };
  },
});

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

export const updateOwnPin = mutation({
  args: {
    currentPin: v.string(),
    newPin: v.string(),
  },
  handler: async (ctx, { currentPin, newPin }) => {
    if (newPin.length < 4) {
      return { success: false, error: "PIN must be at least 4 digits" };
    }

    const user = await ctx.db
      .query("adminUsers")
      .withIndex("byPin", (q: any) => q.eq("pin", currentPin))
      .first();

    if (!user || !user.active) {
      return { success: false, error: "Current PIN is incorrect" };
    }

    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("byPin", (q: any) => q.eq("pin", newPin))
      .first();
    if (existing && existing._id !== user._id) {
      return { success: false, error: "PIN already in use" };
    }

    await ctx.db.patch(user._id, { pin: newPin });
    return { success: true };
  },
});

// Internal-only telemetry. There are no repository client callers; keeping this
// off the public API prevents anonymous PIN-as-identity state mutation.
export const recordLogin = internalMutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    const user = await ctx.db
      .query("adminUsers")
      .withIndex("byPin", (q: any) => q.eq("pin", pin))
      .first();

    if (user && user.active) {
      await ctx.db.patch(user._id, { lastLoginAt: new Date().toISOString() });
    }

    return { success: true };
  },
});

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

  return null;
}
