/*
 * Interplanetary Fund — Platform Foundation / authoritative Convex contracts
 * Feature #10
 *
 * Authoritative Convex enforcement for the shared event/idempotency contract.
 * Existing taskRelay is reused as the durable idempotency/job ledger because
 * it already has an indexed stable sprintId key and transactional writes.
 */

import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./security";

const EVENT_VERSION = 1;
const MAX_PAYLOAD_BYTES = 32_000;
const MAX_JOB_ATTEMPTS = 5;

// Keep the authoritative Convex catalog in lockstep with the application
// foundation contract. A producer accepted by Base44 must be accepted by the
// authoritative runtime, and vice versa.
const EVENT_NAMES = new Set([
  "platform.configuration.changed",
  "platform.health_check.executed",
  "platform.knowledge.updated",
  "platform.deployment.executed",
  "platform.security.action",
  "platform.recovery.executed",
  "platform.event.recorded",
  "platform.health.check",
  "platform.feature.flag.updated",
  "platform.knowledge.published",
  "platform.agent.interaction.recorded",
  "platform.connection.synced",
  "platform.campaign.updated",
  "platform.payment.updated",
]);

function assertValidIsoTimestamp(value: string) {
  if (Number.isNaN(Date.parse(value))) throw new Error("Invalid platform event timestamp");
}

function assertBoundedPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Platform event payload must be an object");
  }
  if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
    throw new Error("Platform event payload exceeds maximum size");
  }
}

function assertEvent(input: {
  name: string;
  actorId: string;
  resourceType: string;
  resourceId: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  version: number;
  payload: unknown;
}) {
  if (!EVENT_NAMES.has(input.name)) throw new Error("Unsupported platform event");
  if (!input.actorId || !input.resourceType || !input.resourceId || !input.correlationId || !input.idempotencyKey) {
    throw new Error("Platform event identity and idempotency fields are required");
  }
  if (input.version !== EVENT_VERSION) throw new Error("Unsupported platform event version");
  assertValidIsoTimestamp(input.occurredAt);
  assertBoundedPayload(input.payload);
}

function validateJobKey(idempotencyKey: string) {
  if (!idempotencyKey.trim() || idempotencyKey.length > 200) throw new Error("Valid idempotencyKey is required");
}

function safePayloadMetadata(payload: unknown) {
  const serialized = JSON.stringify(payload);
  const keys = Object.keys(payload as Record<string, unknown>).slice(0, 50);
  return {
    payloadKeys: keys,
    payloadBytes: serialized.length,
    payloadRedacted: true,
  };
}

function parseJobOwner(context: string) {
  try {
    const parsed = JSON.parse(context);
    return typeof parsed?.ownerActorId === "string" ? parsed.ownerActorId : null;
  } catch {
    return null;
  }
}

async function recordEvent(ctx: any, input: {
  eventId: string;
  name: string;
  actorId: string;
  resourceType: string;
  resourceId: string;
  correlationId: string;
  idempotencyKey: string;
  occurredAt: string;
  version: number;
  payload: string;
}) {
  let parsedPayload: unknown;
  try { parsedPayload = JSON.parse(input.payload); }
  catch { throw new Error("Platform event payload must be valid JSON"); }

  assertEvent({ ...input, payload: parsedPayload });

  const sprintId = `platform-event:${input.idempotencyKey}`;
  const existing = await ctx.db.query("taskRelay")
    .withIndex("bySprintId", (q: any) => q.eq("sprintId", sprintId)).first();

  if (existing) return { recorded: false, duplicate: true, eventId: input.eventId, sprintId };

  const payloadMetadata = safePayloadMetadata(parsedPayload);
  await ctx.db.insert("taskRelay", {
    sprintId,
    context: JSON.stringify({
      eventId: input.eventId,
      name: input.name,
      actorId: input.actorId,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      occurredAt: input.occurredAt,
      version: input.version,
      ...payloadMetadata,
    }),
    nextSteps: [],
    completedThisSession: ["recorded"],
    status: "completed",
    lastUpdated: new Date().toISOString(),
    activeSprint: "platform-foundation-event",
    totalSprints: 1,
  });

  await ctx.db.insert("agentActivityLog", {
    agentName: "Platform",
    agentId: input.actorId,
    action: input.name,
    category: "platform",
    description: `Platform event ${input.eventId} recorded`,
    metadata: JSON.stringify({
      eventId: input.eventId,
      eventVersion: input.version,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      occurredAt: input.occurredAt,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      ...payloadMetadata,
    }),
    creditCost: 0,
    timestamp: input.occurredAt,
  });

  return { recorded: true, duplicate: false, eventId: input.eventId, sprintId };
}

/** Authenticated application callers may record only events for themselves. */
export const recordPlatformEvent = mutation({
  args: {
    eventId: v.string(), name: v.string(), actorId: v.string(), resourceType: v.string(),
    resourceId: v.string(), correlationId: v.string(), idempotencyKey: v.string(),
    occurredAt: v.string(), version: v.number(), payload: v.string(),
  },
  handler: async (ctx, input) => {
    const identity = await requireAuth(ctx);
    const identityIds = [identity.subject, identity.tokenIdentifier, identity.email].filter(Boolean).map(String);
    if (!identityIds.includes(String(input.actorId))) {
      throw new Error("Actor does not match authenticated identity");
    }
    return recordEvent(ctx, input);
  },
});

/** Internal-only persistence used by the authenticated Base44 bridge HTTP route. */
export const recordPlatformEventInternal = internalMutation({
  args: {
    eventId: v.string(), name: v.string(), actorId: v.string(), resourceType: v.string(),
    resourceId: v.string(), correlationId: v.string(), idempotencyKey: v.string(),
    occurredAt: v.string(), version: v.number(), payload: v.string(),
  },
  handler: async (ctx, input) => recordEvent(ctx, input),
});

export const beginPlatformJob = mutation({
  args: { idempotencyKey: v.string(), context: v.string() },
  handler: async (ctx, { idempotencyKey, context }) => {
    const identity = await requireAuth(ctx);
    validateJobKey(idempotencyKey);
    if (!context.trim() || context.length > 10_000) throw new Error("Valid job context is required");
    const sprintId = `platform-job:${idempotencyKey}`;
    const existing = await ctx.db.query("taskRelay")
      .withIndex("bySprintId", (q: any) => q.eq("sprintId", sprintId)).first();
    if (existing) return { claimed: false, duplicate: true, status: existing.status, sprintId };
    const ownerActorId = String(identity.subject || identity.tokenIdentifier || identity.email || "");
    await ctx.db.insert("taskRelay", {
      sprintId,
      context: JSON.stringify({ ownerActorId, context }),
      nextSteps: ["complete platform job"],
      completedThisSession: [],
      status: "running",
      lastUpdated: new Date().toISOString(),
      activeSprint: "platform-foundation",
      totalSprints: 1,
    });
    return { claimed: true, duplicate: false, status: "running", sprintId };
  },
});

export const completePlatformJob = mutation({
  args: {
    idempotencyKey: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    result: v.optional(v.string()),
  },
  handler: async (ctx, { idempotencyKey, status, result }) => {
    const identity = await requireAuth(ctx);
    validateJobKey(idempotencyKey);
    if (result && result.length > 10_000) throw new Error("Job result exceeds maximum size");
    const sprintId = `platform-job:${idempotencyKey}`;
    const existing = await ctx.db.query("taskRelay")
      .withIndex("bySprintId", (q: any) => q.eq("sprintId", sprintId)).first();
    if (!existing) throw new Error("Platform job claim not found");
    const ownerActorId = String(identity.subject || identity.tokenIdentifier || identity.email || "");
    if (parseJobOwner(existing.context) !== ownerActorId) throw new Error("Platform job is owned by another user");
    await ctx.db.patch(existing._id, {
      status,
      context: JSON.stringify({
        ownerActorId,
        result: result ? "[redacted from shared job context]" : undefined,
      }),
      completedThisSession: [status],
      nextSteps: [],
      lastUpdated: new Date().toISOString(),
    });
    return { success: true, status, sprintId };
  },
});

export const getPlatformJob = query({
  args: { idempotencyKey: v.string() },
  handler: async (ctx, { idempotencyKey }) => {
    const identity = await requireAuth(ctx);
    validateJobKey(idempotencyKey);
    const sprintId = `platform-job:${idempotencyKey}`;
    const existing = await ctx.db.query("taskRelay")
      .withIndex("bySprintId", (q: any) => q.eq("sprintId", sprintId)).first();
    if (!existing) return null;
    const ownerActorId = String(identity.subject || identity.tokenIdentifier || identity.email || "");
    if (parseJobOwner(existing.context) !== ownerActorId) throw new Error("Platform job is owned by another user");
    return { sprintId, status: existing.status, context: existing.context, lastUpdated: existing.lastUpdated };
  },
});

export const PLATFORM_FOUNDATION = Object.freeze({
  eventVersion: EVENT_VERSION,
  maxPayloadBytes: MAX_PAYLOAD_BYTES,
  maxJobAttempts: MAX_JOB_ATTEMPTS,
  eventNames: Array.from(EVENT_NAMES),
});
