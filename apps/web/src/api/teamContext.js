// Canonical team history API: user-specific Supabase access, no service keys.
// All nine agents share these events for the same verified owner only.
import { isVerifiedEmailUser } from "../lib/verifiedEmailUser.js";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function member(client){
  const {data,error}=await client.auth.getUser();
  if(error||!isVerifiedEmailUser(data?.user)||!UUID.test(data.user.id))
    throw new Error("Sign in to your verified account to view team history.");
  return data.user.id;
}
async function sameOwner(client,owner){
  const {data,error}=await client.auth.getUser();
  if(error||data?.user?.id!==owner) throw new Error("Your account changed. Reload team history.");
}
export async function loadTeamHistory(client,{campaignId=null,limit=30,beforeAt=null,beforeId=null}={}){
  const owner=await member(client);
  if(campaignId!==null&&!UUID.test(campaignId))throw Error("Choose a valid campaign.");
  if(!Number.isSafeInteger(limit)||limit<1||limit>60)throw Error("Invalid history limit.");
  if((beforeAt===null)!==(beforeId===null) ||
    (beforeAt!==null && (typeof beforeAt!=="string"||!Number.isFinite(Date.parse(beforeAt))||!UUID.test(beforeId))))
    throw Error("Invalid history cursor.");
  const {data,error}=await client.rpc("ifund_team_recent",{p_campaign_id:campaignId,p_limit:limit,p_before:beforeAt,p_before_id:beforeId});
  await sameOwner(client,owner);
  if(error) throw new Error("Shared team history is not available yet.");
  if(!Array.isArray(data)||data.some(row=>!UUID.test(row.id)||!["user","agent"].includes(row.speaker)))
    throw Error("The team history response could not be verified.");
  return data;
}
export async function eraseTeamEvent(client,eventKey){
  const owner=await member(client);
  if(!UUID.test(eventKey))throw Error("Invalid conversation event.");
  const {data,error}=await client.rpc("ifund_team_erase",{p_event_key:eventKey});
  await sameOwner(client,owner);
  if(error||data!==true)throw Error("This team event could not be removed.");
  return true;
}

export async function correctTeamStatement(client,oldEventKey,correctedText){
  const owner=await member(client);
  if(!UUID.test(oldEventKey)||typeof correctedText!=="string"||!correctedText.trim()
    ||correctedText.trim().length>4000) throw Error("Enter a valid correction.");
  const {data,error}=await client.rpc("ifund_team_correct",{
    p_old_event_key:oldEventKey,
    p_new_event_key:crypto.randomUUID(),
    p_content:correctedText.trim(),
  });
  await sameOwner(client,owner);
  if(error||!UUID.test(data||""))throw Error("The correction could not be recorded.");
  return data;
}
