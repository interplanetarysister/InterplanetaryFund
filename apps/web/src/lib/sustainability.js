// Original SustainabilityAudit entity and SustainabilityAdmin read/write
// replacement. No server-role credentials in browser, no simulated metrics.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS=new Set(["browser_sample","hosting","efficiency","environmental_impact"]);
const COLUMNS="id,author_id,kind,summary,observed_at,source_url,notes,verification_status,transfer_bytes_observed,resource_count_observed,resources_missing_transfer_data,created_at";
async function adminId(client){
 const {data,error}=await client.auth.getUser();
 const user=data?.user;
 if(error||!UUID.test(user?.id||"")||
   !["admin","super_admin"].includes(user?.app_metadata?.role))
   throw new Error("Verified administrator session is required.");
 return user.id;
}

export async function listEnvironmentCampaigns(client){
 await adminId(client);
 const {data,error}=await client.from("ifund_campaigns")
  .select("id,title,summary,category,status,cover_image_url")
  .eq("category","environment").eq("status","active")
  .order("created_at",{ascending:false}).limit(100);
 if(error||!Array.isArray(data))throw new Error("Environmental campaigns could not be loaded.");
 return data.filter(x=>x.category==="environment"&&x.status==="active");
}
export async function listSustainabilityAudits(client){
 await adminId(client);
 const {data,error}=await client.from("ifund_sustainability_audits")
  .select(COLUMNS).order("created_at",{ascending:false}).limit(25);
 if(error||!Array.isArray(data))throw new Error("Recorded sustainability evidence could not be loaded.");
 return data;
}
export function validateSustainabilityEvidence(input){
 if(!input||typeof input!=="object"||!KINDS.has(input.kind))
  throw new Error("Invalid sustainability evidence type.");
 const summary=String(input.summary||"").trim();
 const notes=String(input.notes||"").trim();
 const observed_at=String(input.observed_at||"").trim();
 const source_url=String(input.source_url||"").trim();
 const verification_status=input.verification_status||
   (source_url?"documented":"unverified");
 if(summary.length<1||summary.length>220||notes.length>2000||
    !Number.isFinite(Date.parse(observed_at))||
    !["documented","unverified"].includes(verification_status))
   throw new Error("Invalid sustainability evidence fields.");
 if(source_url){
  try{
   const url=new URL(source_url);
   if(url.protocol!=="https:"||url.username||url.password||
      source_url.length>2000)throw Error();
  }catch{throw new Error("Evidence link must be a safe https:// URL.");}
 }
 const safe={kind:input.kind,summary,notes,observed_at,
   source_url:source_url||null,verification_status};
 for(const name of ["transfer_bytes_observed","resource_count_observed",
   "resources_missing_transfer_data"]){
  if(input[name]===undefined||input[name]===null)continue;
  const number=Number(input[name]);
  if(!Number.isSafeInteger(number)||number<0)throw new Error("Invalid browser sample count.");
  safe[name]=number;
 }
 if(input.kind==="browser_sample" && (
    safe.transfer_bytes_observed===undefined||
    safe.resource_count_observed===undefined||
    safe.resources_missing_transfer_data===undefined))
   throw new Error("Incomplete browser observation.");
 return safe;
}
export async function saveSustainabilityEvidence(client,input){
 const admin=await adminId(client);
 const record=validateSustainabilityEvidence(input);
 const {data,error}=await client.from("ifund_sustainability_audits")
  .insert({...record,author_id:admin})
  .select(COLUMNS).maybeSingle();
 if(error||!data||!UUID.test(data.id||"")||data.author_id!==admin ||
    data.verification_status!==record.verification_status)
   throw new Error("Sustainability evidence was not confirmed as saved.");
 return data;
}
