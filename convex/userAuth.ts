/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { checkRateLimit } from "./security";

// Query: Register a new user (email + name)
export const register = mutation({
  args: {
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, { email, name }) => {
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await ctx.db.query("userProfiles")
      .filter((q) => q.eq(q.field("email"), normalizedEmail))
      .first();

    if (existing) {
      return { success: false, error: "An account with this email already exists", userId: existing.userId };
    }

    const userId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    await ctx.db.insert("userProfiles", {
      userId,
      name,
      email: normalizedEmail,
      subscriptionTier: "standard",
      aiCrossPostingEnabled: false,
      standardCrossPostingEnabled: false,
      adminAccessStatus: "none",
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, userId, name, email: normalizedEmail };
  },
});

// Query: Login with email (passwordless — email-based for now)
export const login = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalizedEmail = email.toLowerCase().trim();
    const profile = await ctx.db.query("userProfiles")
      .filter((q) => q.eq(q.field("email"), normalizedEmail))
      .first();

    if (!profile) {
      return { success: false, error: "No account found with this email" };
    }

    return {
      success: true,
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      subscriptionTier: profile.subscriptionTier,
      aiCrossPostingEnabled: profile.aiCrossPostingEnabled,
      standardCrossPostingEnabled: profile.standardCrossPostingEnabled,
    };
  },
});

// Query: Get user profile
export const getProfile = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db.query("userProfiles")
      .withIndex("byUserId", (q) => q.eq("userId", userId))
      .first();

    if (!profile) {
      return null;
    }

    return {
      userId: profile.userId,
      name: profile.name,
      email: profile.email,
      subscriptionTier: profile.subscriptionTier,
      aiCrossPostingEnabled: profile.aiCrossPostingEnabled,
      standardCrossPostingEnabled: profile.standardCrossPostingEnabled,
      adminAccessStatus: profile.adminAccessStatus,
    };
  },
});
