// Independent per-user campaign follows. Original source:
// legacy entity and action contract; no legacy SDK or service is called.
// All operations use canonical auth.uid() and database RLS; never a service key.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEFAULT_FOLLOW_PREFS=Object.freeze({
  updates:true,media:true,milestones:true,goal_reached:true,
  nearing_completion:true,comments:false,volunteer:true,events:true,
  emergencies:true,completed:true
});
const OWN_FIELDS="id,owner_id,campaign_id,pinned,archived,notification_prefs,last_viewed,created_at";
const CAMPAIGN_FIELDS="id,title,summary,category,goal_amount,cover_image_url,status,created_at,updated_at";

export function validateFollowPrefs(input) {
  if(!input || typeof input!=="object" || Array.isArray(input) ||
    Object.keys(input).length!==Object.keys(DEFAULT_FOLLOW_PREFS).length ||
    Object.keys(DEFAULT_FOLLOW_PREFS).some(key=>typeof input[key]!=="boolean") ||
    Object.keys(input).some(key=>!Object.hasOwn(DEFAULT_FOLLOW_PREFS,key)))
      throw new Error("Invalid follow notification preferences.");
  return {...input};
}

async function userId(client){
  const {data,error}=await client.auth.getUser();
  if(error || !UUID.test(data?.user?.id||""))throw new Error("Sign in to manage followed campaigns.");
  return data.user.id;
}

export async function listMyFollows(client){
  const owner=await userId(client);
  const {data,error}=await client.from("ifund_follows")
    .select(OWN_FIELDS).eq("owner_id",owner)
    .order("created_at",{ascending:false}).limit(100);
  if(error || !Array.isArray(data))throw new Error("Followed campaigns could not be loaded.");
  const ids=[...new Set(data.map(item=>item.campaign_id).filter(id=>UUID.test(id)))];
  if(ids.length===0)return data.map(follow=>({follow,campaign:null}));
  const response=await client.from("ifund_campaigns")
    .select(CAMPAIGN_FIELDS).eq("status","active").in("id",ids).limit(100);
  if(response.error || !Array.isArray(response.data))
    throw new Error("Followed campaign details could not be verified.");
  const active=new Map(response.data.map(item=>[item.id,item]));
  return data.map(follow=>({follow,campaign:active.get(follow.campaign_id)||null}));
}

export async function isFollowingCampaign(client,campaignId){
  if(!UUID.test(campaignId||""))return false;
  const owner=await userId(client);
  const {data,error}=await client.from("ifund_follows").select("id")
    .eq("owner_id",owner).eq("campaign_id",campaignId).maybeSingle();
  if(error)throw new Error("Follow status could not be verified.");
  return !!data?.id;
}

export async function setCampaignFollow(client,campaignId,shouldFollow){
  if(!UUID.test(campaignId||"") || typeof shouldFollow!=="boolean")throw new Error("Invalid follow request.");
  const owner=await userId(client);
  if(shouldFollow){
    const {data:campaign,error:campaignError}=await client.from("ifund_campaigns")
      .select("id,status").eq("id",campaignId).eq("status","active").maybeSingle();
    if(campaignError || campaign?.id!==campaignId)throw new Error("This campaign is not available to follow.");
    const {data,error}=await client.from("ifund_follows")
      .upsert({owner_id:owner,campaign_id:campaignId,notification_prefs:{...DEFAULT_FOLLOW_PREFS}},
        {onConflict:"owner_id,campaign_id",ignoreDuplicates:true})
      .select("id,owner_id,campaign_id").maybeSingle();
    if(error)throw new Error("Follow could not be saved.");
    // Supabase may return no representation for ignored duplicates; verify it.
    if(data && (data.owner_id!==owner || data.campaign_id!==campaignId))
      throw new Error("Follow response identity mismatch.");
    const verified=await isFollowingCampaign(client,campaignId);
    if(!verified)throw new Error("Follow was not confirmed.");
    return true;
  }
  const {data,error}=await client.from("ifund_follows")
    .delete().eq("owner_id",owner).eq("campaign_id",campaignId)
    .select("id,owner_id");
  if(error || !Array.isArray(data) || data.some(row=>row.owner_id!==owner))
    throw new Error("Unfollow could not be confirmed.");
  if(await isFollowingCampaign(client,campaignId))
    throw new Error("Unfollow was not confirmed.");
  return false;
}

export async function changeFollow(client,followId,change){
  if(!UUID.test(followId||"") || !change || typeof change!=="object" ||
    Array.isArray(change) || Object.keys(change).length!==1)
    throw new Error("Invalid follow update.");
  const [field]=Object.keys(change);
  if(!["pinned","archived","notification_prefs","last_viewed"].includes(field))
    throw new Error("Unsupported follow update.");
  const value=change[field];
  if(field==="notification_prefs")validateFollowPrefs(value);
  else if(field==="pinned"||field==="archived"){
    if(typeof value!=="boolean")throw new Error("Invalid follow update.");
  } else if(typeof value!=="string" || Number.isNaN(Date.parse(value)))
    throw new Error("Invalid last-viewed timestamp.");
  const owner=await userId(client);
  const {data,error}=await client.from("ifund_follows")
    .update({[field]:value}).eq("id",followId).eq("owner_id",owner)
    .select(OWN_FIELDS).maybeSingle();
  if(error || !data || data.owner_id!==owner || data[field]===undefined)
    throw new Error("Follow preference was not saved.");
  if(field==="notification_prefs" &&
    Object.keys(DEFAULT_FOLLOW_PREFS).some(key=>data.notification_prefs?.[key]!==value[key]))
    throw new Error("Follow preferences were not confirmed.");
  if(["pinned","archived"].includes(field) && data[field]!==value)
    throw new Error("Follow preference was not confirmed.");
  return data;
}
