/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSuperAdmin } from "./security";

// =====================================================
// UNIVERSAL INBOX — Central message hub
// All platform messages (Facebook, Instagram, etc.)
// route here, then forward to Michelle's email
// =====================================================

// Record an incoming message from any platform
export const recordMessage = mutation({
  args: {
    platform: v.string(),          // "facebook", "instagram", "email", etc.
    senderName: v.string(),         // name of the person who sent the message
    senderId: v.string(),          // platform-specific sender ID
    recipientId: v.string(),        // platform-specific recipient (our account)
    subject: v.optional(v.string()), // optional subject line
    body: v.string(),               // message content
    platformMessageId: v.string(), // original message ID from the platform
    platformUrl: v.optional(v.string()), // link to the original message/thread
    groupId: v.optional(v.string()), // if from a group
    groupName: v.optional(v.string()),
    campaignId: v.optional(v.string()),
    forwarded: v.boolean(),         // whether email forwarding was sent
    replied: v.boolean(),           // whether agent replied
    priority: v.string(),          // "high", "normal", "low"
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("universalInbox", {
      ...args,
      status: "new",
      forwardedAt: undefined,
      repliedAt: undefined,
      replyContent: undefined,
      receivedAt: new Date().toISOString(),
    });
    return { success: true, messageId: id };
  },
});

// Get all inbox messages (for dashboard)
export const getInboxMessages = query({
  args: {
    status: v.optional(v.string()),
    platform: v.optional(v.string()),
  },
  handler: async (ctx, { status, platform }) => {
    let messages = await ctx.db.query("universalInbox").collect();

    if (status) {
      messages = messages.filter((m) => m.status === status);
    }
    if (platform) {
      messages = messages.filter((m) => m.platform === platform);
    }

    return messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  },
});

// Get unread count
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
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

// Mark message as read
export const markRead = mutation({
  args: { messageId: v.id("universalInbox") },
  handler: async (ctx, { messageId }) => {
    await ctx.db.patch(messageId, { status: "read" });
    return { success: true };
  },
});

// Mark message as forwarded to email
export const markForwarded = mutation({
  args: { messageId: v.id("universalInbox") },
  handler: async (ctx, { messageId }) => {
    await ctx.db.patch(messageId, {
      forwarded: true,
      forwardedAt: new Date().toISOString(),
    });
    return { success: true };
  },
});

// Record agent reply to a message
export const recordReply = mutation({
  args: {
    messageId: v.id("universalInbox"),
    replyContent: v.string(),
  },
  handler: async (ctx, { messageId, replyContent }) => {
    await ctx.db.patch(messageId, {
      replied: true,
      repliedAt: new Date().toISOString(),
      replyContent,
      status: "replied",
    });
    return { success: true };
  },
});

// Get inbox stats for dashboard
export const getInboxStats = query({
  args: {},
  handler: async (ctx) => {
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


// =====================================================
// ADMIN MESSAGING — Super admin sends messages to users
// =====================================================

// Admin sends a message to a user via universal inbox
export const sendAdminMessage = mutation({
  args: {
    adminPin: v.string(),
    recipientId: v.string(),           // userId of recipient
    subject: v.string(),
    body: v.string(),
    priority: v.optional(v.string()),   // "high", "normal", "low"
  },
  handler: async (ctx, { adminPin, recipientId, subject, body, priority }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    const id = await ctx.db.insert("universalInbox", {
      platform: "admin",
      senderName: "Interplanetary Fund Admin",
      senderId: "super_admin",
      recipientId,
      subject,
      body,
      platformMessageId: `admin_msg_${Date.now()}`,
      platformUrl: undefined,
      groupId: undefined,
      groupName: undefined,
      campaignId: undefined,
      status: "new",
      forwarded: false,
      replied: false,
      priority: priority ?? "normal",
      receivedAt: new Date().toISOString(),
    });
    
    return { success: true, messageId: id };
  },
});

// Get admin-sent messages
export const getAdminMessages = query({
  args: { adminPin: v.string(), recipientId: v.optional(v.string()) },
  handler: async (ctx, { adminPin, recipientId }) => {
    await requireSuperAdmin(ctx, adminPin);
    
    let messages = await ctx.db
      .query("universalInbox")
      .filter((q: any) => q.eq("platform", "admin"))
      .collect();
    
    if (recipientId) {
      messages = messages.filter(m => m.recipientId === recipientId);
    }
    
    return messages.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  },
});