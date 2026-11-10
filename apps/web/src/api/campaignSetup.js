// Owner-private Base44-compatible creation state. Public campaign fields stay
// in ifund_campaigns; optional instructions, location, revisions and progress stay
// in the separately RLS-protected ifund_campaign_creation_state relation.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = "campaign_id,owner_id,draft_step,end_date,location,location_lat,location_lng,cover_image_is_ai,ai_profile,story_versions";
const cleanText = (v, max) => String(v || "").trim().slice(0, max);

export function campaignSetupPayload(form, draftStep = 0) {
  const aiProfile = form?.ai_profile && typeof form.ai_profile === "object" && !Array.isArray(form.ai_profile)
    ? { tone: cleanText(form.ai_profile.tone, 200), never_change: cleanText(form.ai_profile.never_change, 2000) }
    : {};
  const versions = Array.isArray(form?.story_versions) ? form.story_versions
    .filter(v => typeof v?.text === "string" && v.text.trim())
    .slice(-20).map(v => ({ text: v.text.slice(0, 15000), saved_at: cleanText(v.saved_at, 50) })) : [];
  const latitude = form?.location_lat === "" || form?.location_lat == null ? null : Number(form.location_lat);
  const longitude = form?.location_lng === "" || form?.location_lng == null ? null : Number(form.location_lng);
  return {
    draft_step: Number.isInteger(draftStep) ? Math.max(0, Math.min(3, draftStep)) : 0,
    end_date: /^\d{4}-\d{2}-\d{2}$/.test(form?.end_date || "") ? form.end_date : null,
    location: cleanText(form?.location, 160),
    location_lat: Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 ? latitude : null,
    location_lng: Number.isFinite(longitude) && longitude >= -180 && longitude <= 180 ? longitude : null,
    cover_image_is_ai: form?.cover_image_is_ai === true,
    ai_profile: aiProfile,
    story_versions: versions,
  };
}
async function confirmedIdentity(client) {
  const { data, error } = await client.auth.getUser();
  if (error || !UUID.test(data?.user?.id || "") || !data.user.email_confirmed_at)
    throw new Error("Sign in with a confirmed account to save campaign setup details.");
  return data.user.id;
}
export async function loadCampaignSetup(client, campaignId) {
  if (!UUID.test(campaignId || "")) throw new Error("Invalid campaign reference.");
  const owner = await confirmedIdentity(client);
  const { data, error } = await client.from("ifund_campaign_creation_state")
    .select(COLUMNS).eq("campaign_id", campaignId).eq("owner_id", owner).maybeSingle();
  if (error) throw new Error("Campaign setup details could not be loaded.");
  if (data && (data.campaign_id !== campaignId || data.owner_id !== owner))
    throw new Error("The campaign setup was not verified for your account.");
  return data || null;
}
export async function saveCampaignSetup(client, campaignId, form, draftStep) {
  if (!UUID.test(campaignId || "")) throw new Error("Invalid campaign reference.");
  const owner = await confirmedIdentity(client);
  const payload = { campaign_id: campaignId, owner_id: owner, ...campaignSetupPayload(form, draftStep) };
  const { data, error } = await client.from("ifund_campaign_creation_state")
    .upsert(payload, { onConflict: "campaign_id" }).select(COLUMNS).single();
  if (error || data?.campaign_id !== campaignId || data?.owner_id !== owner)
    throw new Error("The campaign was saved, but its setup details were not confirmed. Find it in My campaigns before retrying.");
  const { data: after, error: changed } = await client.auth.getUser();
  if (changed || after?.user?.id !== owner)
    throw new Error("The account changed while saving your campaign setup.");
  return data;
}
