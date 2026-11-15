// Authenticated cross-device creator blocking backed by the ONE canonical
// IFund Supabase service. This module never caches blocked account identities
// on a shared device or grants anonymous visitors access to organizer IDs.
import { authClient } from "@/api/auth";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid=value=>typeof value==="string"&&UUID.test(value);

async function verifiedMember(client) {
  const {data,error}=await client.auth.getUser();
  if(error||!isUuid(data?.user?.id)||data.user.is_anonymous===true||
      !data.user.email_confirmed_at)
    throw new Error("Sign in with a confirmed email account to manage organizer blocks.");
  return data.user.id;
}

export async function blockedOrganizerIds(client=authClient()) {
  await verifiedMember(client);
  const {data,error}=await client.from("ifund_mobile_organizer_blocks")
    .select("organizer_id").limit(250);
  if(error||!Array.isArray(data))
    throw new Error("Organizer blocking preferences could not be verified.");
  if(data.some(row=>!isUuid(row.organizer_id)))
    throw new Error("The organizer block list could not be validated.");
  return [...new Set(data.map(row=>row.organizer_id))];
}

export async function blockOrganizer(organizerId,client=authClient()) {
  const member=await verifiedMember(client);
  if(!isUuid(organizerId)||member===organizerId)
    throw new TypeError("Choose a valid, different campaign organizer.");
  const {data,error}=await client.rpc("ifund_mobile_block_organizer",{
    p_organizer:organizerId,
  });
  if(error||data!==true)
    throw new Error(error?.message||"The service did not confirm this organizer was blocked.");
  // Verify the owner-scoped row after mutation before showing success.
  const blocked=await blockedOrganizerIds(client);
  if(!blocked.includes(organizerId))
    throw new Error("The organizer block could not be verified.");
  return true;
}

export async function unblockOrganizer(organizerId,client=authClient()) {
  const member=await verifiedMember(client);
  if(!isUuid(organizerId)||member===organizerId)
    throw new TypeError("Invalid organizer to unblock.");
  const {data,error}=await client.rpc("ifund_mobile_unblock_organizer",{
    p_organizer:organizerId,
  });
  if(error||data!==true)
    throw new Error(error?.message||"The service did not confirm this organizer was unblocked.");
  const blocked=await blockedOrganizerIds(client);
  if(blocked.includes(organizerId))
    throw new Error("Organizer unblock could not be verified.");
  return true;
}

export async function verifiedOrganizersForCampaigns(campaignIds, client=authClient()){
  if(!Array.isArray(campaignIds)||campaignIds.length>100 ||
    campaignIds.some(id=>!isUuid(id)))
    throw new TypeError("Only valid canonical campaign IDs may be resolved.");
  if(campaignIds.length===0)return new Map();
  await verifiedMember(client);
  // Anonymous visitors lack owner_id column access. This authenticated,
  // active-only RLS query does not grant access to private campaigns.
  const {data,error}=await client.from("ifund_campaigns")
    .select("id,owner_id").eq("status","active").in("id",campaignIds);
  if(error||!Array.isArray(data))
    throw new Error("Campaign organizer authorization could not be verified.");
  const allowed=new Set(campaignIds);
  const result=new Map();
  for(const row of data){
    if(allowed.has(row.id)&&isUuid(row.owner_id))result.set(row.id,row.owner_id);
  }
  return result;
}
