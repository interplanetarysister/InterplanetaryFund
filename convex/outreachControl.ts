/*
 * Interplanetary Fund — Canonical Outreach Control & Dispatch Engine
 * Issue #126
 *
 * Single source of truth for:
 *   1. Platform Outreach — campaigns + Interplanetary Fund promotion.
 *   2. Subscriber Outreach — additional outreach for active qualifying users.
 *
 * External success is never inferred from a queue mutation. A post becomes
 * `posted` only after a provider/API/browser publisher returns durable evidence.
 */

import { action, internalAction, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireAdminSession, requireSuperAdminSession } from "./adminUsers";

const CONTROL_KEY = "outreach.control.v1";
const EMERGENCY_STOP_KEY = "outreach.emergency_stop";
const SUBSCRIPTION_PREFIX = "subscription:";
const SUBSCRIPTION_EVENT_PREFIX = "subscription_event:";
const FB_RESERVATION_PREFIX = "outreach.fb_reservation:";
const PLATFORM_CAMPAIGN_ID = "__interplanetary_fund_platform__";
const SOCIAL_PLATFORMS = ["facebook", "instagram", "bluesky"] as const;
const FB_COOLDOWN_MS = 48 * 60 * 60 * 1000;
const FB_RESERVATION_MS = 10 * 60 * 1000;
const FB_MAX_PER_DAY = 3;
const DUPLICATE_THRESHOLD = 0.8;

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
type SubscriptionStatus = "active" | "inactive" | "expired" | "canceled";
type SubscriptionState = {
  status: SubscriptionStatus;
  qualifiesForOutreach: boolean;
  expiresAt?: string;
  source?: string;
  updatedAt: string;
};
type CampaignResolution = {
  kind: "user" | "monitored" | "platform";
  id: string;
  userId?: string;
  title: string;
  status: string;
  outreachEnabled: boolean;
  goalAmount: number;
  raisedAmount: number;
  coverImageUrl?: string;
};
type FacebookReservation = {
  postId: string;
  campaignId: string;
  content: string;
  expiresAt: number;
};

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return { ...fallback, ...JSON.parse(value) } as T; }
  catch { return fallback; }
}

function inQuietHours(hour: number, start: number, end: number) {
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

function parseAttempt(error?: string) {
  if (!error) return 0;
  const match = /^attempt:(\d+)\|/.exec(error);
  return match ? Number(match[1]) : 0;
}

function similarity(a: string, b: string) {
  const aWords = new Set(a.toLowerCase().replace(/\s+/g, " ").trim().split(" ").filter(Boolean));
  const bWords = new Set(b.toLowerCase().replace(/\s+/g, " ").trim().split(" ").filter(Boolean));
  let common = 0;
  for (const word of aWords) if (bWords.has(word)) common++;
  return common / Math.max(aWords.size, bWords.size, 1);
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
  try { return JSON.parse(row.value) as SubscriptionState; }
  catch { return null; }
}

function subscriptionIsActive(state: SubscriptionState | null) {
  if (!state || state.status !== "active" || !state.qualifiesForOutreach) return false;
  if (!state.expiresAt) return true;
  const expiry = Date.parse(state.expiresAt);
  return Number.isFinite(expiry) && expiry > Date.now();
}

async function writeSubscription(ctx: any, userId: string, state: SubscriptionState) {
  await upsertSetting(ctx, `${SUBSCRIPTION_PREFIX}${userId}`, JSON.stringify(state));
  const profile = await ctx.db.query("userProfiles").withIndex("byUserId", (q: any) => q.eq("userId", userId)).first();
  if (profile) {
    await ctx.db.patch(profile._id, {
      subscriptionTier: subscriptionIsActive(state) ? "campaign_manager" : "standard",
      updatedAt: state.updatedAt,
    });
  }
}

async function userSubscriberEligible(ctx: any, userId: string) {
  const profile = await ctx.db.query("userProfiles").withIndex("byUserId", (q: any) => q.eq("userId", userId)).first();
  const subscription = await readSubscription(ctx, userId);
  return Boolean(profile?.aiCrossPostingEnabled && subscriptionIsActive(subscription));
}

async function resolveCampaign(ctx: any, campaignId: string): Promise<CampaignResolution | null> {
  if (campaignId === PLATFORM_CAMPAIGN_ID) {
    return { kind: "platform", id: PLATFORM_CAMPAIGN_ID, title: "Interplanetary Fund", status: "active", outreachEnabled: true, goalAmount: 0, raisedAmount: 0 };
  }
  try {
    const doc: any = await ctx.db.get(campaignId as any);
    if (doc && typeof doc === "object" && "userId" in doc && "outreachEnabled" in doc) {
      return {
        kind: "user", id: String(doc._id), userId: String(doc.userId), title: String(doc.title || "Campaign"),
        status: String(doc.status || "draft"), outreachEnabled: doc.outreachEnabled === true,
        goalAmount: Number(doc.goalAmount || 0), raisedAmount: Number(doc.raisedAmount || 0), coverImageUrl: doc.coverImageUrl,
      };
    }
  } catch { /* external IF id */ }
  const monitored: any = await ctx.db.query("monitoredCampaigns").withIndex("byIfId", (q: any) => q.eq("ifCampaignId", campaignId)).first();
  if (!monitored) return null;
  return {
    kind: "monitored", id: monitored.ifCampaignId, title: String(monitored.title || "Campaign"),
    status: String(monitored.status || "draft"), outreachEnabled: monitored.outreachEnabled === true,
    goalAmount: Number(monitored.goalAmount || 0), raisedAmount: Number(monitored.raisedAmount || 0), coverImageUrl: monitored.coverImageUrl,
  };
}

async function clearFacebookReservation(ctx: any, groupDocId?: string, postId?: string) {
  if (!groupDocId) return;
  const row = await getSetting(ctx, `${FB_RESERVATION_PREFIX}${groupDocId}`);
  if (!row) return;
  if (postId) {
    try {
      const reservation = JSON.parse(row.value) as FacebookReservation;
      if (reservation.postId !== postId) return;
    } catch { /* invalid reservation can be cleared */ }
  }
  await ctx.db.delete(row._id);
}

async function selectAndReserveFacebookTarget(ctx: any, campaignId: string, content: string, postId: string) {
  const now = Date.now();
  const today = new Date().toISOString().split("T")[0];
  const campaignPosts = await ctx.db.query("facebookGroupPosts").withIndex("byCampaignId", (q: any) => q.eq("campaignId", campaignId)).collect();
  const postedToday = campaignPosts.filter((post: any) => post.postStatus === "posted" && post.postedAt?.startsWith(today));

  const allSettings = await ctx.db.query("adminSettings").collect();
  const activeReservations = allSettings.flatMap((row: any) => {
    if (!row.key.startsWith(FB_RESERVATION_PREFIX)) return [];
    try {
      const reservation = JSON.parse(row.value) as FacebookReservation;
      return reservation.expiresAt > now ? [{ row, reservation }] : [];
    } catch { return []; }
  });
  const campaignReservations = activeReservations.filter(({ reservation }) => reservation.campaignId === campaignId);
  if (postedToday.length + campaignReservations.length >= FB_MAX_PER_DAY) {
    return { ok: false, reason: "facebook_daily_limit", defer: true };
  }

  const recent = campaignPosts.filter((post: any) => post.postStatus === "posted").sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 5);
  if (recent.some((post: any) => similarity(content, post.postContent) >= DUPLICATE_THRESHOLD) ||
      campaignReservations.some(({ reservation }) => similarity(content, reservation.content) >= DUPLICATE_THRESHOLD)) {
    return { ok: false, reason: "facebook_duplicate_content", defer: false };
  }

  const blocklist = await ctx.db.query("spamBlocklist").collect();
  const blocked = new Set(blocklist.filter((entry: any) => entry.platform.toLowerCase() === "facebook").map((entry: any) => entry.identifier));
  const reservedGroups = new Set(activeReservations.map(({ row }) => row.key.slice(FB_RESERVATION_PREFIX.length)));
  const groups = await ctx.db.query("facebookGroups").withIndex("byJoinStatus", (q: any) => q.eq("joinStatus", "joined")).collect();
  const eligible = groups.filter((group: any) => {
    if (!group.canPost) return false;
    if (campaignId !== PLATFORM_CAMPAIGN_ID && group.campaignId !== campaignId) return false;
    if (blocked.has(group.groupFacebookId) || blocked.has(group.groupUrl) || blocked.has(String(group._id))) return false;
    if (reservedGroups.has(String(group._id))) return false;
    if (group.lastPostedAt && now - Date.parse(group.lastPostedAt) < FB_COOLDOWN_MS) return false;
    return true;
  }).sort((a: any, b: any) => b.relevanceScore - a.relevanceScore);
  const group: any = eligible[0];
  if (!group) return { ok: false, reason: "facebook_no_eligible_group", defer: true };

  await upsertSetting(ctx, `${FB_RESERVATION_PREFIX}${String(group._id)}`, JSON.stringify({
    postId,
    campaignId,
    content,
    expiresAt: now + FB_RESERVATION_MS,
  } satisfies FacebookReservation));
  return {
    ok: true,
    groupDocId: String(group._id),
    groupFacebookId: group.groupFacebookId,
    groupName: group.groupName,
    targetUrl: group.groupUrl,
  };
}

export const getControlState = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await requireAdminSession(ctx, sessionToken, "campaigns");
    return { ...(await readControl(ctx)), emergencyStop: await emergencyStopped(ctx) };
  },
});

export const updateControlState = mutation({
  args: {
    sessionToken: v.string(), platformOutreachEnabled: v.boolean(), subscriberOutreachEnabled: v.boolean(),
    browserbaseEnabled: v.boolean(), directApiEnabled: v.boolean(), allowedPlatforms: v.array(v.string()),
    maxDispatchesPerCycle: v.number(), quietHoursStart: v.number(), quietHoursEnd: v.number(), retryLimit: v.number(),
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
      agentName: "Outreach Control", action: "settings_updated", category: "communications",
      description: `Outreach settings updated by ${principal.name}`, metadata: JSON.stringify({ ...next, actorUserId: principal.userId }),
      creditCost: 0, timestamp: new Date().toISOString(),
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
      agentName: "Outreach Control", action: stopped ? "emergency_stop_enabled" : "emergency_stop_cleared", category: "communications",
      description: `${stopped ? "Emergency stop enabled" : "Emergency stop cleared"} by ${principal.name}`,
      metadata: JSON.stringify({ actorUserId: principal.userId }), creditCost: 0, timestamp: new Date().toISOString(),
    });
    return { success: true, emergencyStop: stopped };
  },
});

export const setSubscriptionState = mutation({
  args: {
    sessionToken: v.string(), userId: v.string(),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("expired"), v.literal("canceled")),
    qualifiesForOutreach: v.boolean(), expiresAt: v.optional(v.string()), source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const principal = await requireSuperAdminSession(ctx, args.sessionToken);
    const state: SubscriptionState = {
      status: args.status, qualifiesForOutreach: args.qualifiesForOutreach, expiresAt: args.expiresAt,
      source: args.source ?? "admin", updatedAt: new Date().toISOString(),
    };
    await writeSubscription(ctx, args.userId, state);
    await ctx.db.insert("agentActivityLog", {
      agentName: "Subscriber Outreach Agent", action: "subscription_state_updated", category: "communications",
      description: `Subscription state updated for ${args.userId}`,
      metadata: JSON.stringify({ actorUserId: principal.userId, userId: args.userId, ...state }), creditCost: 0, timestamp: state.updatedAt,
    });
    return { success: true, userId: args.userId, ...state };
  },
});

export const syncSubscriptionFromProvider = internalMutation({
  args: { eventId: v.string(), userId: v.string(), status: v.string(), qualifiesForOutreach: v.boolean(), expiresAt: v.optional(v.string()), source: v.string() },
  handler: async (ctx, args) => {
    const seenKey = `${SUBSCRIPTION_EVENT_PREFIX}${args.source}:${args.eventId}`;
    if (await getSetting(ctx, seenKey)) return { success: true, duplicate: true };
    const allowed: SubscriptionStatus[] = ["active", "inactive", "expired", "canceled"];
    const status: SubscriptionStatus = allowed.includes(args.status as SubscriptionStatus) ? args.status as SubscriptionStatus : "inactive";
    const state: SubscriptionState = { status, qualifiesForOutreach: args.qualifiesForOutreach, expiresAt: args.expiresAt, source: args.source, updatedAt: new Date().toISOString() };
    await writeSubscription(ctx, args.userId, state);
    await upsertSetting(ctx, seenKey, state.updatedAt);
    await ctx.db.insert("agentActivityLog", {
      agentName: "Subscriber Outreach Agent", action: "subscription_provider_sync", category: "communications",
      description: `${args.source} subscription event synchronized for ${args.userId}`,
      metadata: JSON.stringify({ eventId: args.eventId, userId: args.userId, ...state }), creditCost: 0, timestamp: state.updatedAt,
    });
    return { success: true, duplicate: false, state };
  },
});

export const getSubscriberEligibility = query({
  args: { sessionToken: v.string(), userId: v.string() },
  handler: async (ctx, { sessionToken, userId }) => {
    await requireAdminSession(ctx, sessionToken, "campaigns");
    const profile = await ctx.db.query("userProfiles").withIndex("byUserId", (q: any) => q.eq("userId", userId)).first();
    const subscription = await readSubscription(ctx, userId);
    return { userId, subscriptionTier: profile?.subscriptionTier ?? "standard", userOutreachPermission: profile?.aiCrossPostingEnabled ?? false, subscription, eligible: Boolean(profile?.aiCrossPostingEnabled && subscriptionIsActive(subscription)) };
  },
});

export const assertAdminForAction = internalMutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => { await requireAdminSession(ctx, sessionToken, "campaigns"); return true; },
});

export const browserbaseHealth = action({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    await ctx.runMutation(internal.outreachControl.assertAdminForAction, { sessionToken });
    const facebook: any = await ctx.runAction(internal.outreachBrowserPublisher.healthCheck, { platform: "facebook" });
    const instagram: any = await ctx.runAction(internal.outreachBrowserPublisher.healthCheck, { platform: "instagram" });
    return { healthy: Boolean(facebook?.healthy || instagram?.healthy), facebook, instagram, checkedAt: new Date().toISOString() };
  },
});

export const runDispatchNow = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    const principal = await requireSuperAdminSession(ctx, sessionToken);
    await ctx.scheduler.runAfter(0, internal.outreachControl.runDispatchCycle, {});
    await ctx.db.insert("agentActivityLog", {
      agentName: "Outreach Dispatcher", action: "manual_dispatch_requested", category: "communications",
      description: `Manual outreach dispatch requested by ${principal.name}`, metadata: JSON.stringify({ actorUserId: principal.userId }),
      creditCost: 0, timestamp: new Date().toISOString(),
    });
    return { success: true };
  },
});

async function insertPostIfMissing(ctx: any, existing: any[], args: { campaignId: string; campaignTitle: string; platform: string; postType: string; content: string; imageUrl?: string; link?: string; }) {
  const duplicate = existing.some((post: any) => post.campaignId === args.campaignId && post.platform === args.platform && post.postType === args.postType && ["pending", "dispatching", "posted", "verification_pending"].includes(post.status));
  if (duplicate) return false;
  await ctx.db.insert("distributedPosts", {
    campaignId: args.campaignId, campaignTitle: args.campaignTitle, platform: args.platform, postType: args.postType,
    content: args.content, imageUrl: args.imageUrl, paypalLink: args.link, status: "pending", createdAt: new Date().toISOString(),
  });
  return true;
}

async function ensurePlatformPromotionPosts(ctx: any, control: ControlState, existing: any[]) {
  if (!control.platformOutreachEnabled) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const siteUrl = process.env.SITE_URL || "https://interplanetary-fund.vercel.app";
  const content = `Endless possibilities start with one question: What if? Interplanetary Fund helps people turn support into action for campaigns and communities. Explore what is happening now: ${siteUrl}`;
  let created = 0;
  for (const platform of control.allowedPlatforms) {
    if (!SOCIAL_PLATFORMS.includes(platform as any)) continue;
    if (await insertPostIfMissing(ctx, existing, { campaignId: PLATFORM_CAMPAIGN_ID, campaignTitle: "Interplanetary Fund", platform, postType: `platform_outreach:${today}`, content, link: siteUrl })) created++;
  }
  return created;
}

async function ensureCampaignActivityPosts(ctx: any, control: ControlState, existing: any[]) {
  const siteUrl = process.env.SITE_URL || "https://interplanetary-fund.vercel.app";
  const monitored = await ctx.db.query("monitoredCampaigns").withIndex("byStatus", (q: any) => q.eq("status", "active")).collect();
  const userCampaigns = await ctx.db.query("userCampaigns").withIndex("byStatus", (q: any) => q.eq("status", "active")).collect();
  let created = 0;
  const campaigns: CampaignResolution[] = [
    ...monitored.map((c: any) => ({ kind: "monitored" as const, id: c.ifCampaignId, title: c.title, status: c.status, outreachEnabled: c.outreachEnabled === true, goalAmount: Number(c.goalAmount || 0), raisedAmount: Number(c.raisedAmount || 0), coverImageUrl: c.coverImageUrl })),
    ...userCampaigns.map((c: any) => ({ kind: "user" as const, id: String(c._id), userId: String(c.userId), title: c.title, status: c.status, outreachEnabled: c.outreachEnabled === true, goalAmount: Number(c.goalAmount || 0), raisedAmount: Number(c.raisedAmount || 0), coverImageUrl: c.coverImageUrl })),
  ];
  for (const campaign of campaigns) {
    if (!campaign.outreachEnabled || campaign.goalAmount <= 0) continue;
    const subscriberEligible = campaign.userId ? await userSubscriberEligible(ctx, campaign.userId) : false;
    if (!control.platformOutreachEnabled && !(control.subscriberOutreachEnabled && subscriberEligible)) continue;
    const progress = Math.floor((campaign.raisedAmount / campaign.goalAmount) * 100);
    const threshold = [100, 75, 50, 25].find((value) => progress >= value);
    if (!threshold) continue;
    const content = threshold >= 100
      ? `Mission milestone: ${campaign.title} reached its goal. Thank you to everyone who helped make it possible. See what is happening on Interplanetary Fund: ${siteUrl}`
      : `${campaign.title} has reached ${threshold}% of its goal. Momentum matters—every contribution and every share can move the campaign forward. ${siteUrl}`;
    for (const platform of control.allowedPlatforms) {
      if (!SOCIAL_PLATFORMS.includes(platform as any)) continue;
      if (await insertPostIfMissing(ctx, existing, { campaignId: campaign.id, campaignTitle: campaign.title, platform, postType: `milestone_${threshold}`, content, imageUrl: campaign.coverImageUrl, link: siteUrl })) created++;
    }
  }
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const updates = await ctx.db.query("campaignUpdates").collect();
  for (const update of updates) {
    if (Date.parse(update.createdAt) < cutoff) continue;
    const campaign = await resolveCampaign(ctx, update.campaignId);
    if (!campaign || campaign.status !== "active" || !campaign.outreachEnabled) continue;
    const subscriberEligible = campaign.userId ? await userSubscriberEligible(ctx, campaign.userId) : false;
    if (!control.platformOutreachEnabled && !(control.subscriberOutreachEnabled && subscriberEligible)) continue;
    const content = `${campaign.title} update — ${update.title}: ${update.content.slice(0, 900)}\n\nFollow the campaign on Interplanetary Fund: ${siteUrl}`;
    for (const platform of control.allowedPlatforms) {
      if (!SOCIAL_PLATFORMS.includes(platform as any)) continue;
      if (await insertPostIfMissing(ctx, existing, { campaignId: campaign.id, campaignTitle: campaign.title, platform, postType: `campaign_update:${String(update._id)}`, content, imageUrl: update.mediaUrl || campaign.coverImageUrl, link: siteUrl })) created++;
    }
  }
  return created;
}

export const runDispatchCycle = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await emergencyStopped(ctx)) return { skipped: true, reason: "emergency_stop" };
    const control = await readControl(ctx);
    if (!control.platformOutreachEnabled && !control.subscriberOutreachEnabled) return { skipped: true, reason: "both_agents_disabled" };
    const pacificHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", hour12: false }).format(new Date()));
    if (inQuietHours(pacificHour, control.quietHoursStart, control.quietHoursEnd)) return { skipped: true, reason: "quiet_hours" };

    const existing = await ctx.db.query("distributedPosts").collect();
    const platformPostsCreated = await ensurePlatformPromotionPosts(ctx, control, existing);
    const activityPostsCreated = await ensureCampaignActivityPosts(ctx, control, existing);
    const pending = await ctx.db.query("distributedPosts").withIndex("byStatus", (q: any) => q.eq("status", "pending")).take(control.maxDispatchesPerCycle * 5);
    let scheduled = 0;
    const decisions: any[] = [];
    for (const post of pending) {
      if (scheduled >= control.maxDispatchesPerCycle) break;
      const platform = String(post.platform).toLowerCase();
      if (!control.allowedPlatforms.includes(platform)) continue;
      const campaign = await resolveCampaign(ctx, post.campaignId);
      if (!campaign) continue;
      if (campaign.kind !== "platform" && (campaign.status !== "active" || !campaign.outreachEnabled)) continue;
      const subscriberEligible = campaign.kind === "user" && campaign.userId ? await userSubscriberEligible(ctx, campaign.userId) : false;
      const mode = control.subscriberOutreachEnabled && subscriberEligible ? "subscriber" : control.platformOutreachEnabled ? "platform" : null;
      if (!mode || post.status !== "pending") continue;
      await ctx.db.patch(post._id, { status: "dispatching" });
      await ctx.scheduler.runAfter(0, internal.outreachControl.publishPost, { postId: String(post._id), mode, userId: campaign.userId });
      scheduled++;
      decisions.push({ postId: String(post._id), platform, mode, userId: campaign.userId, campaignKind: campaign.kind });
    }
    await ctx.db.insert("agentActivityLog", {
      agentName: "Outreach Dispatcher", action: "dispatch_cycle", category: "communications",
      description: `Created ${platformPostsCreated} platform posts, ${activityPostsCreated} activity posts, and scheduled ${scheduled} outreach attempts`,
      metadata: JSON.stringify(decisions), creditCost: 0, timestamp: new Date().toISOString(),
    });
    return { platformPostsCreated, activityPostsCreated, scheduled, decisions };
  },
});

export const publishPost = internalAction({
  args: { postId: v.string(), mode: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const prepared: any = await ctx.runMutation(internal.outreachControl.preparePublish, args);
    if (!prepared?.ok) {
      if (prepared?.defer) await ctx.runMutation(internal.outreachControl.releaseDispatch, { postId: args.postId, reason: prepared.reason || "deferred" });
      else await ctx.runMutation(internal.outreachControl.finishPublish, { postId: args.postId, mode: args.mode, userId: args.userId, ok: false, error: prepared?.reason || "prepare_failed", retryable: Boolean(prepared?.retryable), submitted: false });
      return prepared;
    }
    let result: any = { ok: false, reason: "unsupported_platform", retryable: false };
    if (prepared.platform === "bluesky") {
      result = prepared.directApiEnabled ? await publishToBluesky(prepared.content) : { ok: false, reason: "direct_api_disabled", retryable: false };
    } else if (prepared.platform === "facebook" || prepared.platform === "instagram") {
      result = prepared.browserbaseEnabled
        ? await ctx.runAction(internal.outreachBrowserPublisher.publish, { platform: prepared.platform, content: prepared.content, targetUrl: prepared.targetUrl, imageUrl: prepared.imageUrl })
        : { ok: false, reason: "browserbase_disabled", retryable: false };
    }
    await ctx.runMutation(internal.outreachControl.finishPublish, {
      postId: args.postId, mode: args.mode, userId: args.userId, ok: Boolean(result.ok), externalId: result.externalId,
      postUrl: result.postUrl, publisher: result.publisher, error: result.ok ? undefined : String(result.reason || "publish_failed"),
      retryable: Boolean(result.retryable), submitted: Boolean(result.submitted), targetGroupDocId: prepared.targetGroupDocId,
      targetGroupFacebookId: prepared.targetGroupFacebookId, targetGroupName: prepared.targetGroupName,
    });
    return result;
  },
});

export const releaseDispatch = internalMutation({
  args: { postId: v.string(), reason: v.string() },
  handler: async (ctx, { postId, reason }) => {
    const post: any = await ctx.db.get(postId as any);
    if (post?.status === "dispatching") await ctx.db.patch(postId as any, { status: "pending", error: reason });
    return { released: Boolean(post) };
  },
});

export const preparePublish = internalMutation({
  args: { postId: v.string(), mode: v.string(), userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const post: any = await ctx.db.get(args.postId as any);
    if (!post || post.status !== "dispatching") return { ok: false, defer: false, reason: "post_not_dispatching" };
    if (await emergencyStopped(ctx)) return { ok: false, defer: true, reason: "emergency_stop" };
    const control = await readControl(ctx);
    const campaign = await resolveCampaign(ctx, post.campaignId);
    if (!campaign) return { ok: false, defer: false, reason: "campaign_not_found", retryable: false };
    if (campaign.kind !== "platform" && (campaign.status !== "active" || !campaign.outreachEnabled)) return { ok: false, defer: false, reason: "campaign_outreach_disabled", retryable: false };
    if (args.mode === "platform" && !control.platformOutreachEnabled) return { ok: false, defer: true, reason: "platform_agent_disabled" };
    if (args.mode === "subscriber") {
      if (!control.subscriberOutreachEnabled || !args.userId || campaign.kind !== "user") return { ok: false, defer: true, reason: "subscriber_agent_disabled" };
      if (!await userSubscriberEligible(ctx, args.userId)) return { ok: false, defer: false, reason: "subscription_or_user_permission_not_active", retryable: false };
    }
    const platform = String(post.platform).toLowerCase();
    if (!control.allowedPlatforms.includes(platform)) return { ok: false, defer: true, reason: "platform_not_allowed" };
    let facebookTarget: any = null;
    if (platform === "facebook") {
      facebookTarget = await selectAndReserveFacebookTarget(ctx, post.campaignId, post.content, args.postId);
      if (!facebookTarget.ok) return { ok: false, defer: Boolean(facebookTarget.defer), retryable: false, reason: facebookTarget.reason };
    }
    return {
      ok: true, platform, content: post.content, imageUrl: post.imageUrl, campaignId: post.campaignId,
      browserbaseEnabled: control.browserbaseEnabled, directApiEnabled: control.directApiEnabled,
      targetUrl: facebookTarget?.targetUrl, targetGroupDocId: facebookTarget?.groupDocId,
      targetGroupFacebookId: facebookTarget?.groupFacebookId, targetGroupName: facebookTarget?.groupName,
    };
  },
});

export const finishPublish = internalMutation({
  args: {
    postId: v.string(), mode: v.string(), userId: v.optional(v.string()), ok: v.boolean(), externalId: v.optional(v.string()),
    postUrl: v.optional(v.string()), publisher: v.optional(v.string()), error: v.optional(v.string()), retryable: v.optional(v.boolean()),
    submitted: v.optional(v.boolean()), targetGroupDocId: v.optional(v.string()), targetGroupFacebookId: v.optional(v.string()), targetGroupName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const post: any = await ctx.db.get(args.postId as any);
    if (!post) return { ok: false, reason: "post_not_found" };
    const now = new Date().toISOString();
    const control = await readControl(ctx);
    const nextAttempt = parseAttempt(post.error) + 1;
    let outcome = "failed";
    if (args.ok && args.externalId) {
      await ctx.db.patch(args.postId as any, { status: "posted", postUrl: args.postUrl, postedAt: now, error: undefined });
      outcome = "verified";
      if (String(post.platform).toLowerCase() === "facebook" && args.targetGroupDocId && args.targetGroupFacebookId && args.targetGroupName) {
        await ctx.db.insert("facebookGroupPosts", {
          campaignId: post.campaignId, campaignTitle: post.campaignTitle, groupId: args.targetGroupDocId,
          groupFacebookId: args.targetGroupFacebookId, groupName: args.targetGroupName, postType: post.postType,
          postContent: post.content, postUrl: args.postUrl, postStatus: "posted", postedAt: now,
          reactions: 0, comments: 0, shares: 0, createdAt: now,
        });
        const group: any = await ctx.db.get(args.targetGroupDocId as any);
        if (group) await ctx.db.patch(group._id, { postsCount: (group.postsCount || 0) + 1, lastPostedAt: now });
      }
    } else if (args.submitted) {
      await ctx.db.patch(args.postId as any, { status: "verification_pending", error: args.error || "external_submission_unverified" });
      outcome = "verification_pending";
    } else if (args.retryable && nextAttempt <= control.retryLimit) {
      await ctx.db.patch(args.postId as any, { status: "pending", error: `attempt:${nextAttempt}|${args.error || "publish_failed"}` });
      outcome = "retry_queued";
    } else {
      await ctx.db.patch(args.postId as any, { status: "failed", error: `attempt:${nextAttempt}|${args.error || "publish_failed_without_external_evidence"}` });
    }
    await clearFacebookReservation(ctx, args.targetGroupDocId, args.postId);
    await ctx.db.insert("agentActivityLog", {
      agentName: args.mode === "subscriber" ? "Subscriber Outreach Agent" : "Platform Outreach Agent",
      action: outcome === "verified" ? "external_post_verified" : outcome === "retry_queued" ? "external_post_retry_queued" : outcome === "verification_pending" ? "external_post_verification_pending" : "external_post_failed",
      category: "communications",
      description: outcome === "verified" ? `Verified external ${post.platform} post ${args.externalId}` : `${post.platform} outreach ${outcome}: ${args.error || "unknown error"}`,
      metadata: JSON.stringify({ postId: args.postId, campaignId: post.campaignId, userId: args.userId, platform: post.platform, mode: args.mode, externalId: args.externalId, postUrl: args.postUrl, publisher: args.publisher, attempt: nextAttempt, targetGroupDocId: args.targetGroupDocId }),
      creditCost: 0, timestamp: now,
    });
    return { ok: outcome === "verified", outcome, attempt: nextAttempt };
  },
});

async function publishToBluesky(text: string) {
  const identifier = process.env.BLUESKY_IDENTIFIER || "";
  const password = process.env.BLUESKY_APP_PASSWORD || "";
  if (!identifier || !password) return { ok: false, reason: "bluesky_credentials_missing", retryable: false };
  try {
    const auth = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier, password }),
    });
    if (!auth.ok) return { ok: false, reason: `bluesky_auth_${auth.status}`, retryable: auth.status === 429 };
    const session: any = await auth.json();
    if (!session?.accessJwt || !session?.did) return { ok: false, reason: "bluesky_auth_invalid", retryable: false };
    const createdAt = new Date().toISOString();
    const create = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessJwt}` },
      body: JSON.stringify({ repo: session.did, collection: "app.bsky.feed.post", record: { $type: "app.bsky.feed.post", text: text.slice(0, 300), createdAt } }),
    });
    if (!create.ok) return { ok: false, reason: `bluesky_post_${create.status}`, retryable: create.status === 429 };
    const data: any = await create.json();
    if (!data?.uri) return { ok: false, submitted: true, reason: "bluesky_missing_external_id", retryable: false };
    const rkey = String(data.uri).split("/").pop();
    return { ok: true, externalId: data.uri, postUrl: rkey ? `https://bsky.app/profile/${session.did}/post/${rkey}` : undefined, publisher: "bluesky_api", retryable: false };
  } catch (error) {
    return { ok: false, submitted: true, reason: String(error), retryable: false };
  }
}
