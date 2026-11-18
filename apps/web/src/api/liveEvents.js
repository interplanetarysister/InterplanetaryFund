// IFund Live schedule API. No stream keys, checkout operations, or privileged API.
import { isVerifiedEmailUser } from "../lib/verifiedEmailUser.js";
import { verifyAccountLifecycle } from "../lib/accountLifecycle.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER_COLUMNS = "id,owner_id,campaign_id,title,description,scheduled_at,status,public_visible,recording_consent,provider_status,verified_live_at,ended_at,created_at,updated_at";
// Public queries never request identity, recording-consent, or internal audit fields.
const PUBLIC_COLUMNS = "id,campaign_id,title,description,scheduled_at,status,public_visible,provider_status,verified_live_at,ended_at";
const UNAVAILABLE = new Set(["42P01", "PGRST205", "PGRST116"]);

export function validateLiveEvent(input, { publishing = false } = {}) {
  if (!input || typeof input !== "object") throw Error("Enter the broadcast details.");
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (title.length < 8 || title.length > 140) throw Error("Use a title between 8 and 140 characters.");
  if (description.length > 2000) throw Error("Keep the description under 2,000 characters.");
  const when = typeof input.scheduled_at === "string" && input.scheduled_at ? Date.parse(input.scheduled_at) : NaN;
  if (publishing && (!Number.isFinite(when) || when < Date.now() + 60000))
    throw Error("Choose a broadcast time in the future.");
  if (input.campaign_id && !UUID.test(input.campaign_id))
    throw Error("Choose a valid owned campaign.");
  return { title, description, scheduled_at: Number.isFinite(when) ? new Date(when).toISOString() : null,
    campaign_id: input.campaign_id || null, recording_consent: input.recording_consent === true };
}

export function isLiveEventPublic(event) {
  return Boolean(event && event.public_visible === true &&
    (event.status === "scheduled" ||
      (event.status === "live" && event.provider_status === "verified" && event.verified_live_at) ||
      (event.status === "ended" && ["verified", "ended"].includes(event.provider_status) && event.verified_live_at)));
}

export async function verifiedLiveOwner(client) {
  const { data, error } = await client.auth.getUser();
  const user = data?.user;
  if (error || !isVerifiedEmailUser(user) || user.is_anonymous === true || !UUID.test(user?.id || ""))
    throw Error("Confirm your account email before managing live events.");
  const gate = await verifyAccountLifecycle(client, user);
  if (!gate.ok) throw Error(gate.message || "Your account could not be verified.");
  return user.id;
}
async function checkOwner(client, owner) {
  const { data, error } = await client.auth.getUser();
  if (error || data?.user?.id !== owner) throw Error("Your account changed. Reload your events.");
}
export async function listPublicLiveEvents(client) {
  const { data, error } = await client.from("ifund_live_events")
    .select(PUBLIC_COLUMNS).eq("public_visible", true)
    .in("status", ["scheduled", "live", "ended"])
    .order("scheduled_at", { ascending: true }).limit(60);
  if (error) {
    if (UNAVAILABLE.has(error.code)) return { available: false, events: [] };
    throw Error("The current event schedule could not be loaded.");
  }
  if (!Array.isArray(data)) throw Error("The event schedule response was invalid.");
  return { available: true, events: data.filter(isLiveEventPublic) };
}
export async function getPublicLiveEvent(client, id) {
  if (!UUID.test(id || "")) return null;
  const { data, error } = await client.from("ifund_live_events")
    .select(PUBLIC_COLUMNS).eq("id", id).eq("public_visible", true).maybeSingle();
  if (error) {
    if (UNAVAILABLE.has(error.code)) return null;
    throw Error("This live event could not be loaded.");
  }
  return isLiveEventPublic(data) ? data : null;
}
export async function listOwnerLiveEvents(client) {
  const owner = await verifiedLiveOwner(client);
  const { data, error } = await client.from("ifund_live_events").select(OWNER_COLUMNS)
    .eq("owner_id", owner).order("created_at", { ascending: false }).limit(100);
  if (error) {
    if (UNAVAILABLE.has(error.code)) throw Error("Live scheduling has not yet been enabled.");
    throw Error("Your live events could not be loaded.");
  }
  if (!Array.isArray(data) || data.some(row => row.owner_id !== owner)) throw Error("Event ownership could not be verified.");
  await checkOwner(client, owner);
  return data;
}
export async function listLiveCampaignChoices(client, owner) {
  const { data, error } = await client.from("ifund_campaigns").select("id,owner_id,title,status")
    .eq("owner_id", owner).eq("status", "active").limit(100);
  if (error || !Array.isArray(data) || data.some(row => row.owner_id !== owner))
    throw Error("Your eligible campaigns could not be loaded.");
  await checkOwner(client, owner);
  return data;
}
export async function createLiveDraft(client, input) {
  const owner = await verifiedLiveOwner(client);
  const value = validateLiveEvent(input);
  if (value.campaign_id) {
    const choices = await listLiveCampaignChoices(client, owner);
    if (!choices.some(row => row.id === value.campaign_id)) throw Error("This campaign is not available to your account.");
  }
  await checkOwner(client, owner);
  const { data, error } = await client.from("ifund_live_events")
    .insert({ ...value, owner_id: owner, status: "draft", public_visible: false })
    .select(OWNER_COLUMNS).single();
  if (error || data?.owner_id !== owner || data?.status !== "draft" || data?.public_visible !== false)
    throw Error("Your event draft was not saved.");
  await checkOwner(client, owner);
  return data;
}
export async function updateLiveDraft(client, event, input, nextStatus = "draft") {
  const owner = await verifiedLiveOwner(client);
  if (!UUID.test(event?.id || "") || event.owner_id !== owner ||
      !["draft", "scheduled", "cancelled"].includes(event.status) ||
      !["draft", "scheduled", "cancelled"].includes(nextStatus))
    throw Error("This event cannot be edited by your account.");
  const value = validateLiveEvent(input, { publishing: nextStatus === "scheduled" });
  if (value.campaign_id) {
    const choices = await listLiveCampaignChoices(client, owner);
    if (!choices.some(row => row.id === value.campaign_id)) throw Error("Choose an active campaign you own.");
  }
  await checkOwner(client, owner);
  const { data, error } = await client.from("ifund_live_events")
    .update({ ...value, status: nextStatus, public_visible: nextStatus === "scheduled", updated_at: new Date().toISOString() })
    .eq("id", event.id).eq("owner_id", owner).eq("status", event.status)
    .eq("updated_at", event.updated_at)
    .select(OWNER_COLUMNS).maybeSingle();
  if (error || !data || data.owner_id !== owner || data.status !== nextStatus)
    throw Error("The event changed in another session or could not be saved. Reload and retry.");
  await checkOwner(client, owner);
  return data;
}
