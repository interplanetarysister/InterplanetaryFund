// Private wizard metadata uses the existing production relation and its owner
// policies. Campaign records and public Atlas locations remain authoritative.
import { isVerifiedEmailUser } from "../lib/verifiedEmailUser.js";
import { verifyAccountLifecycle } from "../lib/accountLifecycle.js";
import { supportNeed } from "../lib/supportNeeds.mjs";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SETUP_COLUMNS="campaign_id,owner_id,draft_step,end_date,location,location_lat,location_lng,cover_image_is_ai,ai_profile,story_versions,updated_at";
const text=(value,max)=>typeof value==="string"?value.slice(0,max):"";
export function campaignSetupPayload(form={},draftStep=0){
  const brief=form.writing_brief||form.ai_profile?.writing_brief||{};
  const imageStyle=["interstellar","futuristic","cyberpunk","comic"].includes(form.ai_profile?.image_style)?form.ai_profile.image_style:"interstellar";
  const profile={tone:text(form.ai_profile?.tone,200),never_change:text(form.ai_profile?.never_change,2000),image_style:imageStyle,image_caption:text(form.ai_profile?.image_caption,100),
    writing_brief:{wizard_version:2,writingPath:text(brief.writingPath,40),details:text(brief.details,1500),beneficiary:text(brief.beneficiary,100),need:text(brief.need,100),support_type:supportNeed(brief.support_type).id}};
  if(new TextEncoder().encode(JSON.stringify(profile)).length>7900)throw Error("Your writing preferences are too long. Shorten the instructions before saving.");
  const versions=Array.isArray(form.story_versions)?form.story_versions.filter(v=>typeof v?.text==="string"&&v.text.trim()).slice(-20).map(v=>({text:v.text.slice(0,15000),saved_at:text(v.saved_at,50)})):[];
  while(versions.length&&new TextEncoder().encode(JSON.stringify(versions)).length>180000)versions.shift();
  let endDate=null;
  if(form.end_date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(form.end_date)||new Date(form.end_date+"T00:00:00Z").toISOString().slice(0,10)!==form.end_date)
      throw Error("Choose a valid campaign end date.");
    endDate=form.end_date;
  }
  const coordinate=(value,limit)=>{
    if(value===""||value==null)return null;
    const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>limit)throw Error("Choose a valid private campaign location.");return n;
  };
  return {draft_step:Number.isInteger(draftStep)?Math.max(0,Math.min(2,brief.wizard_version===1?(draftStep===3?2:draftStep===2?1:0):draftStep)):0,end_date:endDate,
    location:text(form.location,160),location_lat:coordinate(form.location_lat,90),location_lng:coordinate(form.location_lng,180),
    cover_image_is_ai:form.cover_image_is_ai===true,ai_profile:profile,story_versions:versions};
}
async function ownerFor(client,id,scope){
  if(!UUID.test(id||""))throw Error("Invalid campaign reference.");
  const {data,error}=await client.auth.getUser();
  if(error||!isVerifiedEmailUser(data?.user)||data.user.is_anonymous===true||!UUID.test(data.user.id))throw Error("Sign in with a confirmed account to save campaign setup details.");
  const owner=data.user.id;
  if(scope){scope.assertActive();if(scope.ownerId!==owner)throw Error("The account changed while accessing your campaign setup.");}
  const lifecycle=await verifyAccountLifecycle(client,data.user);
  if(!lifecycle.ok)throw Error(lifecycle.message||"Account access could not be verified.");
  const parent=await client.from("ifund_campaigns").select("id,owner_id,status").eq("id",id).eq("owner_id",owner).maybeSingle();
  if(parent.error||parent.data?.id!==id||parent.data.owner_id!==owner)throw Error("That campaign was not found for your account.");
  await sameOwner(client,owner);
  return owner;
}
async function sameOwner(client,owner){
  const current=await client.auth.getUser();
  if(current.error||current.data?.user?.id!==owner)throw Error("The account changed while accessing your campaign setup.");
}
function assertRow(data,id,owner){
  if(data&&(data.campaign_id!==id||data.owner_id!==owner))throw Error("The campaign setup was not verified for your account.");
}
export async function loadCampaignSetup(client,id,scope){
  const owner=await ownerFor(client,id,scope);
  scope?.assertActive();
  const {data,error}=await client.from("ifund_campaign_creation_state").select(SETUP_COLUMNS).eq("campaign_id",id).eq("owner_id",owner).maybeSingle();
  if(error)throw Error("Campaign setup details could not be loaded. Please retry before editing.");
  assertRow(data,id,owner);await sameOwner(client,owner);return data||null;
}
export async function saveCampaignSetup(client,id,form,step,scope){
  const owner=await ownerFor(client,id,scope),payload=campaignSetupPayload(form,step);
  const existing=await client.from("ifund_campaign_creation_state").select("campaign_id,owner_id,updated_at").eq("campaign_id",id).eq("owner_id",owner).maybeSingle();
  if(existing.error)throw Error("Your campaign setup could not be checked before saving.");
  assertRow(existing.data,id,owner);await sameOwner(client,owner);
  scope?.assertActive();
  let query=client.from("ifund_campaign_creation_state");
  if(existing.data){
    query=query.update({...payload,updated_at:new Date().toISOString()}).eq("campaign_id",id).eq("owner_id",owner);
    if(existing.data.updated_at)query=query.eq("updated_at",existing.data.updated_at);
  }else query=query.insert({campaign_id:id,owner_id:owner,...payload});
  const {data,error}=await query.select(SETUP_COLUMNS).maybeSingle();
  if(error||!data)throw Error("The campaign is saved, but its setup details were not confirmed. Retry saving this draft before leaving.");
  assertRow(data,id,owner);await sameOwner(client,owner);return data;
}
