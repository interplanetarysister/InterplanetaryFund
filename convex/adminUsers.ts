/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * ADMIN USERS & PERMISSIONS SYSTEM
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit } from "./security";
import {
  createAdminSessionRecord,
  requireAdminSession,
  requireSuperAdminSession,
  revokeAdminSessionRecord,
} from "./adminSession";

export const ALL_PERMISSIONS = [
  "finance",
  "campaigns",
  "platforms",
  "content",
  "settings",
  "reports",
] as const;

const SUPER_ADMIN_PERMISSIONS = [...ALL_PERMISSIONS, "users"];
const SESSION_ID = v.id("adminSettings");

function safeAdmin(user: any) {
  return {
    userId: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    permissions: user.role === "super_admin" ? SUPER_ADMIN_PERMISSIONS : user.permissions,
  };
}

async function findExplicitLegacyCredential(ctx: any, pin: string) {
  const pinSetting = await ctx.db
    .query("adminSettings")
    .withIndex("byKey", (q: any) => q.eq("key", "admin_pin"))
    .first();
  if (pinSetting?.value && pinSetting.value === pin) {
    return { updatedAt: pinSetting.updatedAt, source: "adminSettings" as const, document: pinSetting };
  }

  const feeConfig = await ctx.db.query("feeConfig").first();
  if (feeConfig?.adminPin && feeConfig.adminPin === pin) {
    return { updatedAt: feeConfig.updatedAt, source: "feeConfig" as const, document: feeConfig };
  }

  return null;
}

// Explicit login mutation. The PIN is checked only when the user submits the
// login form; it is not exposed through a reactive public query.
export const createAdminSession = mutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    checkRateLimit("admin-session-create", 20, 60_000);
    if (!pin || pin.length < 4) return { valid: false as const };

    const adminUser = await ctx.db
      .query("adminUsers")
      .withIndex("byPin", (q: any) => q.eq("pin", pin))
      .first();

    if (adminUser?.active) {
      const sessionId = await createAdminSessionRecord(ctx, {
        adminUserId: String(adminUser._id),
      });
      await ctx.db.patch(adminUser._id, { lastLoginAt: new Date().toISOString() });
      return { valid: true as const, sessionId, ...safeAdmin(adminUser) };
    }

    // Backward compatibility is retained only for an explicitly configured
    // legacy credential. The former hard-coded fallback PIN is intentionally gone.
    const legacy = await findExplicitLegacyCredential(ctx, pin);
    if (legacy) {
      const sessionId = await createAdminSessionRecord(ctx, {
        legacy: true,
        legacyCredentialUpdatedAt: legacy.updatedAt,
      });
      return {
        valid: true as const,
        sessionId,
        userId: "legacy_super_admin",
        name: "Platform Owner",
        email: "",
        role: "super_admin",
        permissions: SUPER_ADMIN_PERMISSIONS,
      };
    }

    return { valid: false as const };
  },
});

export const validateAdminSession = query({
  args: { sessionId: SESSION_ID },
  handler: async (ctx, { sessionId }) => {
    try {
      const principal = await requireAdminSession(ctx, sessionId);
      return { valid: true as const, ...principal };
    } catch {
      return { valid: false as const };
    }
  },
});

export const revokeAdminSession = mutation({
  args: { sessionId: SESSION_ID },
  handler: async (ctx, { sessionId }) => {
    await revokeAdminSessionRecord(ctx, sessionId);
    return { success: true };
  },
});

export const getAdminUsers = query({
  args: { sessionId: SESSION_ID },
  handler: async (ctx, { sessionId }) => {
    await requireSuperAdminSession(ctx, sessionId);
    const users = await ctx.db.query("adminUsers").collect();
    return users.map((u: any) => ({
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
    sessionId: SESSION_ID,
    name: v.string(),
    email: v.string(),
    pin: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, { sessionId, name, email, pin, permissions }) => {
    const requestor = await requireSuperAdminSession(ctx, sessionId);
    if (pin.length < 4) return { success: false, error: "PIN must be at least 4 digits" };

    const existing = await ctx.db
      .query("adminUsers")
      .withIndex("byPin", (q: any) => q.eq("pin", pin))
      .first();
    if (existing) return { success: false, error: "PIN already in use by another admin" };

    const validPermissions = permissions.filter((p) => ALL_PERMISSIONS.includes(p as any));
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
    sessionId: SESSION_ID,
    userId: v.id("adminUsers"),
    permissions: v.array(v.string()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, { sessionId, userId, permissions, active }) => {
    await requireSuperAdminSession(ctx, sessionId);
    const user = await ctx.db.get(userId);
    if (!user) return { success: false, error: "Admin user not found" };
    if (user.role === "super_admin") return { success: false, error: "Cannot modify super admin account" };

    const validPermissions = permissions.filter((p) => ALL_PERMISSIONS.includes(p as any));
    const updates: any = { permissions: validPermissions };
    if (active !== undefined) updates.active = active;
    await ctx.db.patch(userId, updates);
    return { success: true };
  },
});

export const deleteAdminUser = mutation({
  args: { sessionId: SESSION_ID, userId: v.id("adminUsers") },
  handler: async (ctx, { sessionId, userId }) => {
    await requireSuperAdminSession(ctx, sessionId);
    const user = await ctx.db.get(userId);
    if (!user) return { success: false, error: "Admin user not found" };
    if (user.role === "super_admin") return { success: false, error: "Cannot delete super admin account" };
    await ctx.db.delete(userId);
    return { success: true };
  },
});

export const updateOwnPin = mutation({
  args: { sessionId: SESSION_ID, newPin: v.string() },
  handler: async (ctx, { sessionId, newPin }) => {
    if (newPin.length < 4) return { success: false, error: "PIN must be at least 4 digits" };
    const principal = await requireAdminSession(ctx, sessionId);

    const duplicate = await ctx.db
      .query("adminUsers")
      .withIndex("byPin", (q: any) => q.eq("pin", newPin))
      .first();
    if (duplicate && String(duplicate._id) !== principal.userId) {
      return { success: false, error: "PIN already in use" };
    }

    if (!principal.legacy) {
      await ctx.db.patch(principal.userId as any, { pin: newPin });
    } else {
      const pinSetting = await ctx.db
        .query("adminSettings")
        .withIndex("byKey", (q: any) => q.eq("key", "admin_pin"))
        .first();
      const now = new Date().toISOString();
      if (pinSetting) {
        await ctx.db.patch(pinSetting._id, { value: newPin, updatedAt: now });
      } else {
        const feeConfig = await ctx.db.query("feeConfig").first();
        if (!feeConfig?.adminPin) {
          throw new Error("No explicit legacy admin credential exists to update.");
        }
        await ctx.db.patch(feeConfig._id, { adminPin: newPin, updatedAt: now });
      }
    }

    await revokeAdminSessionRecord(ctx, sessionId);
    return { success: true, reloginRequired: true };
  },
});
