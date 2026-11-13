import { authClient } from "@/api/auth";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const LIMIT = 50;

function check(error, message) {
  if (error) throw new Error(message);
}
export async function listPublicCommunities() {
  const { data, error } = await authClient()
    .from("ifund_member_communities")
    .select("id,name,description,location,created_at,owner_id")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  check(error, "Verified communities could not be loaded.");
  if (!Array.isArray(data)) throw new Error("Community directory response unavailable.");
  return data;
}
export async function getPublicCommunity(id) {
  if (!UUID.test(String(id || ""))) return null;
  const { data, error } = await authClient()
    .from("ifund_member_communities")
    .select("id,name,description,location,status,owner_id,created_at")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  check(error, "Community details could not be verified.");
  return data || null;
}
async function verifiedMember() {
  const client = authClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id || data.user.is_anonymous === true) {
    throw new Error("Sign in with a verified account to participate in communities.");
  }
  return { client, memberId: data.user.id };
}
export async function createCommunity(input) {
  const name = String(input?.name || "").trim();
  const description = String(input?.description || "").trim();
  const location = String(input?.location || "").trim();
  if (name.length < 3 || name.length > 90 || description.length < 15 ||
      description.length > 2000 || location.length > 120)
    throw new Error("Enter a name (3–90 characters), a description (15–2000), and an optional location.");
  const { client, memberId } = await verifiedMember();
  const { data, error } = await client.from("ifund_member_communities")
    .insert({ owner_id: memberId, name, description, location })
    .select("id,owner_id,name").single();
  check(error, "Community creation requires an active account and accepted terms.");
  if (!data?.id || data.owner_id !== memberId)
    throw new Error("Community creation could not be confirmed.");
  return data;
}
export async function getMyMembership(communityId) {
  if (!UUID.test(String(communityId || ""))) return false;
  const { client, memberId } = await verifiedMember();
  const { data, error } = await client.from("ifund_member_community_memberships")
    .select("community_id,member_id")
    .eq("community_id", communityId).eq("member_id", memberId).maybeSingle();
  check(error, "Your membership could not be verified.");
  return data?.member_id === memberId && data.community_id === communityId;
}
export async function changeMyMembership(communityId, joining) {
  if (!UUID.test(String(communityId || ""))) throw new Error("Invalid community.");
  const { client, memberId } = await verifiedMember();
  if (joining) {
    const { error } = await client.from("ifund_member_community_memberships")
      .insert({ community_id: communityId, member_id: memberId });
    if (error && error.code !== "23505") throw new Error("You could not join this community.");
  } else {
    const { error } = await client.from("ifund_member_community_memberships")
      .delete().eq("community_id", communityId).eq("member_id", memberId);
    check(error, "You could not leave this community.");
  }
  const actual = await getMyMembership(communityId);
  if (actual !== joining) throw new Error("Membership change was not confirmed.");
  return actual;
}
