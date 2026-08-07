/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// === HELP ARTICLES ===

// Query: Get all help articles
export const getHelpArticles = query({
  args: { category: v.optional(v.string()) },
  handler: async (ctx, { category }) => {
    if (category && category !== "All") {
      return await ctx.db
        .query("helpArticles")
        .filter((q) => q.eq(q.field("category"), category))
        .collect();
    }
    return await ctx.db.query("helpArticles").collect();
  },
});

// Mutation: Mark help article as helpful or not
export const markHelpful = mutation({
  args: { articleId: v.string(), helpful: v.boolean() },
  handler: async (ctx, { articleId, helpful }) => {
    const article = await ctx.db.get(articleId as any);
    if (article) {
      if (helpful) {
        await ctx.db.patch(articleId as any, {
          helpfulYes: ((article as any).helpfulYes || 0) + 1,
        });
      } else {
        await ctx.db.patch(articleId as any, {
          helpfulNo: ((article as any).helpfulNo || 0) + 1,
        });
      }
    }
    return { success: true };
  },
});

// === SUPPORT TICKETS ===

// Mutation: Create a support ticket
export const createTicket = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { name, email, subject, message }) => {
    const ticketId = await ctx.db.insert("supportTickets", {
      name,
      email,
      subject,
      message,
      status: "open",
      createdAt: new Date().toISOString(),
    });
    return { ticketId, success: true };
  },
});

// Query: Get all support tickets (admin)
export const getTickets = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    if (status && status !== "all") {
      return await ctx.db
        .query("supportTickets")
        .filter((q) => q.eq(q.field("status"), status))
        .collect();
    }
    return await ctx.db.query("supportTickets").collect();
  },
});

// Mutation: Close a support ticket
export const closeTicket = mutation({
  args: { ticketId: v.string() },
  handler: async (ctx, { ticketId }) => {
    await ctx.db.patch(ticketId as any, { status: "closed" });
    return { success: true };
  },
});
