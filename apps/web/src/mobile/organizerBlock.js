// Local abuse controls for the independently bundled native review app.
// Owner IDs are intentionally requested ONLY through signed-in RLS, never
// exposed by anonymous campaign queries or displayed in the interface.
import { authClient } from "@/api/auth";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BLOCKED=250;
export function blockedOrganizerKey(userId) {
  if(!UUID.test(String(userId||""))) throw new TypeError("Verified account ID required");
  return "ifund-native-blocked-organizers:"+userId;
}
export function readBlockedOrganizers(userId, storage=globalThis.localStorage) {
  if(!UUID.test(String(userId||""))) return [];
  try{
    const values=JSON.parse(storage.getItem(blockedOrganizerKey(userId))||"[]");
    return Array.isArray(values)?[...new Set(values.filter(value=>UUID.test(value)))].slice(0,MAX_BLOCKED):[];
  }catch{return [];}
}
export function blockOrganizer(userId, ownerId, storage=globalThis.localStorage) {
  if(!UUID.test(String(ownerId||""))||!UUID.test(String(userId||""))||ownerId===userId)
    throw new TypeError("A verified organizer, different from the current user, is required");
  const ids=readBlockedOrganizers(userId,storage);
  storage.setItem(blockedOrganizerKey(userId),JSON.stringify([...new Set([...ids,ownerId])].slice(-MAX_BLOCKED)));
}
export function clearBlockedOrganizers(userId,storage=globalThis.localStorage) {
  if(UUID.test(String(userId||""))) storage.removeItem(blockedOrganizerKey(userId));
}
export async function verifiedOrganizersForCampaigns(campaignIds, client=authClient()){
  if(!Array.isArray(campaignIds)||campaignIds.length>100 ||
     campaignIds.some(id=>!UUID.test(String(id||""))))
    throw new TypeError("Only published canonical campaign IDs may be resolved");
  if(campaignIds.length===0)return new Map();
  const {data:identity,error:authError}=await client.auth.getUser();
  if(authError||!identity?.user?.id||identity.user.is_anonymous)
    return new Map();
  // Authenticated SELECT of owner_id is permitted by owner-protected RLS for
  // active public campaigns; anon has NO owner_id column access.
  const {data,error}=await client.from("ifund_campaigns")
    .select("id,owner_id").eq("status","active").in("id",campaignIds);
  if(error)throw new Error("Organizer identities could not be verified.");
  const requested=new Set(campaignIds);
  const mapped=new Map();
  for(const row of data||[]){
    if(requested.has(row.id)&&UUID.test(row.owner_id||"")) mapped.set(row.id,row.owner_id);
  }
  return mapped;
}
