/*
 * Interplanetary Fund — Canonical Outreach Control & Dispatch Engine
 * Issue #126
 *
 * This module is the single backend source of truth for the two outreach modes:
 *   1. Platform Outreach — promotes active campaigns and Interplanetary Fund.
 *   2. Subscriber Outreach — additional outreach for users with an ACTIVE,
 *      qualifying subscription.
 *
 * It intentionally uses existing tables (adminSettings, userProfiles,
 * distributedPosts, agentActivityLog) so it can be introduced without a
 * destructive schema migration. Subscription activity is stored server-side
 * under adminSettings key `subscription:<userId>` until billing owns a native
 * subscription-status table.
 *
 * External success is NEVER inferred from a queue mutation. A post is only
 * marked posted after the provider returns a concrete external identifier.
 */

import { action, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAdminSession, requireSuperAdminSession } from "./adminUsers";

const CONTROL_KEY = "outreach.control.v1";
const EMERGENCY_STOP_KEY = "outreach.emergency_stop";
const SUBSCRIPTION_PREFIX = "subscription:";

const DEFAULT_CONTROL = {
  platformOutreachEnabled: false,
  subscriberOutreachEnabled: false,
  browserbaseEnabled: true,
  directApiEnabled: true,
  allowedPlatforms: ["facebook", "bluesky", "instagram"],
  maxDispatchesPerCycle: 10,
  quietHoursStart: 22,
  quietHoursEnd: 7,
  retryLimit: 3,
};

type ControlState = typeof DEFAULT_CONTROL;

type SubscriptionState = {
  status: "active" | "inactive" | "expired" | "canceled";
  qualifiesForOutreach: boolean;
  expiresAt?: string;
  source?: string;
  updatedAt: string;
};

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return { ...fallback, ...JSON.parse(value) } as T;
  } catch {
    return fallback;
  }
}

function inQuietHours(hour: number, start: number, end: number) {
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

async function getSetting(ctx: any, key: string) {
  return await ctx.db.query("adminSettings").withIndex("byKey", (q: any) => q.eq("key", key)).first();
}

async function upsertSetting(ctx: any, key: string, value: string) {
  const current = await getSetting(ctx, key);
  const updatedAt = new Date().toISOString();
  if (current) await ctx.db.patch(current._id, { value, updatedAt });
  else await ctx.db.insert("adminSettings", { key, value, updatedAt });
}

async function readControl(ctx: any): Promise<ControlState> {
  const row = await getSetting(ctx, CONTROL_KEY);
  return parseJson<ControlState>(row?.value, DEFAULT_CONTROL);
}

async function emergencyStopped(ctx: any) {
  const row = await getSetting(ctx, EMERGENCY_STOP_KEY);
  return row?.value === "true";
}

async function readSubscription(ctx: any, userId: string): Promise<SubscriptionState | null> {
  const row = await getSetting(ctx, `${SUBSCRIPTION_PREFIX}${userId}`);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as SubscriptionState;
  } catch {
    return null;
  }
}

function subscriptionIsActive(s: SubscriptionState | null) {
  if (!s || s.status !== "active" || !s.qualifiesForOutreach) return false;
  if (!s.expiresAt) return true;
  const expiry = Date.parse(s.expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

export const getControlState = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    return {
      ...(await readControl(ctx)),
      emergencyStop: await emergencyStopped(ctx),
    };
  },
});

export const updateControlState = mutation({
  args: {
    sessionToken: v.string(),
    platformOutreachEnabled: v.boolean(),
    subscriberOutreachEnabled: v.boolean(),
    browserbaseEnabled: v.boolean(),
    directApiEnabled: v.boolean(),
    allowedPlatforms: v.array(v.string()),
    maxDispatchesPerCycle: v.number(),
    quietHoursStart: v.number(),
    quietHoursEnd: v.number(),
    retryLimit: v.number(),
  },
  handler: async (ctx, args) => {
    const principal = await requireSuperAdminSession(ctx, args.sessionToken);
    const next: ControlState = {
      platformOutreachEnabled: args.platformOutreachEnabled,
      subscriberOutreachEnabled: args.subscriberOutreachEnabled,
      browserbaseEnabled: args.browserbaseEnabled,
      directApiEnabled: args.directApiEnabled,
      allowedPlatforms: [...new Set(args.allowedPlatforms.map((p) => p.toLowerCase().trim()).filter(Boolean))],
      maxDispatchesPerCycle: Math.max(1, Math.min(100, Math.floor(args.maxDispatchesPerCycle))),
      quietHoursStart: Math.max(0, Math.min(23, Math.floor(args.quietHoursStart))),
      quietHoursEnd: Math.max(0, Math.min(23, Math.floor(args.quietHoursEnd))),
      retryLimit: Math.max(0, Math.min(10, Math.floor(args.retryLimit))),
    };
    await upsertSetting(ctx, CONTROL_KEY, JSON.stringify(next));
    await ctx.db.insert("agentActivityLog", {
      agentName: "Outreach Control",
      action: "settings_updated",
      category: "communications",
      description: `Outreach settings updated by ${principal.name}`,
      metadata: JSON.stringify({ ...next, actorUserId: principal.userId }),
      creditCost: 0,
      timestamp: new Date().toISOString(),
    });
    return { success: true, ...next };
  },
});

export const setEmergencyStop = mutation({
  args: { sessionToken: v.string(), stopped: v.boolean() },
  handler: async (ctx, { sessionToken, stopped }) => {
    const principal = await requireSuperAdminSession(ctx, sessionToken);
    await upsertSetting(ctx, EMERGENCY_STOP_KEY, stopped ? "true" : "false");
    await ctx.db.insert("agentActivityLog", {
      agentName: "Outreach Control",
      action: stopped ? "emergency_stop_enabled" : "emergency_stop_cleared",
      category: "communications",
      description: `${stopped ? "Emergency stop enabled" : "Emergency stop cleared"} by ${principal.name}`,
      metadata: JSON.stringify({ actorUserId: principal.userId }),
      creditCost: 0,
      timestamp: new Date().toISOString(),
    });
    return { success: true, emergencyStop: stopped };
  },
});

// Billing/admin integration writes authoritative subscription activity here.
// Outreach toggles never alter subscriptionTier or subscription state.
export const setSubscriptionState = mutation({
  args: {
    sessionToken: v.string(),
    userId: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("expired"), v.literal("canceled")),
    qualifiesForOutreach: v.boolean(),
    expiresAt: v.optional(v.string()),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const principal = await requireAdminSession(ctx, args.sessionToken, "users");
    const state: SubscriptionState = {
      status: args.status,
      qualifiesForOutreach: args.qualifiesForOutreach,
      expiresAt: args.expiresAt,
      source: args.source ?? "admin",
      updatedAt: new Date().toISOString(),
    };
    await upsertSetting(ctx, `${SUBSCRIPTION_PREFIX}${args.userId}`, JSON.stringify(state));
    await ctx.db.insert("agentActivityLog", {
      agentName: "Subscriber Outreach Agent",
      action: "subscription_state_updated",
      category: "communications",
      description: `Subscription outreach eligibility updated for ${args.userId}`,
      metadata: JSON.stringify({ actorUserId: principal.userId, userId: args.userId, ...state }),
      creditCost: 0,
      timestamp: state.updatedAt,
    });
    return { success: true, userId: args.userId, ...state };
  },
});

export const getSubscriberEligibility = query({
  args: { sessionToken: v.string(), userId: v.string() },
  handler: async (ctx, { sessionToken, userId }) => {
    await requireAdminSession(ctx, sessionToken, "users");
    const profile = await ctx.db.query("userProfiles").withIndex("byUserId", (q: any) => q.eq("userId", userId)).first();
    const subscription = await readSubscription(ctx, userId);
    return {
      userId,
      subscriptionTier: profile?.subscriptionTier ?? "standard",
      subscription,
      eligible: Boolean(profile && profile.subscriptionTier === "campaign_manager" && subscriptionIsActive(subscription)),
    };
  },
});

export const browserbaseHealth = action({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    // Authorization is checked by a mutation because actions do not expose db.
    await ctx.runMutation(internal.outreachControl.assertAdminForAction, { sessionToken });
    const apiKey = process.env.BROWSERBASE_API_KEY || "";
    const projectId = process.env.BROWSERBASE_PROJECT_ID || "";
    if (!apiKey || !projectId) return { healthy: false, reason: "missing_credentials" };
    try {
      const response = await fetch("https://api.browserbase.com/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Browserbase-API-Key": apiKey },
        body: JSON.stringify({ projectId, keepAlive: false }),
      });
      if (!response.ok) return { healthy: false, reason: `http_${response.status}` };
      const data: any = await response.json();
      return { healthy: Boolean(data?.id), sessionCreated: Boolean(data?.id), sessionId: data?.id ?? null };
    } catch (error) {
      return { healthy: false, reason: String(error) };
    }
  },
});

export const assertAdminForAction = internalMutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "content");
    return true;
  },
});

// Scheduled dispatcher. It never marks external success itself. It selects
// eligible pending posts and schedules provider actions. Unsupported or
// unconfigured channels fail closed and remain auditable.
export const runDispatchCycle = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await emergencyStopped(ctx)) return { skipped: true, reason: "emergency_stop" };
    const control = await readControl(ctx);
    if (!control.platformOutreachEnabled && !control.subscriberOutreachEnabled) {
      return { skipped: true, reason: "both_agents_disabled" };
    }

    const pacificHour = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles", hour: "2-digit", hour12: false,
    }).format(new Date()));
    if (inQuietHours(pacificHour, control.quietHoursStart, control.quietHoursEnd)) {
      return { skipped: true, reason: "quiet_hours" };
    }

    const pending = await ctx.db.query("distributedPosts")
      .withIndex("byStatus", (q: any) => q.eq("status", "pending"))
      .take(control.maxDispatchesPerCycle * 3);

    let scheduled = 0;
    const decisions: any[] = [];

    for (const post of pending) {
      if (scheduled >= control.maxDispatchesPerCycle) break;
      const platform = post.platform.toLowerCase();
      if (!control.allowedPlatforms.includes(platform)) continue;

      // Resolve a user-created campaign when possible.
      const userCampaign = await ctx.db.get(post.campaignId as any).catch(() => null);
      let subscriberEligible = false;
      let userId: string | null = null;
      if (userCampaign && typeof userCampaign === "object" && "userId" in userCampaign) {
        userId = String((userCampaign as any).userId);
        const profile = await ctx.db.query("userProfiles").withIndex("byUserId", (q: any) => q.eq("userId", userId)).first();
        const subscription = await readSubscription(ctx, userId);
        subscriberEligible = Boolean(profile?.subscriptionTier === "campaign_manager" && subscriptionIsActive(subscription));
      }

      const mode = control.subscriberOutreachEnabled && subscriberEligible
        ? "subscriber"
        : control.platformOutreachEnabled ? "platform" : null;
      if (!mode) continue;

      // Idempotency: do not schedule the same post while a previous dispatch is in-flight.
      if (post.status !== "pending") continue;
      await ctx.db.patch(post._id, { status: "dispatching", error: undefined });
      await ctx.scheduler.runAfter(0, internal.outreachControl.publishPost, {
        postId: String(post._id), mode, userId: userId ?? undefined,
      });
      scheduled++;
      decisions.push({ postId: String(post._id), platform, mode, userId });
    }

    await ctx.db.insert("agentActivityLog", {
      agentName: "Outreach Dispatcher",
      action: "dispatch_cycle",
      category: "communications",
      description: `Scheduled ${scheduled} externally-verifiable outreach attempts`,
      metadata: JSON.stringify(decisions),
      creditCost: 0,
      timestamp: new Date().toISOString(),
    });
    return { scheduled, decisions };
  },
});

export const publishPost = internalAction({
  args: { postId: v.string(), mode: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const prepared: any = await ctx.runMutation(internal.outreachControl.preparePublish, args);
    if (!prepared?.ok) return prepared;

    let result: any = { ok: false, reason: "unsupported_platform" };
    if (prepared.platform === "bluesky") {
      result = await publishToBluesky(prepared.content);
    } else {
      // Browserbase can be health-checked and used for research today, but this
      // repository does not contain a trustworthy CDP/Stagehand posting worker.
      // Do not fabricate success for Facebook/Instagram or other browser-only paths.
      result = { ok: false, reason: "browser_publisher_not_configured" };
    }

    await ctx.runMutation(internal.outreachControl.finishPublish, {
      postId: args.postId,
      mode: args.mode,
      userId: args.userId,
      ok: Boolean(result.ok),
      externalId: result.externalId,
      postUrl: result.postUrl,
      publisher: result.publisher,
      error: result.ok ? undefined : String(result.reason || "publish_failed"),
    });
    return result;
  },
});

export const preparePublish = internalMutation({
  args: { postId: v.string(), mode: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (await emergencyStopped(ctx)) return { ok: false, reason: "emergency_stop" };
    const control = await readControl(ctx);
    if (args.mode === "platform" && !control.platformOutreachEnabled) return { ok: false, reason: "platform_agent_disabled" };
    if (args.mode === "subscriber") {
      if (!control.subscriberOutreachEnabled || !args.userId) return { ok: false, reason: "subscriber_agent_disabled" };
      const profile = await ctx.db.query("userProfiles").withIndex("byUserId", (q: any) => q.eq("userId", args.userId!)).first();
      const subscription = await readSubscription(ctx, args.userId);
      if (!profile || profile.subscriptionTier !== "campaign_manager" || !subscriptionIsActive(subscription)) {
        return { ok: false, reason: "subscription_not_active" };
      }
    }
    const post: any = await ctx.db.get(args.postId as any);
    if (!post || post.status !== "dispatching") return { ok: false, reason: "post_not_dispatching" };
    if (!control.allowedPlatforms.includes(String(post.platform).toLowerCase())) return { ok: false, reason: "platform_not_allowed" };
    return { ok: true, platform: String(post.platform).toLowerCase(), content: post.content, campaignId: post.campaignId };
  },
});

export const finishPublish = internalMutation({
  args: {
    postId: v.string(), mode: v.string(), userId: v.optional(v.string()), ok: v.boolean(),
    externalId: v.optional(v.string()), postUrl: v.optional(v.string()), publisher: v.optional(v.string()), error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const post: any = await ctx.db.get(args.postId as any);
    if (!post) return { ok: false, reason: "post_not_found" };
    const now = new Date().toISOString();
    if (args.ok && args.externalId) {
      await ctx.db.patch(args.postId as any, {
        status: "posted",
        postUrl: args.postUrl,
        postedAt: now,
        error: undefined,
      });
    } else {
      // Failure remains explicit. Nothing is ever falsely marked posted.
      await ctx.db.patch(args.postId as any, {
        status: "failed",
        error: args.error || "publish_failed_without_external_evidence",
      });
    }
    await ctx.db.insert("agentActivityLog", {
      agentName: args.mode === "subscriber" ? "Subscriber Outreach Agent" : "Platform Outreach Agent",
      action: args.ok && args.externalId ? "external_post_verified" : "external_post_failed",
      category: "communications",
      description: args.ok && args.externalId
        ? `Verified external ${post.platform} post ${args.externalId}`
        : `Failed ${post.platform} outreach: ${args.error || "unknown error"}`,
      metadata: JSON.stringify({
        postId: args.postId, campaignId: post.campaignId, userId: args.userId,
        platform: post.platform, mode: args.mode, externalId: args.externalId,
        postUrl: args.postUrl, publisher: args.publisher,
      }),
      creditCost: 0,
      timestamp: now,
    });
    return { ok: args.ok && Boolean(args.externalId) };
  },
});

async function publishToBluesky(text: string) {
  const identifier = process.env.BLUESKY_IDENTIFIER || "";
  const password = process.env.BLUESKY_APP_PASSWORD || "";
  if (!identifier || !password) return { ok: false, reason: "bluesky_credentials_missing" };

  try {
    const auth = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!auth.ok) return { ok: false, reason: `bluesky_auth_${auth.status}` };
    const session: any = await auth.json();
    if (!session?.accessJwt || !session?.did) return { ok: false, reason: "bluesky_auth_invalid" };

    const createdAt = new Date().toISOString();
    const create = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessJwt}` },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: { $type: "app.bsky.feed.post", text: text.slice(0, 300), createdAt },
      }),
    });
    if (!create.ok) return { ok: false, reason: `bluesky_post_${create.status}` };
    const data: any = await create.json();
    if (!data?.uri) return { ok: false, reason: "bluesky_missing_external_id" };
    const rkey = String(data.uri).split("/").pop();
    return {
      ok: true,
      externalId: data.uri,
      postUrl: rkey ? `https://bsky.app/profile/${session.did}/post/${rkey}` : undefined,
      publisher: "bluesky_api",
    };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}
