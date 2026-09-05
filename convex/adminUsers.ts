/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * ADMIN USERS & SERVER-VERIFIABLE ADMIN SESSIONS
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const ALL_PERMISSIONS = [
  "finance", "campaigns", "platforms", "content", "settings", "reports",
] as const;
const SUPER_ADMIN_PERMISSIONS = [...ALL_PERMISSIONS, "users"];
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function issueSession(ctx: any, adminUser: any) {
  const sessionToken = randomToken();
  const tokenHash = await sha256(sessionToken);
  const expiresAt = Date.now() + SESSION_TTL_MS;
  await ctx.db.insert("adminSessions", {
    adminUserId: adminUser._id,
    tokenHash,
    expiresAt,
    createdAt: new Date().toISOString(),
  });
  return { sessionToken, expiresAt };
}

export async function requireAdminSession(ctx: any, sessionToken: string, requiredPermission?: string) {
  if (!sessionToken || sessionToken.length < 32) throw new Error("Admin authentication required");
  const tokenHash = await sha256(sessionToken);
  const session = await ctx.db.query("adminSessions")
    .withIndex("byTokenHash", (q: any) => q.eq("tokenHash", tokenHash)).first();
  if (!session || session.revokedAt || session.expiresAt <= Date.now()) throw new Error("Admin session expired or invalid");
  const adminUser = await ctx.db.get(session.adminUserId);
  if (!adminUser || !adminUser.active) throw new Error("Admin access revoked");
  const permissions = adminUser.role === "super_admin" ? SUPER_ADMIN_PERMISSIONS : adminUser.permissions;
  if (requiredPermission && adminUser.role !== "super_admin" && !permissions.includes(requiredPermission)) {
    throw new Error("Admin permission denied");
  }
  return { ...adminUser, permissions };
}

async function bootstrapConfiguredSuperAdmin(ctx: any, pin: string) {
  const existing = await ctx.db.query("adminUsers").collect();
  if (existing.length > 0) return null;
  const configured = await ctx.db.query("adminSettings").withIndex("byKey", (q: any) => q.eq("key", "admin_pin")).first();
  const legacy = await ctx.db.query("feeConfig").first();
  const configuredPin = configured?.value || legacy?.adminPin;
  if (!configuredPin || pin !== configuredPin) return null;
  const id = await ctx.db.insert("adminUsers", {
    name: "Platform Administrator",
    email: "",
    pin,
    role: "super_admin",
    permissions: SUPER_ADMIN_PERMISSIONS,
    active: true,
    createdBy: "secure-bootstrap",
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  });
  return await ctx.db.get(id);
}

// PIN is accepted only by this mutation. Successful login returns a random bearer token;
// privileged calls never accept the PIN as caller authorization.
export const authenticateAdmin = mutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }) => {
    if (!pin || pin.length < 4) return { valid: false, error: "Invalid credentials" };
    let adminUser = await ctx.db.query("adminUsers").withIndex("byPin", (q: any) => q.eq("pin", pin)).first();
    if (!adminUser) adminUser = await bootstrapConfiguredSuperAdmin(ctx, pin);
    if (!adminUser || !adminUser.active) return { valid: false, error: "Invalid credentials" };
    const session = await issueSession(ctx, adminUser);
    await ctx.db.patch(adminUser._id, { lastLoginAt: new Date().toISOString() });
    return {
      valid: true,
      userId: adminUser._id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      permissions: adminUser.role === "super_admin" ? SUPER_ADMIN_PERMISSIONS : adminUser.permissions,
      ...session,
    };
  },
});

export const validateAdminSession = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    try {
      const adminUser = await requireAdminSession(ctx, sessionToken);
      return { valid: true, userId: adminUser._id, name: adminUser.name, role: adminUser.role, permissions: adminUser.permissions };
    } catch {
      return { valid: false };
    }
  },
});

export const logoutAdmin = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const tokenHash = await sha256(sessionToken);
    const session = await ctx.db.query("adminSessions").withIndex("byTokenHash", (q: any) => q.eq("tokenHash", tokenHash)).first();
    if (session && !session.revokedAt) await ctx.db.patch(session._id, { revokedAt: new Date().toISOString() });
    return { success: true };
  },
});

export const getAdminUsers = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "users");
    const users = await ctx.db.query("adminUsers").collect();
    return users.map((u: any) => ({
      _id: u._id, name: u.name, email: u.email, role: u.role,
      permissions: u.role === "super_admin" ? SUPER_ADMIN_PERMISSIONS : u.permissions,
      active: u.active, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, pinMasked: "••••",
    }));
  },
});

export const createAdminUser = mutation({
  args: { sessionToken: v.string(), name: v.string(), email: v.string(), pin: v.string(), permissions: v.array(v.string()) },
  handler: async (ctx, { sessionToken, name, email, pin, permissions }) => {
    const requestor = await requireAdminSession(ctx, sessionToken, "users");
    if (requestor.role !== "super_admin") throw new Error("Super admin required");
    if (pin.length < 4) return { success: false, error: "PIN must be at least 4 digits" };
    const existing = await ctx.db.query("adminUsers").withIndex("byPin", (q: any) => q.eq("pin", pin)).first();
    if (existing) return { success: false, error: "PIN already in use by another admin" };
    const validPermissions = permissions.filter((p) => ALL_PERMISSIONS.includes(p as any) && p !== "finance");
    const id = await ctx.db.insert("adminUsers", { name, email, pin, role: "admin", permissions: validPermissions, active: true, createdBy: requestor.name, createdAt: new Date().toISOString() });
    return { success: true, id };
  },
});

export const updateAdminPermissions = mutation({
  args: { sessionToken: v.string(), userId: v.id("adminUsers"), permissions: v.array(v.string()), active: v.optional(v.boolean()) },
  handler: async (ctx, { sessionToken, userId, permissions, active }) => {
    const requestor = await requireAdminSession(ctx, sessionToken, "users");
    if (requestor.role !== "super_admin") throw new Error("Super admin required");
    const user = await ctx.db.get(userId);
    if (!user) return { success: false, error: "Admin user not found" };
    if (user.role === "super_admin") return { success: false, error: "Cannot modify super admin account" };
    const validPermissions = permissions.filter((p) => ALL_PERMISSIONS.includes(p as any) && p !== "finance");
    const updates: any = { permissions: validPermissions };
    if (active !== undefined) updates.active = active;
    await ctx.db.patch(userId, updates);
    if (active === false) {
      const sessions = await ctx.db.query("adminSessions").withIndex("byAdminUserId", (q: any) => q.eq("adminUserId", userId)).collect();
      for (const session of sessions) if (!session.revokedAt) await ctx.db.patch(session._id, { revokedAt: new Date().toISOString() });
    }
    return { success: true };
  },
});

export const deleteAdminUser = mutation({
  args: { sessionToken: v.string(), userId: v.id("adminUsers") },
  handler: async (ctx, { sessionToken, userId }) => {
    const requestor = await requireAdminSession(ctx, sessionToken, "users");
    if (requestor.role !== "super_admin") throw new Error("Super admin required");
    const user = await ctx.db.get(userId);
    if (!user) return { success: false, error: "Admin user not found" };
    if (user.role === "super_admin") return { success: false, error: "Cannot delete super admin account" };
    const sessions = await ctx.db.query("adminSessions").withIndex("byAdminUserId", (q: any) => q.eq("adminUserId", userId)).collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    await ctx.db.delete(userId);
    return { success: true };
  },
});

export const updateOwnPin = mutation({
  args: { sessionToken: v.string(), newPin: v.string() },
  handler: async (ctx, { sessionToken, newPin }) => {
    const user = await requireAdminSession(ctx, sessionToken);
    if (newPin.length < 4) return { success: false, error: "PIN must be at least 4 digits" };
    const existing = await ctx.db.query("adminUsers").withIndex("byPin", (q: any) => q.eq("pin", newPin)).first();
    if (existing && existing._id !== user._id) return { success: false, error: "PIN already in use" };
    await ctx.db.patch(user._id, { pin: newPin });
    return { success: true };
  },
});
