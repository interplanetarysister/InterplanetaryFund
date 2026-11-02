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
  const { data, error } = await client.from("ifund_campaigns")
    .update(payload)
    .eq("id", id)
    .eq("owner_id", owner)
    .select(OWNER_CAMPAIGN_COLUMNS)
    .single();
  if (error || !data) throw new Error("Your campaign changes were not saved.");
  const updated = assertOwned(data, owner, id);
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
  const { data, error } = await client.from("ifund_campaigns")
    .update({ status })
    .eq("id", id)
    .eq("owner_id", owner)
    .select(OWNER_CAMPAIGN_COLUMNS)
    .single();
  if (error || !data) throw new Error("The campaign status change was not saved.");
  const saved = assertOwned(data, owner, id);
  if (saved.status !== status) throw new Error("The campaign status change was not confirmed.");
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
