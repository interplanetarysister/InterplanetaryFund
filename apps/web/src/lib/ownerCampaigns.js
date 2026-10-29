// Canonical Supabase owner-scoped campaign operations.
// The user's identity always comes from auth.getUser(), never browser input.
export const CAMPAIGN_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const OWNED_COLUMNS = "id,title,summary,story,category,goal_amount,cover_image_url,status,created_at,updated_at";

async function currentUser(client) {
  const { data, error } = await client.auth.getUser();
  if (error) throw new Error("Your account could not be verified.");
  if (!data?.user?.id) throw new Error("Sign in to manage your campaigns.");
  return data.user;
}

export async function loadOwnedCampaigns(client) {
  const user = await currentUser(client);
  const { data, error } = await client.from("ifund_campaigns")
    .select(OWNED_COLUMNS)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Your campaigns could not be loaded.");
  return data || [];
}

export async function deleteOwnedDraft(client, campaignId) {
  if (!CAMPAIGN_UUID.test(String(campaignId || ""))) throw new Error("Invalid draft reference.");
  const user = await currentUser(client);
  // Database RLS and exact filters both enforce ownership. No active campaign
  // or donor-related record may be deleted through this operation.
  const { data, error } = await client.from("ifund_campaigns")
    .delete()
    .eq("id", campaignId)
    .eq("owner_id", user.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Unable to remove this private draft.");
  if (!data?.id) throw new Error("Private draft was not found or cannot be deleted.");
  return data.id;
}
