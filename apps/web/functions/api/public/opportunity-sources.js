// Verified public research catalog. One canonical store: Supabase with RLS and column grants.
// "open" means provider-confirmed application window; "program" is a research/recruitment
// program, NOT a currently confirmed individual award, job or volunteer assignment.
const SITE_REF = "ssibsfmtodgximseeqsv";
const SOURCE_SELECT = "id,name,type,industry,mission,description,location,website,causes_supported,offers_grants,offers_volunteer_program,verification_status";
const OPPORTUNITY_SELECT = "id,title,type,description,estimated_value,eligibility,required_actions,confidence,status,official_url,official_provider,verified_at,cause_tags,geography,deadline_date,source_note";
const HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "x-content-type-options": "nosniff",
};
const json = (body,status=200) => new Response(JSON.stringify(body), {
  status,headers: {"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=120",...HEADERS},
});
const safeUrl = value => {
  try { const u = new URL(value); return u.protocol==="https:" && !u.username && !u.password; }
  catch { return false; }
};
export async function onRequest({request,env}) {
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:HEADERS});
  if (request.method !== "GET") return json({error:"Method not allowed"},405);
  const rawUrl = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "");
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
  let parsed;
  try { parsed = new URL(rawUrl); } catch { return json({error:"Canonical data service unavailable"},503); }
  if(parsed.protocol!=="https:" || parsed.hostname!==SITE_REF+".supabase.co" || !key)
    return json({error:"Canonical data service unavailable"},503);
  const sourcePath="/rest/v1/ifund_institution?select="+encodeURIComponent(SOURCE_SELECT)
    +"&source_system=eq.ifund_public_research_v1&verification_status=eq.verified&order=name.asc&limit=50";
  const opportunityPath="/rest/v1/ifund_opportunity?select="+encodeURIComponent(OPPORTUNITY_SELECT)
    +"&source_system=eq.ifund_external_verified_v1&status=in.(open,program)&verified_at=not.is.null&order=verified_at.desc&limit=50";
  try {
    const [sourceResponse,opportunityResponse]=await Promise.all([sourcePath,opportunityPath].map(path=>
      fetch(rawUrl+path,{headers:{apikey:key,accept:"application/json"},signal:AbortSignal.timeout(7000)})
    ));
    if(!sourceResponse.ok || !opportunityResponse.ok)
      return json({error:"Institution research is temporarily unavailable"},503);
    const [sourceRows,opportunityRows]=await Promise.all([sourceResponse.json(),opportunityResponse.json()]);
    if(!Array.isArray(sourceRows) || !Array.isArray(opportunityRows))
      return json({error:"Invalid institution research response"},503);
    const sources=sourceRows.filter(s=>s && typeof s.name==="string" && safeUrl(s.website))
      .map(s=>({id:s.id,name:s.name,type:s.type,industry:s.industry,mission:s.mission,description:s.description,location:s.location,
        website:s.website,causes_supported:s.causes_supported,offers_grants:s.offers_grants===true,offers_volunteer_program:s.offers_volunteer_program===true}));
    const now=Date.now();
    const today=new Date(now).toISOString().slice(0,10);
    // A previously verified listing must not be represented as currently open forever.
    // Programs are directories, not promises of current applications.
    const fresh=(value,maxDays)=>{
      const checked=Date.parse(value||"");
      return Number.isFinite(checked) && checked<=now && now-checked<=maxDays*86400000;
    };
    const opportunities=opportunityRows.filter(o=>
      o && typeof o.title==="string" && safeUrl(o.official_url) &&
      (o.status==="program" ? fresh(o.verified_at,180) : (o.status==="open" && fresh(o.verified_at,30) && (!o.deadline_date || o.deadline_date>=today)))
    ).map(o=>({id:o.id,title:o.title,type:o.type,description:o.description,estimated_value:o.estimated_value,
      eligibility:o.eligibility,required_actions:o.required_actions,confidence:o.confidence,status:o.status,
      url:o.official_url,provider:o.official_provider,verified_at:o.verified_at,
      cause_tags:Array.isArray(o.cause_tags)?o.cause_tags:[],geography:o.geography,
      deadline_date:o.deadline_date,source_note:o.source_note}));
    return json({sources,opportunities,count:sources.length,opportunity_count:opportunities.length,
      source:"canonical_supabase_rls",kind:"verified source directories and externally documented programs",
      partner_affiliation:false,auto_apply_enabled:false,open_verification_max_age_days:30,program_verification_max_age_days:180});
  } catch {
    return json({error:"Institution research is temporarily unavailable"},503);
  }
}
