// Public read-only sponsor offers. Postgres RLS is authoritative.
// No enrolment, payment capture, sponsorship claims, payout or reward mutation.
const ORIGIN="https://ssibsfmtodgximseeqsv.supabase.co";
const json=(body,status=200,stage="ok")=>Response.json(body,{status,headers:{"cache-control":"no-store","x-content-type-options":"nosniff","x-ifund-catalog-stage":stage}});
const safeHttps=value=>{try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}};
const validAmount=value=>Number.isSafeInteger(Number(value))&&Number(value)>0&&Number(value)<=100000000;
export async function onRequest({request,env,fetch:incomingFetch}) {
 if(request.method!=="GET")return json({error:"Method not allowed"},405);
 const serviceUrl=env.SUPABASE_URL||env.VITE_SUPABASE_URL;
 const publishableKey=env.SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY;
 if(serviceUrl!==ORIGIN || !publishableKey)
  return json({error:"Sponsor catalog unavailable"},503,"config");
 const get=typeof incomingFetch==="function"?incomingFetch:fetch;
 const headers={apikey:publishableKey,accept:"application/json"};
 const offersUrl=ORIGIN+"/rest/v1/ifund_sponsor_opportunities?select="+encodeURIComponent("id,sponsor_id,source_kind,title,summary,requirements,official_url,geography,eligibility,reward_minor,currency,compensation_basis,starts_at,ends_at,verified_at")+"&state=eq.published&order=verified_at.desc&limit=30";
 const sponsorsUrl=ORIGIN+"/rest/v1/ifund_sponsor_organizations?select="+encodeURIComponent("id,display_name,official_url,partner_claim_allowed")+"&verification_state=eq.approved&limit=100";
 let stage="request";
 try {
  const [a,b]=await Promise.all([offersUrl,sponsorsUrl].map(url=>get(url,{headers,redirect:"error",signal:AbortSignal.timeout(8000)})));
  if(!a.ok||!b.ok)return json({error:"Sponsor catalog unavailable"},503,"upstream_"+a.status+"_"+b.status);
  stage="json";
  const [offers,sponsors]=await Promise.all([a.json(),b.json()]);
  if(!Array.isArray(offers)||!Array.isArray(sponsors))return json({error:"Invalid sponsor catalog"},503,"invalid_json");
  stage="shape";
  const sponsorsById=new Map(sponsors.filter(x=>safeHttps(x.official_url)&&typeof x.display_name==="string").map(x=>[x.id,x]));
  stage="filter";
  const now=Date.now();
  const records=offers.filter(x=>x&&sponsorsById.has(x.sponsor_id)&&
    safeHttps(x.official_url)&&validAmount(x.reward_minor)&&x.currency==="USD"&&
    typeof x.title==="string"&&typeof x.requirements==="string"&&
    typeof x.eligibility==="string"&&Number.isFinite(Date.parse(x.verified_at))&&
    (!x.starts_at||Date.parse(x.starts_at)<=now)&&(!x.ends_at||Date.parse(x.ends_at)>now))
   .map(x=>({
    id:x.id,title:x.title,summary:x.summary,requirements:x.requirements,
    official_url:x.official_url,geography:x.geography,eligibility:x.eligibility,
    reward_minor:Number(x.reward_minor),currency:"USD",compensation_basis:x.compensation_basis,
    sponsor_name:sponsorsById.get(x.sponsor_id).display_name,
    sponsor_url:sponsorsById.get(x.sponsor_id).official_url,
    verified_at:x.verified_at,
    state:"provider_terms_and_funding_verified",enrollment_enabled:false,
    reward_payable:false
   }));
  stage="respond";
  return json({opportunities:records,count:records.length,
   member_enrollment_enabled:false,reward_payout_enabled:false,
   source:"supabase_rls_verified_sponsor_offers"});
 } catch {return json({error:"Sponsor catalog unavailable"},503,"failed_"+stage); }
}
