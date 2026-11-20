import { authClient } from "@/api/auth";
import { validateMerchDesignRequest } from "@/lib/campaignMerch.mjs";

export const MERCH_DRAFTS_ENABLED = import.meta.env.VITE_IFUND_MERCH_DRAFTS_ENABLED === "enabled";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function ownerCampaign(client, campaignId) {
  if (!UUID.test(String(campaignId || ""))) throw new Error("Choose a valid saved campaign.");
  const before = await client.auth.getUser();
  const owner = before.data?.user;
  if (before.error || !owner?.id || owner.is_anonymous || !owner.email_confirmed_at)
    throw new Error("Verified email sign-in is required to save merchandise designs.");
  const { data, error } = await client.from("ifund_campaigns")
    .select("id,owner_id,cover_image_url")
    .eq("id", campaignId).eq("owner_id", owner.id).maybeSingle();
  if (error || !data || data.owner_id !== owner.id)
    throw new Error("That campaign is not available in your account.");
  return { ownerId: owner.id, campaign: data };
}
export async function saveOwnerMerchDraft(input, client = authClient()) {
  if (!MERCH_DRAFTS_ENABLED)
    throw new Error("Saved merchandise designs are not yet enabled.");
  const validated = validateMerchDesignRequest(input);
  if (!validated.ok) throw new Error(validated.error);
  const { ownerId, campaign } = await ownerCampaign(client, input.campaignId);
  const { data, error } = await client.from("ifund_campaign_merch_designs").upsert({
    campaign_id: campaign.id,
    owner_id: ownerId,
    design_id: validated.designId,
    beneficiary_display_name: validated.beneficiaryName,
    source_cover_url: campaign.cover_image_url || "",
    status: "draft",
  }, { onConflict: "campaign_id" }).select("id,campaign_id,owner_id,design_id,beneficiary_display_name,status,updated_at").single();
  if (error || !data || data.owner_id !== ownerId || data.campaign_id !== campaign.id)
    throw new Error("Your merchandise design could not be confirmed as saved.");
  const after = await client.auth.getUser();
  if (after.error || after.data?.user?.id !== ownerId)
    throw new Error("Your account changed while saving. Reopen your own campaign.");
  return data;
}
export async function loadOwnerMerchDraft(campaignId, client = authClient()) {
  if (!MERCH_DRAFTS_ENABLED)
    return null;
  const { ownerId, campaign } = await ownerCampaign(client, campaignId);
  const { data, error } = await client.from("ifund_campaign_merch_designs")
    .select("id,campaign_id,owner_id,design_id,beneficiary_display_name,status,updated_at")
    .eq("campaign_id", campaign.id).eq("owner_id", ownerId).maybeSingle();
  if (error) throw new Error("Your saved merchandise design could not be loaded.");
  if (data && (data.owner_id !== ownerId || data.campaign_id !== campaign.id))
    throw new Error("Merchandise design ownership could not be verified.");
  return data || null;
}
