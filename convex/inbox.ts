/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Universal inbox. Integration ingestion is server-internal; inbox visibility
 * and management require the same server-issued admin session as the cockpit.
 */

import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdminSession, requireSuperAdminSession } from "./adminUsers";

export const recordMessage = internalMutation({
  args: {
    platform: v.string(), senderName: v.string(), senderId: v.string(), recipientId: v.string(),
    subject: v.optional(v.string()), body: v.string(), platformMessageId: v.string(),
    platformUrl: v.optional(v.string()), groupId: v.optional(v.string()), groupName: v.optional(v.string()),
    campaignId: v.optional(v.string()), forwarded: v.boolean(), replied: v.boolean(), priority: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("universalInbox", {
      ...args, status: "new", forwardedAt: undefined, repliedAt: undefined,
      replyContent: undefined, receivedAt: new Date().toISOString(),
    });
    return { success: true, messageId: id };
  },
});

export const getInboxMessages = query({
  args: { sessionToken: v.string(), status: v.optional(v.string()), platform: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, status, platform }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    let messages = await ctx.db.query("universalInbox").collect();
    if (status) messages = messages.filter((m) => m.status === status);
    if (platform) messages = messages.filter((m) => m.platform === platform);
    return messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  },
});

export const getUnreadCount = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    const all = await ctx.db.query("universalInbox").collect();
    return {
      total: all.length,
      unread: all.filter((m) => m.status === "new").length,
      highPriority: all.filter((m) => m.status === "new" && m.priority === "high").length,
      byPlatform: {
        facebook: all.filter((m) => m.platform === "facebook" && m.status === "new").length,
        instagram: all.filter((m) => m.platform === "instagram" && m.status === "new").length,
        email: all.filter((m) => m.platform === "email" && m.status === "new").length,
      },
    };
  },
});

export const markRead = mutation({
  args: { sessionToken: v.string(), messageId: v.id("universalInbox") },
  handler: async (ctx, { sessionToken, messageId }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    await ctx.db.patch(messageId, { status: "read" });
    return { success: true };
  },
});

export const markForwarded = mutation({
  args: { sessionToken: v.string(), messageId: v.id("universalInbox") },
  handler: async (ctx, { sessionToken, messageId }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    await ctx.db.patch(messageId, { forwarded: true, forwardedAt: new Date().toISOString() });
    return { success: true };
  },
});

export const recordReply = mutation({
  args: { sessionToken: v.string(), messageId: v.id("universalInbox"), replyContent: v.string() },
  handler: async (ctx, { sessionToken, messageId, replyContent }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    await ctx.db.patch(messageId, {
      replied: true, repliedAt: new Date().toISOString(), replyContent, status: "replied",
    });
    return { success: true };
  },
});

export const getInboxStats = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    const all = await ctx.db.query("universalInbox").collect();
    const today = new Date().toISOString().split("T")[0];
    return {
      total: all.length,
      new: all.filter((m) => m.status === "new").length,
      read: all.filter((m) => m.status === "read").length,
      replied: all.filter((m) => m.status === "replied").length,
      forwarded: all.filter((m) => m.forwarded).length,
      today: all.filter((m) => m.receivedAt.startsWith(today)).length,
      byPlatform: {
        facebook: all.filter((m) => m.platform === "facebook").length,
        instagram: all.filter((m) => m.platform === "instagram").length,
        email: all.filter((m) => m.platform === "email").length,
      },
      highPriorityUnread: all.filter((m) => m.status === "new" && m.priority === "high").length,
    };
  },
});

export const sendAdminMessage = mutation({
  args: {
    sessionToken: v.string(), recipientId: v.string(), subject: v.string(), body: v.string(),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, { sessionToken, recipientId, subject, body, priority }) => {
    const principal = await requireSuperAdminSession(ctx, sessionToken);
    const id = await ctx.db.insert("universalInbox", {
      platform: "admin", senderName: principal.name || "Interplanetary Fund Admin",
      senderId: String(principal._id), recipientId, subject, body,
      platformMessageId: `admin_msg_${Date.now()}`, platformUrl: undefined,
      groupId: undefined, groupName: undefined, campaignId: undefined,
      status: "new", forwarded: false, replied: false, priority: priority ?? "normal",
      receivedAt: new Date().toISOString(),
    });
    return { success: true, messageId: id };
  },
});

export const getAdminMessages = query({
  args: { sessionToken: v.string(), recipientId: v.optional(v.string()) },
  handler: async (ctx, { sessionToken, recipientId }) => {
    await requireSuperAdminSession(ctx, sessionToken);
    let messages = await ctx.db.query("universalInbox")
      .filter((q: any) => q.eq(q.field("platform"), "admin")).collect();
    if (recipientId) messages = messages.filter((m) => m.recipientId === recipientId);
    return messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  },
});
