// IFund fundraising events use the canonical Supabase account and owner model.
 // External checkout always goes directly to the organizer's allowlisted provider.
 // Member-reported external purchases are activity records, never verified receipts
 // and never entries in the IFund donation or withdrawal ledger.
import { isVerifiedEmailUser } from "../lib/verifiedEmailUser.js";
import { payoutIdentity } from "../lib/guestAccess.js";
import { verifyAccountLifecycle } from "../lib/accountLifecycle.js";
import { TERMS_VERSION } from "../lib/legalPolicy.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const EVENT_COLUMNS = [
  "id","owner_id","campaign_id","event_type","title","description","starts_at",
  "ends_at","timezone","venue_name","location_label","checkout_provider",
  "checkout_url","status","visibility","published_at","created_at","updated_at",
].join(",");
export const PUBLIC_EVENT_COLUMNS = [
  "id","campaign_id","event_type","title","description","starts_at","ends_at","timezone",
  "venue_name","location_label","checkout_provider","checkout_url","status","visibility",
  "published_at","created_at","updated_at",
].join(",");
export const ITEM_COLUMNS = [
  "id","event_id","item_type","title","description","estimated_value_cents",
  "starting_bid_cents","checkout_provider","checkout_url","status","created_at","updated_at",
].join(",");
export const ACTIVITY_COLUMNS = [
  "id","event_id","item_id","user_id","activity_type","status",
  "quantity","reported_amount_cents","reported_currency","external_reference",
  "reported_at","created_at","updated_at",
].join(",");

export const EVENT_TYPES = Object.freeze([
  "benefit_dinner","art_auction","benefit_concert","community_event","gala","other",
]);
export const ITEM_TYPES = Object.freeze(["ticket","auction_item","meal","experience","raffle"]);

const PROVIDER_HOSTS = Object.freeze({
  eventbrite: ["eventbrite.com"],
  paypal: ["paypal.com","paypal.me"],
  "32auctions": ["32auctions.com"],
  auctria: ["auctria.com"],
  givesmart: ["givesmart.com"],
  givebutter: ["givebutter.com"],
  zeffy: ["zeffy.com"],
  betterunite: ["betterunite.com"],
  onecause: ["onecause.com"],
});

function normalizedProviderUrl(value, provider, optional = false) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw && optional) return { checkout_url: null, checkout_provider: null };
  if (!raw || !Object.hasOwn(PROVIDER_HOSTS, provider)) {
    throw new Error("Choose a supported event checkout provider and its event or payment link.");
  }
  let parsed;
  try { parsed = new URL(raw); }
  catch { throw new Error("Enter a valid HTTPS checkout link from the selected provider."); }
  const allowed = PROVIDER_HOSTS[provider];
  const hostOk = allowed.some(host => parsed.hostname === host || parsed.hostname.endsWith("." + host));
  const rawAuthority = raw.match(/^https:\/\/([^/?#]+)/i)?.[1] || "";
  if (parsed.protocol !== "https:" || !hostOk || parsed.username || parsed.password ||
      parsed.port || rawAuthority.includes(":") || parsed.hostname.includes("..") || parsed.pathname === "/") {
    throw new Error("That link does not match the selected supported checkout provider.");
  }
  return { checkout_url: parsed.toString(), checkout_provider: provider };
}

export function validateExternalCheckout(url, provider) {
  try {
    return { valid: true, ...normalizedProviderUrl(url, provider, !String(url || "").trim()) };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function requiredText(value, min, max, message) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < min || text.length > max) throw new Error(message);
  return text;
}
function normalizedDate(value, required, label) {
  if (!value && !required) return null;
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) throw new Error("Enter a valid " + label + ".");
  return date.toISOString();
}

export function normalizeEventInput(input = {}) {
  const eventType = String(input.event_type || "");
  if (!EVENT_TYPES.includes(eventType)) throw new Error("Choose an event type.");
  const startsAt = normalizedDate(input.starts_at, true, "start date and time");
  const endsAt = normalizedDate(input.ends_at, false, "end date and time");
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) throw new Error("The event end must be after its start.");
  const status = input.status === "published" ? "published" : "draft";
  const visibility = input.visibility === "private" ? "private" : "public";
  const checkout = normalizedProviderUrl(input.checkout_url, input.checkout_provider, true);
  const campaignId = input.campaign_id || null;
  if (campaignId !== null && !UUID.test(campaignId)) throw new Error("Choose a valid IFund campaign.");
  const timezone = typeof input.timezone === "string" && input.timezone.trim()
    ? input.timezone.trim().slice(0,80) : "UTC";
  return {
    campaign_id: campaignId,
    event_type: eventType,
    title: requiredText(input.title, 5, 140, "Event title must be 5 to 140 characters."),
    description: typeof input.description === "string" ? input.description.trim().slice(0,5000) : "",
    starts_at: startsAt,
    ends_at: endsAt,
    timezone,
    venue_name: typeof input.venue_name === "string" ? input.venue_name.trim().slice(0,140) : "",
    location_label: typeof input.location_label === "string" ? input.location_label.trim().slice(0,180) : "",
    ...checkout,
    status,
    visibility,
    ...(status === "published" ? { published_at: new Date().toISOString() } : {}),
    updated_at: new Date().toISOString(),
  };
}

export function normalizeEventItemInput(input = {}) {
  const itemType = String(input.item_type || "");
  if (!ITEM_TYPES.includes(itemType)) throw new Error("Choose an item type.");
  const estimated = input.estimated_value_cents === "" || input.estimated_value_cents == null
    ? null : Number(input.estimated_value_cents);
  const starting = input.starting_bid_cents === "" || input.starting_bid_cents == null
    ? null : Number(input.starting_bid_cents);
  for (const value of [estimated, starting]) {
    if (value !== null && (!Number.isSafeInteger(value) || value < 0 || value > 100000000))
      throw new Error("Enter a valid amount in cents (up to $1,000,000).");
  }
  const checkout = normalizedProviderUrl(input.checkout_url, input.checkout_provider, true);
  return {
    item_type: itemType,
    title: requiredText(input.title, 2, 140, "Item title must be 2 to 140 characters."),
    description: typeof input.description === "string" ? input.description.trim().slice(0,3000) : "",
    estimated_value_cents: estimated,
    starting_bid_cents: starting,
    ...checkout,
    status: input.status === "withdrawn" ? "withdrawn" : "available",
    updated_at: new Date().toISOString(),
  };
}

async function verifiedMember(client) {
  const { data, error } = await client.auth.getUser();
  const user = data?.user;
  if (error || !(isVerifiedEmailUser(user) && payoutIdentity(user)) || !UUID.test(user?.id || "")) {
    throw new Error("Sign in with a confirmed email account to manage events and event activity.");
  }
  const lifecycle = await verifyAccountLifecycle(client, user);
  if (!lifecycle.ok) throw new Error(lifecycle.message || "Account access could not be verified.");
  return user.id;
}
async function requireCurrentTerms(client, owner) {
  const { data, error } = await client.from("ifund_legal_acceptances")
    .select("owner_id,terms_version,explicit_consent,accepted_at")
    .eq("owner_id", owner).eq("terms_version", TERMS_VERSION).maybeSingle();
  if (error || data?.owner_id !== owner || data?.terms_version !== TERMS_VERSION ||
      data?.explicit_consent !== true || !data?.accepted_at) {
    throw new Error("Review and accept the current member agreement before managing events or event activity.");
  }
}

async function sessionUnchanged(client, owner) {
  const { data, error } = await client.auth.getUser();
  if (error || data?.user?.id !== owner) throw new Error("Your account changed. Reload before continuing.");
}
function assertOwner(row, owner, id) {
  if (!row || row.owner_id !== owner || !UUID.test(row.id || "") || (id && row.id !== id)) {
    throw new Error("The event could not be verified as belonging to your account.");
  }
  return row;
}
function assertActivity(row, owner, eventId) {
  if (!row || row.user_id !== owner || row.event_id !== eventId || !UUID.test(row.id || "")) {
    throw new Error("The event activity could not be verified for your account.");
  }
  return row;
}

export async function listPublicEvents(client, { limit = 60 } = {}) {
  const maximum = Math.min(100, Math.max(1, Number(limit) || 60));
  const { data, error } = await client.from("ifund_events")
    .select(PUBLIC_EVENT_COLUMNS)
    .eq("status", "published")
    .eq("visibility", "public")
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(maximum);
  if (error || !Array.isArray(data)) throw new Error("Fundraising events could not be loaded.");
  return data;
}

export async function getEvent(client, id) {
  if (!UUID.test(id || "")) return null;
  const { data, error } = await client.from("ifund_events")
    .select(PUBLIC_EVENT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error("This event could not be loaded.");
  return data || null; // RLS decides whether it is public or owner-visible.
}

export async function listOwnerEvents(client, { limit = 100 } = {}) {
  const owner = await verifiedMember(client);
  const { data, error } = await client.from("ifund_events")
    .select(EVENT_COLUMNS).eq("owner_id", owner)
    .order("starts_at", { ascending: false }).limit(Math.min(200, Math.max(1, limit)));
  if (error || !Array.isArray(data) || data.some(row => row?.owner_id !== owner || !UUID.test(row?.id || ""))) {
    throw new Error("Your events could not be loaded.");
  }
  await sessionUnchanged(client, owner);
  return data;
}

export async function saveOwnerEvent(client, input, { id = null } = {}) {
  if (id !== null && !UUID.test(id || "")) throw new Error("Invalid event reference.");
  const owner = await verifiedMember(client);
  await requireCurrentTerms(client, owner);
  const payload = normalizeEventInput(input);
  if (payload.campaign_id) {
    const { data: campaign, error } = await client.from("ifund_campaigns")
      .select("id,owner_id,status").eq("id", payload.campaign_id).eq("owner_id", owner).maybeSingle();
    if (error || !campaign || campaign.owner_id !== owner)
      throw new Error("Choose a campaign that belongs to your account.");
    if (payload.status === "published" && campaign.status !== "active")
      throw new Error("Publish your linked IFund campaign before publishing its public event.");
  }
  if (id === null) {
    const { data, error } = await client.from("ifund_events")
      .insert({ ...payload, owner_id: owner }).select(EVENT_COLUMNS).single();
    if (error || !data) throw new Error("The event was not saved. Check the details and try again.");
    const row = assertOwner(data, owner);
    if (row.status !== payload.status) throw new Error("The event save could not be confirmed.");
    await sessionUnchanged(client, owner);
    return row;
  }
  const { data: current, error: readError } = await client.from("ifund_events")
    .select("id,owner_id,status").eq("id", id).eq("owner_id", owner).maybeSingle();
  if (readError || !current || current.owner_id !== owner) throw new Error("That event was not found for your account.");
  const { data, error } = await client.from("ifund_events")
    .update(payload).eq("id", id).eq("owner_id", owner).select(EVENT_COLUMNS).maybeSingle();
  if (error || !data) throw new Error("The event could not be updated. Reload and try again.");
  const row = assertOwner(data, owner, id);
  await sessionUnchanged(client, owner);
  return row;
}

export async function listEventItems(client, eventId) {
  if (!UUID.test(eventId || "")) return [];
  const { data, error } = await client.from("ifund_event_items")
    .select(ITEM_COLUMNS).eq("event_id", eventId)
    .order("created_at", { ascending: false }).limit(100);
  if (error || !Array.isArray(data)) throw new Error("Event items could not be loaded.");
  return data;
}

export async function saveOwnerEventItem(client, eventId, input, { id = null } = {}) {
  if (!UUID.test(eventId || "") || (id !== null && !UUID.test(id || "")))
    throw new Error("Invalid event or item reference.");
  const owner = await verifiedMember(client);
  await requireCurrentTerms(client, owner);
  const { data: parent, error: parentError } = await client.from("ifund_events")
    .select("id,owner_id").eq("id", eventId).eq("owner_id", owner).maybeSingle();
  if (parentError || !parent || parent.owner_id !== owner)
    throw new Error("Manage items only on an event owned by your account.");
  const payload = normalizeEventItemInput(input);
  if (id === null) {
    const { data, error } = await client.from("ifund_event_items")
      .insert({ ...payload, event_id: eventId, owner_id: owner })
      .select(ITEM_COLUMNS).single();
    if (error || !data || data.event_id !== eventId)
      throw new Error("The event item could not be saved.");
    await sessionUnchanged(client, owner);
    return data;
  }
  const { data, error } = await client.from("ifund_event_items")
    .update(payload).eq("id", id).eq("event_id", eventId).eq("owner_id", owner)
    .select(ITEM_COLUMNS).maybeSingle();
  if (error || !data || data.event_id !== eventId)
    throw new Error("The event item could not be updated.");
  await sessionUnchanged(client, owner);
  return data;
}

export async function listMyEventActivity(client, { limit = 100 } = {}) {
  const owner = await verifiedMember(client);
  const { data, error } = await client.from("ifund_event_registrations")
    .select(ACTIVITY_COLUMNS).eq("user_id", owner)
    .order("created_at", { ascending: false }).limit(Math.min(200, Math.max(1, limit)));
  if (error || !Array.isArray(data) || data.some(row => row?.user_id !== owner || !UUID.test(row?.id || ""))) {
    throw new Error("Your event activity could not be loaded.");
  }
  await sessionUnchanged(client, owner);
  return data;
}

export async function recordEventActivity(client, {
  eventId, itemId = null, activityType = "rsvp", quantity = 1,
  reportedAmountCents = null, reportedCurrency = "USD", externalReference = null,
} = {}) {
  if (!UUID.test(eventId || "") || (itemId !== null && !UUID.test(itemId || "")))
    throw new Error("Invalid event or item reference.");
  if (!["rsvp","external_purchase_reported"].includes(activityType))
    throw new Error("Unsupported event activity.");
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100)
    throw new Error("Quantity must be from 1 to 100.");
  if (activityType === "rsvp" && (itemId !== null || reportedAmountCents !== null || externalReference !== null))
    throw new Error("An RSVP cannot contain purchase details.");
  if (activityType === "external_purchase_reported" &&
      reportedAmountCents !== null && (!Number.isSafeInteger(reportedAmountCents) ||
        reportedAmountCents < 0 || reportedAmountCents > 100000000))
    throw new Error("Enter an amount from $0 to $1,000,000, or leave it blank.");
  if (typeof reportedCurrency !== "string" || !/^[A-Z]{3}$/.test(reportedCurrency))
    throw new Error("Enter a valid three-letter currency code.");
  if (externalReference !== null &&
      (typeof externalReference !== "string" || externalReference.trim().length > 200))
    throw new Error("The external reference is too long.");
  const owner = await verifiedMember(client);
  await requireCurrentTerms(client, owner);
  const { data: event, error: eventError } = await client.from("ifund_events")
    .select("id,status,visibility,checkout_url")
    .eq("id", eventId).eq("status", "published").eq("visibility", "public").maybeSingle();
  if (eventError || !event)
    throw new Error("Only another organizer's published public event can be added to your activity.");
  let item = null;
  if (itemId) {
    const { data, error } = await client.from("ifund_event_items")
      .select("id,event_id,status,checkout_url").eq("id", itemId).eq("event_id", eventId)
      .eq("status", "available").maybeSingle();
    if (error || !data) throw new Error("That event item is no longer available.");
    item = data;
  }
  if (activityType === "external_purchase_reported" && !(item?.checkout_url || event.checkout_url))
    throw new Error("This event does not have an external checkout link to report against.");
  const row = {
    event_id: eventId,
    item_id: itemId,
    user_id: owner,
    activity_type: activityType,
    status: "active",
    quantity,
    reported_amount_cents: activityType === "external_purchase_reported" ? reportedAmountCents : null,
    reported_currency: activityType === "external_purchase_reported" ? reportedCurrency : "USD",
    external_reference: activityType === "external_purchase_reported" ? (externalReference?.trim() || null) : null,
    reported_at: activityType === "external_purchase_reported" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client.from("ifund_event_registrations")
    .insert(row).select(ACTIVITY_COLUMNS).single();
  if (error) {
    if (error.code === "23505") {
      // Repeated taps return the existing active row rather than creating duplicates.
      let query = client.from("ifund_event_registrations").select(ACTIVITY_COLUMNS)
        .eq("event_id", eventId).eq("user_id", owner).eq("activity_type", activityType).eq("status", "active");
      query = itemId ? query.eq("item_id", itemId) : query.is("item_id", null);
      const existing = await query.maybeSingle();
      if (!existing.error && existing.data) {
        await sessionUnchanged(client, owner);
        return assertActivity(existing.data, owner, eventId);
      }
    }
    throw new Error("Your event activity could not be saved. Please try again.");
  }
  await sessionUnchanged(client, owner);
  return assertActivity(data, owner, eventId);
}

export async function cancelEventActivity(client, activityId) {
  if (!UUID.test(activityId || "")) throw new Error("Invalid event activity reference.");
  const owner = await verifiedMember(client);
  await requireCurrentTerms(client, owner);
  const { data, error } = await client.from("ifund_event_registrations")
    .update({ status: "cancelled" })
    .eq("id", activityId).eq("user_id", owner).eq("status", "active")
    .select(ACTIVITY_COLUMNS).maybeSingle();
  if (error || !data || data.user_id !== owner || data.status !== "cancelled")
    throw new Error("The event activity could not be cancelled.");
  await sessionUnchanged(client, owner);
  return data;
}

export async function updateOwnerEventStatus(client, eventId, status) {
  if (!UUID.test(eventId || "") || !["cancelled","completed"].includes(status))
    throw new Error("Invalid event status change.");
  const owner = await verifiedMember(client);
  await requireCurrentTerms(client, owner);
  const { data, error } = await client.from("ifund_events")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", eventId).eq("owner_id", owner)
    .select(EVENT_COLUMNS).maybeSingle();
  if (error || !data || data.owner_id !== owner || data.status !== status)
    throw new Error("The event status could not be updated.");
  await sessionUnchanged(client, owner);
  return data;
}
