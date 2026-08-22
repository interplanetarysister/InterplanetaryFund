/*
 * Interplanetary Fund — Platform Foundation / authoritative Convex contracts
 * Feature #10
 *
 * This module makes the application-layer event/idempotency contract durable
 * in the authoritative Convex runtime without introducing a second backend.
 * Existing taskRelay is reused as the durable idempotency/job ledger because
 * it already has an indexed stable sprintId key and transactional writes.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const EVENT_VERSION = 1;
const MAX_PAYLOAD_BYTES = 32_000;
const MAX_JOB_ATTEMPTS = 5;

const EVENT_NAMES = new Set([
  "platform.configuration.changed",
  "platform.health_check.executed",
  "platform.knowledge.updated",
  "platform.deployment.executed",
  "platform.security.action",
  "platform.recovery.executed",
  "platform.event.recorded",
]);

function assertValidIsoTimestamp(value: string) {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error("Invalid platform event timestamp");
  }
}

function assertBoundedPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Platform event payload must be an object");
  }
  const encoded = JSON.stringify(payload);
  if (encoded.length > MAX_PAYLOAD_BYTES) {
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

/**
 * Durable idempotency gate for scheduled/asynchronous work.
 * Convex mutation isolation makes the read+insert transactional, so two
 * concurrent callers cannot both claim the same taskRelay sprintId.
 */
export const beginPlatformJob = mutation({
  args: {
    idempotencyKey: v.string(),
    context: v.string(),
  },
  handler: async (ctx, { idempotencyKey, context }) => {
    if (!idempotencyKey.trim()) throw new Error("idempotencyKey is required");
    const sprintId = `platform-job:${idempotencyKey}`;
    const existing = await ctx.db
      .query("taskRelay")
      .withIndex("bySprintId", (q) => q.eq("sprintId", sprintId))
      .first();

    if (existing) {
      return {
        claimed: existing.status !== "running" && existing.status !== "completed",
        duplicate: true,
        status: existing.status,
        sprintId,
      };
    }

    await ctx.db.insert("taskRelay", {
      sprintId,
      context,
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

/** Complete or fail a previously claimed idempotent platform job. */
export const completePlatformJob = mutation({
  args: {
    idempotencyKey: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    result: v.optional(v.string()),
  },
  handler: async (ctx, { idempotencyKey, status, result }) => {
    const sprintId = `platform-job:${idempotencyKey}`;
    const existing = await ctx.db
      .query("taskRelay")
      .withIndex("bySprintId", (q) => q.eq("sprintId", sprintId))
      .first();
    if (!existing) throw new Error("Platform job claim not found");

    await ctx.db.patch(existing._id, {
      status,
      context: result ? JSON.stringify({ result }) : existing.context,
      completedThisSession: [status],
      nextSteps: [],
      lastUpdated: new Date().toISOString(),
    });

    return { success: true, status, sprintId };
  },
});

/**
 * Authoritative event persistence. Events are written to the existing
 * agentActivityLog audit stream and guarded by the durable taskRelay key.
 * The operation is idempotent: a repeated key returns the prior event rather
 * than creating a second audit record.
 */
export const recordPlatformEvent = mutation({
  args: {
    eventId: v.string(),
    name: v.string(),
    actorId: v.string(),
    resourceType: v.string(),
    resourceId: v.string(),
    correlationId: v.string(),
    idempotencyKey: v.string(),
    occurredAt: v.string(),
    version: v.number(),
    payload: v.string(),
  },
  handler: async (ctx, input) => {
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(input.payload);
    } catch {
      throw new Error("Platform event payload must be valid JSON");
    }

    assertEvent({ ...input, payload: parsedPayload });

    const sprintId = `platform-event:${input.idempotencyKey}`;
    const existing = await ctx.db
      .query("taskRelay")
      .withIndex("bySprintId", (q) => q.eq("sprintId", sprintId))
      .first();

    if (existing) {
      return { recorded: false, duplicate: true, eventId: input.eventId, sprintId };
    }

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
        payload: parsedPayload,
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
        payload: parsedPayload,
      }),
      creditCost: 0,
      timestamp: input.occurredAt,
    });

    return { recorded: true, duplicate: false, eventId: input.eventId, sprintId };
  },
});

export const getPlatformJob = query({
  args: { idempotencyKey: v.string() },
  handler: async (ctx, { idempotencyKey }) => {
    const sprintId = `platform-job:${idempotencyKey}`;
    const existing = await ctx.db
      .query("taskRelay")
      .withIndex("bySprintId", (q) => q.eq("sprintId", sprintId))
      .first();
    if (!existing) return null;
    return {
      sprintId,
      status: existing.status,
      context: existing.context,
      lastUpdated: existing.lastUpdated,
    };
  },
});

export const PLATFORM_FOUNDATION = Object.freeze({
  eventVersion: EVENT_VERSION,
  maxPayloadBytes: MAX_PAYLOAD_BYTES,
  maxJobAttempts: MAX_JOB_ATTEMPTS,
  eventNames: Array.from(EVENT_NAMES),
});
