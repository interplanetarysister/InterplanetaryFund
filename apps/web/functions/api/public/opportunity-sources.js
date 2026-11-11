// Shared PUBLIC, read-only source directory for original Base44 and Cloudflare IFund.
// Uses Supabase's RLS-filtered publishable key, never the service/secret key.
// Search hubs are NOT specific confirmed active awards, jobs or volunteer listings.
const select = "id,name,type,industry,mission,description,location,website,causes_supported,offers_grants,offers_volunteer_program,verification_status";
const SITE_REF = "ssibsfmtodgximseeqsv";
const HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
  "x-content-type-options": "nosniff",
};
const json = (body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=120",...HEADERS},
});
export async function onRequest({request,env}) {
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:HEADERS});
  if (request.method !== "GET") return json({error:"Method not allowed"},405);
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "");
  const key = String(env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || "");
  let parsed;
  try { parsed = new URL(url); } catch { return json({error:"Canonical data service unavailable"},503); }
  if(parsed.protocol!=="https:" || parsed.hostname!==SITE_REF+".supabase.co" || !key) return json({error:"Canonical data service unavailable"},503);
  const path = "/rest/v1/ifund_institution?select="+encodeURIComponent(select)
   +"&source_system=eq.ifund_public_research_v1&verification_status=eq.verified&order=name.asc&limit=50";
  try {
    const upstream = await fetch(url+path,{headers:{apikey:key,accept:"application/json"},signal:AbortSignal.timeout(7000)});
    if(!upstream.ok) return json({error:"Institution sources temporarily unavailable"},503);
    const rows = await upstream.json();
    if(!Array.isArray(rows)) return json({error:"Invalid institution source response"},503);
    const items = rows.filter(r=>r && typeof r.name==="string" && typeof r.website==="string" && /^https:\/\//.test(r.website))
      .map(r=>({id:r.id,name:r.name,type:r.type,industry:r.industry,mission:r.mission,description:r.description,location:r.location,
        website:r.website,causes_supported:r.causes_supported,offers_grants:r.offers_grants===true,offers_volunteer_program:r.offers_volunteer_program===true}));
    return json({sources:items,count:items.length,source:"canonical_supabase_rls",kind:"externally operated research directories",partner_affiliation:false});
  } catch { return json({error:"Institution sources temporarily unavailable"},503); }
}
