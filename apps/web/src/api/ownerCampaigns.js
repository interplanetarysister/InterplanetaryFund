// Owner-scoped campaign persistence for the independent IFund frontend.
//
// Every call authenticates the member, verifies the account lifecycle, scopes
// reads and writes to owner_id = the verified auth.uid(), and confirms the
// returned row before reporting success. No service-role key, no Base44 client,
// no payment or ledger writes. Supabase row level security stays authoritative.
//
// Relative imports (not the "@/" alias) so these functions can be unit tested
// directly by node:test, matching src/lib/inbox.js and src/lib/followedCampaigns.js.
import { isVerifiedEmailUser } from "../lib/verifiedEmailUser.js";
import { verifyAccountLifecycle } from "../lib/accountLifecycle.js";
import { CAMPAIGN_STATUSES, canTransition, buildCampaignPayload, publishReadiness } from "../lib/campaignLifecycle.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only columns already used by other owner reads in this app, so a deployment
// missing a newer column cannot break the management page.
export const OWNER_CAMPAIGN_COLUMNS =
  "id,owner_id,title,summary,story,category,goal_amount,cover_image_url,status,created_at";

async function verifiedOwner(client) {
  const { data, error } = await client.auth.getUser();
  const user = data?.user;
  if (error || !isVerifiedEmailUser(user) || !UUID.test(user?.id || "")) {
    throw new Error("Sign in with a confirmed email to manage your campaigns.");
  }
  const lifecycle = await verifyAccountLifecycle(client, user);
  if (!lifecycle.ok) throw new Error(lifecycle.message || "Account access could not be verified.");
  return user.id;
}

function assertOwned(row, owner, id) {
  if (!row || row.owner_id !== owner || !UUID.test(row.id || "") || (id && row.id !== id)) {
    throw new Error("The campaign response could not be verified for your account.");
  }
  return row;
}

// Discard work whose session changed while the request was in flight, so a
// response is never attributed to a different account.
async function assertSessionUnchanged(client, owner) {
  const { data, error } = await client.auth.getUser();
  if (error || data?.user?.id !== owner) {
    throw new Error("Your account changed. Reload your campaigns.");
  }
}

// A read -> check -> update sequence is not atomic: another tab or browser can
// change the row between the read and the write. Every mutation therefore
// carries the status it validated as a compare-and-swap condition, so a stale
// operation matches no row and fails closed instead of overwriting newer state.
export const CAMPAIGN_CONFLICT_MESSAGE =
  "This campaign changed in another session. Reload before making changes.";

/** True when a failure was a lost compare-and-swap rather than a generic error. */
export function isCampaignConflict(cause) {
  return cause?.message === CAMPAIGN_CONFLICT_MESSAGE;
}

function confirmedWrite(result, { owner, id, expectedStatus, failureMessage }) {
  if (result.error) throw new Error(failureMessage);
  const rows = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
  // Zero affected rows means the compare-and-swap condition matched nothing.
  if (rows.length !== 1) throw new Error(CAMPAIGN_CONFLICT_MESSAGE);
  const row = assertOwned(rows[0], owner, id);
  // The database returns the post-write row; if it is not the status this
  // operation validated and wrote, a concurrent change won the race.
  if (expectedStatus !== undefined && row.status !== expectedStatus) throw new Error(CAMPAIGN_CONFLICT_MESSAGE);
  return row;
}

export async function listOwnerCampaigns(client) {
  const owner = await verifiedOwner(client);
  const { data, error } = await client.from("ifund_campaigns")
    .select(OWNER_CAMPAIGN_COLUMNS)
    .eq("owner_id", owner)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !Array.isArray(data) || data.some((row) => row?.owner_id !== owner || !UUID.test(row?.id || ""))) {
    throw new Error("Your campaigns could not be loaded.");
  }
  await assertSessionUnchanged(client, owner);
  return data;
}

/**
 * Owner campaign list shaped for CampaignCard. The public campaign schema has
 * no funding totals, so those stay null rather than being shown as zero.
 */
export async function listMyCampaigns(client) {
  const rows = await listOwnerCampaigns(client);
  return rows.map((row) => ({ ...row, raised_amount: null, donor_count: null }));
}

export async function loadOwnerCampaign(client, id) {
  if (!UUID.test(id || "")) throw new Error("Invalid campaign reference.");
  const owner = await verifiedOwner(client);
  const { data, error } = await client.from("ifund_campaigns")
    .select(OWNER_CAMPAIGN_COLUMNS)
    .eq("id", id)
    .eq("owner_id", owner)
    .maybeSingle();
  if (error || !data) throw new Error("That campaign was not found for your account.");
  const campaign = assertOwned(data, owner, id);
  await assertSessionUnchanged(client, owner);
  return campaign;
}

/**
 * Create a new campaign (id === null) or update an existing one.
 * `status` must be a valid lifecycle value and reachable from the stored state.
 */
export async function saveOwnerCampaign(client, form, { id = null, status = "draft" } = {}) {
  if (!CAMPAIGN_STATUSES.includes(status)) throw new Error("Invalid campaign status.");
  if (id !== null && !UUID.test(id || "")) throw new Error("Invalid campaign reference.");
  const owner = await verifiedOwner(client);
  const payload = buildCampaignPayload(form, status);

  if (id === null) {
    if (!canTransition(null, status)) throw new Error("A new campaign cannot start in that state.");
    const { data, error } = await client.from("ifund_campaigns")
      .insert({ ...payload, owner_id: owner })
      .select(OWNER_CAMPAIGN_COLUMNS)
      .single();
    if (error || !data) throw new Error("Your campaign was not saved.");
    const created = assertOwned(data, owner);
    await assertSessionUnchanged(client, owner);
    return created;
  }

  const { data: existing, error: readError } = await client.from("ifund_campaigns")
    .select("id,owner_id,status")
    .eq("id", id)
    .eq("owner_id", owner)
    .maybeSingle();
  if (readError || !existing || existing.owner_id !== owner) {
    throw new Error("That campaign was not found for your account.");
  }
  if (!canTransition(existing.status, status)) {
    throw new Error(`A ${existing.status} campaign cannot be saved as ${status}.`);
  }
  // Compare-and-swap on the validated status so a concurrent publish or pause
  // cannot be silently overwritten by this stale save.
  const { data, error } = await client.from("ifund_campaigns")
    .update(payload)
    .eq("id", id)
    .eq("owner_id", owner)
    .eq("status", existing.status)
    .select(OWNER_CAMPAIGN_COLUMNS)
    .maybeSingle();
  const updated = confirmedWrite({ data, error }, { owner, id, expectedStatus: status, failureMessage: "Your campaign changes were not saved." });
  await assertSessionUnchanged(client, owner);
  return updated;
}

/** Publish, pause or resume an existing owned campaign without editing content. */
export async function setCampaignStatus(client, id, status) {
  if (!UUID.test(id || "")) throw new Error("Invalid campaign reference.");
  if (!CAMPAIGN_STATUSES.includes(status)) throw new Error("Invalid campaign status.");
  const owner = await verifiedOwner(client);
  const { data: existing, error: readError } = await client.from("ifund_campaigns")
    .select(OWNER_CAMPAIGN_COLUMNS)
    .eq("id", id)
    .eq("owner_id", owner)
    .maybeSingle();
  if (readError || !existing) throw new Error("That campaign was not found for your account.");
  const current = assertOwned(existing, owner, id);
  if (current.status === status) return current;
  if (!canTransition(current.status, status)) {
    throw new Error(`A ${current.status} campaign cannot be set to ${status}.`);
  }
  if (status === "active") {
    const { ready, missing } = publishReadiness(current);
    if (!ready) throw new Error(missing[0] || "Complete the campaign before publishing.");
  }
  // Compare-and-swap on the status this call validated, so two racing
  // transitions cannot both apply and a stale one fails closed.
  const { data, error } = await client.from("ifund_campaigns")
    .update({ status })
    .eq("id", id)
    .eq("owner_id", owner)
    .eq("status", current.status)
    .select(OWNER_CAMPAIGN_COLUMNS)
    .maybeSingle();
  const saved = confirmedWrite({ data, error }, { owner, id, expectedStatus: status, failureMessage: "The campaign status change was not saved." });
  await assertSessionUnchanged(client, owner);
  return saved;
}

/**
 * Deletion stays restricted to drafts, matching the audited Worker policy in
 * worker/campaignWrites.js: a published campaign may already have donors and
 * must go through a separate archive workflow.
 */
export async function deleteDraftCampaign(client, id) {
  if (!UUID.test(id || "")) throw new Error("Invalid campaign reference.");
  const owner = await verifiedOwner(client);
  const { data, error } = await client.from("ifund_campaigns")
    .delete()
    .eq("id", id)
    .eq("owner_id", owner)
    .eq("status", "draft")
    .select("id,owner_id,status");
  if (error || !Array.isArray(data) || data.length !== 1 ||
      data[0].owner_id !== owner || data[0].id !== id || data[0].status !== "draft") {
    throw new Error("Only an unpublished draft campaign can be deleted.");
  }
  await assertSessionUnchanged(client, owner);
  return id;
}
