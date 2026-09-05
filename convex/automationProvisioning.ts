/*
 * Interplanetary Fund — Serialized Automation Lock Provisioning
 *
 * Controlled operational prerequisite for the serialized automation lane.
 * Provisioning is intentionally separate from runtime claim/release so a
 * concurrent claim can never create a competing coordination record.
 */

import { internalMutation, internalQuery } from "./_generated/server";

const AUTOMATION_LOCK_KEY = "__system_serialized_automation_lock__";

export const provisionAutomationLaneLock = internalMutation({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db
      .query("featureFlags")
      .withIndex("byName", (q) => q.eq("name", AUTOMATION_LOCK_KEY))
      .collect();

    if (records.length > 1) {
      throw new Error("automation_lock_not_unique");
    }

    if (records.length === 1) {
      return {
        success: true,
        created: false,
        state: "already_initialized",
        recordCount: 1,
      };
    }

    const now = new Date().toISOString();
    await ctx.db.insert("featureFlags", {
      name: AUTOMATION_LOCK_KEY,
      description: "Reserved singleton coordination record for serialized automation lane",
      enabled: false,
      rolloutPercent: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Re-read inside the same transaction. Convex transaction retry semantics
    // make concurrent first-provision attempts converge on a single record;
    // any unexpected duplicate state still fails closed.
    const provisioned = await ctx.db
      .query("featureFlags")
      .withIndex("byName", (q) => q.eq("name", AUTOMATION_LOCK_KEY))
      .collect();

    if (provisioned.length !== 1) {
      throw new Error("automation_lock_provisioning_failed");
    }

    return {
      success: true,
      created: true,
      state: "initialized",
      recordCount: 1,
    };
  },
});

export const getAutomationLaneLockStatus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db
      .query("featureFlags")
      .withIndex("byName", (q) => q.eq("name", AUTOMATION_LOCK_KEY))
      .collect();

    if (records.length !== 1) {
      return {
        initialized: false,
        recordCount: records.length,
        state: records.length === 0 ? "missing" : "duplicate",
        activeLease: false,
      };
    }

    const record = records[0];
    const nowMs = Date.now();
    const activeLease = record.enabled === true &&
      typeof record.rolloutPercent === "number" &&
      record.rolloutPercent > nowMs;

    return {
      initialized: true,
      recordCount: 1,
      state: activeLease ? "leased" : "ready",
      activeLease,
      leaseExpiresAt: activeLease ? record.rolloutPercent : null,
    };
  },
});
