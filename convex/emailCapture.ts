/*
 * Interplanetary Fund — Email Capture System
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Capture visitor emails for newsletter, retargeting, and campaign alerts.
 * All functions run credit-free on Convex.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Subscribe a new email
export const subscribe = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    source: v.optional(v.string()),
    interestedIn: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Check if already subscribed
    const existing = await ctx.db
      .query("emailSubscribers")
      .withIndex("byEmail", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      if (existing.isActive) {
        return { status: "already_subscribed", subscriberId: existing._id };
      }
      // Resubscribe if they previously unsubscribed
      await ctx.db.patch(existing._id, {
        isActive: true,
        unsubscribedAt: undefined,
        subscribedAt: new Date().toISOString(),
      });
      return { status: "resubscribed", subscriberId: existing._id };
    }

    // Create new subscriber
    const subscriberId = await ctx.db.insert("emailSubscribers", {
      email: args.email,
      name: args.name,
      source: args.source || "footer",
      interestedIn: args.interestedIn,
      isActive: true,
      subscribedAt: new Date().toISOString(),
    });

    // Log as supporter interaction for analytics
    await ctx.db.insert("supporterInteractions", {
      campaignId: "",
      campaignTitle: "Newsletter Signup",
      interactionType: "email_subscribe",
      supporterName: args.name || "",
      metadata: JSON.stringify({ email: args.email, source: args.source }),
      createdAt: new Date().toISOString(),
    });

    return { status: "subscribed", subscriberId };
  },
});

// Unsubscribe
export const unsubscribe = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const subscriber = await ctx.db
      .query("emailSubscribers")
      .withIndex("byEmail", (q) => q.eq("email", email))
      .first();

    if (!subscriber) {
      return { status: "not_found" };
    }

    await ctx.db.patch(subscriber._id, {
      isActive: false,
      unsubscribedAt: new Date().toISOString(),
    });

    return { status: "unsubscribed" };
  },
});

// Get subscriber count (admin)
export const getSubscriberCount = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("emailSubscribers")
      .withIndex("byActive", (q) => q.eq("isActive", true))
      .collect();
    return {
      activeSubscribers: active.length,
      totalSubscribers: (await ctx.db.query("emailSubscribers").collect()).length,
    };
  },
});

// Get all subscribers (admin)
export const getSubscribers = query({
  args: {},
  handler: async (ctx) => {
    const subscribers = await ctx.db
      .query("emailSubscribers")
      .withIndex("byActive", (q) => q.eq("isActive", true))
      .collect();
    return subscribers.map(s => ({
      email: s.email,
      name: s.name,
      source: s.source,
      interestedIn: s.interestedIn,
      subscribedAt: s.subscribedAt,
    }));
  },
});
