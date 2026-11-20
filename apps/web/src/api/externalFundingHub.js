import { isVerifiedEmailUser } from "../lib/verifiedEmailUser.js";
import { payoutIdentity } from "../lib/guestAccess.js";
import { verifyAccountLifecycle } from "../lib/accountLifecycle.js";
import { canonicalExternalFundraiserUrl,parseReportedAmount } from "../lib/externalFundingHub.mjs";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GROUPS="ifund_external_fundraiser_groups";
const SOURCES="ifund_external_fundraiser_sources";

async function owner(client) {
 const {data,error}=await client.auth.getUser();const u=data?.user;
 if(error||!UUID.test(u?.id||"")||!isVerifiedEmailUser(u)||!payoutIdentity(u))
   throw Error("Confirm an IFund account to manage externally hosted fundraisers.");
 const lifecycle=await verifyAccountLifecycle(client,u);
 if(!lifecycle.ok)throw Error("Your account is not currently eligible to manage fundraisers.");
 return u.id;
}
async function sameOwner(client,id) {
 const {data,error}=await client.auth.getUser();
 if(error||data?.user?.id!==id) throw Error("Your account changed during this action.");
}
function assertRows(rows,id){
 if(!Array.isArray(rows)||rows.some(x=>x?.owner_id!==id||!UUID.test(x?.id||"")))
   throw Error("Source records could not be verified for this account.");
 return rows;
}
export async function listExternalFundingHub(client) {
 const id=await owner(client);
 const [groups,sources]=await Promise.all([
  client.from(GROUPS).select("id,owner_id,title,created_at").eq("owner_id",id).order("created_at",{ascending:false}).limit(100),
  client.from(SOURCES).select("id,owner_id,group_id,platform,campaign_url,amount_cents,currency,provenance,reported_at,updated_at")
    .eq("owner_id",id).order("created_at",{ascending:false}).limit(500),
 ]);
 if(groups.error||sources.error)throw Error("Fundraising sources are unavailable.");
 const g=assertRows(groups.data,id),s=assertRows(sources.data,id);
 if(s.some(row=>!g.some(group=>group.id===row.group_id)||row.provenance!=="owner_reported"))
  throw Error("External fundraising source ownership or provenance could not be confirmed.");
 await sameOwner(client,id);return {groups:g,sources:s};
}
async function confirmed(client,ownerId,query) {
 const r=await query.select();
 const rows=r.data;
 if(r.error||!Array.isArray(rows)||rows.length!==1||rows[0].owner_id!==ownerId)
  throw Error("This change could not be confirmed. Reload the funding hub.");
 await sameOwner(client,ownerId);
 return rows[0];
}
export async function createExternalFundraiserGroup(client,title) {
 const id=await owner(client);
 if(typeof title!=="string"||title.trim().length<3||title.trim().length>160)throw Error("Add a campaign name.");
 return confirmed(client,id,client.from(GROUPS).insert({owner_id:id,title:title.trim()}));
}
export async function addExternalFundraisingSource(client,{groupId,platform,url}){
 const id=await owner(client);
 if(!UUID.test(groupId||""))throw Error("Choose your campaign first.");
 const canonical=canonicalExternalFundraiserUrl(platform,url);
 const {data,error}=await client.from(GROUPS).select("id,owner_id").eq("id",groupId).eq("owner_id",id).maybeSingle();
 if(error||data?.owner_id!==id)throw Error("Your campaign could not be verified.");
 return confirmed(client,id,client.from(SOURCES).insert({
   owner_id:id,group_id:groupId,platform,campaign_url:canonical,currency:"USD",provenance:"owner_reported"
 }));
}
export async function setExternalReportedAmount(client,source,amount,currency="USD"){
 const id=await owner(client);
 if(!UUID.test(source?.id||"")||source?.owner_id!==id)throw Error("Choose one of your connected campaign links.");
 if(!/^[A-Z]{3}$/.test(currency))throw Error("Choose a valid currency.");
 const cents=parseReportedAmount(amount);
 return confirmed(client,id,client.from(SOURCES).update({
  amount_cents:cents,currency,reported_at:new Date().toISOString()
 }).eq("id",source.id).eq("owner_id",id).eq("provenance","owner_reported"));
}
export async function removeExternalFundingSource(client,source) {
 const id=await owner(client);
 if(!UUID.test(source?.id||"")||source?.owner_id!==id)throw Error("Choose your own campaign source.");
 const result=await client.from(SOURCES).delete().eq("id",source.id).eq("owner_id",id).select("id,owner_id");
 if(result.error||result.data?.length!==1||result.data[0].owner_id!==id)
  throw Error("This link could not be removed. Refresh and try again.");
 await sameOwner(client,id);
}
