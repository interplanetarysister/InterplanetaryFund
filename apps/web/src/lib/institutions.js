// Independent, publication-approved institutional discovery.
// Original: Institution, InstitutionOpportunity; never expose applications.
import {authClient} from "@/api/auth";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS="id,name,type,mission,description,industry,location,website,causes_supported,logo_url,offers_matching_gifts,offers_volunteer_program,offers_grants,verification_status,is_public,public_approved_at,created_at";
const OPPORTUNITY_FIELDS="id,institution_id,title,category,description,award_amount,eligibility,requirements,deadline,status,approved_for_public,created_at";

export function safeInstitutionWebsite(url){
  if(typeof url!=="string"||url.length>2048)return null;
  try{
    const u=new URL(url);
    if(!["https:","http:"].includes(u.protocol)||u.username||u.password)return null;
    return u.href;
  }catch{return null}
}

export async function listApprovedInstitutions(){
  const {data,error}=await authClient().from("ifund_institutions")
    .select(FIELDS).eq("is_public",true).not("public_approved_at","is",null)
    .order("created_at",{ascending:false}).limit(100);
  if(error||!Array.isArray(data))throw Error("Approved institutions could not be loaded.");
  return data.filter(i=>i.is_public===true&&i.public_approved_at);
}

export async function getApprovedInstitution(id){
  if(!UUID.test(id||""))return null;
  const {data,error}=await authClient().from("ifund_institutions")
    .select(FIELDS).eq("id",id).eq("is_public",true)
    .not("public_approved_at","is",null).maybeSingle();
  if(error)throw Error("Institution record unavailable.");
  if(!data||data.is_public!==true||!data.public_approved_at)return null;
  return data;
}

export async function listApprovedOpportunities(institutionId){
  if(!UUID.test(institutionId||""))return [];
  const {data,error}=await authClient().from("ifund_institution_opportunities")
    .select(OPPORTUNITY_FIELDS).eq("institution_id",institutionId)
    .eq("approved_for_public",true)
    .order("created_at",{ascending:false}).limit(100);
  if(error||!Array.isArray(data))throw Error("Institution opportunities could not be loaded.");
  return data.filter(o=>o.institution_id===institutionId&&o.approved_for_public===true);
}
