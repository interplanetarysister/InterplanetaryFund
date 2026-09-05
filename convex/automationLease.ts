/*
 * Interplanetary Fund — Serialized automation lease fencing.
 *
 * Every scheduled write mutation participating in the shared automation lane
 * reads the singleton lease row inside the same Convex transaction as its
 * writes. A successor claim changes that row, forcing an overlapping stale
 * transaction to retry and then fail ownership validation. Expired owners also
 * fail closed even when no successor has claimed yet.
 */

export const AUTOMATION_LOCK_KEY = "__system_serialized_automation_lock__";
export const AUTOMATION_LOCK_LEASE_MS = 60 * 60 * 1000;

export async function assertAutomationLaneOwnership(
  ctx: any,
  claimToken: string,
  nowMs: number = Date.now(),
) {
  if (!claimToken) throw new Error("automation_lane_claim_required");

  const records = await ctx.db
    .query("featureFlags")
    .withIndex("byName", (q: any) => q.eq("name", AUTOMATION_LOCK_KEY))
    .collect();

  if (records.length !== 1) {
    throw new Error(
      records.length === 0
        ? "automation_lock_not_initialized"
        : "automation_lock_not_unique",
    );
  }

  const lease = records[0];
  const expiresAt = typeof lease.rolloutPercent === "number" ? lease.rolloutPercent : 0;
  if (
    lease.enabled !== true ||
    lease.description !== `automation-lane-lease:${claimToken}` ||
    expiresAt <= nowMs
  ) {
    throw new Error("automation_lane_stale_owner");
  }

  return { leaseId: lease._id, expiresAt };
}
