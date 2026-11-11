import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, BriefcaseBusiness, Globe2, HeartHandshake, Search, ShieldCheck, Sparkles } from "lucide-react";
import { listActiveCampaigns } from "@/api/publicData";

const KINDS = [
  {id:"all",label:"All research sources"},
  {id:"grants",label:"Grants"},
  {id:"business",label:"Business opportunities"},
  {id:"volunteer",label:"Volunteer"},
];
function text(value) { return String(value ?? "").trim(); }
function causeTokens(campaign) {
  if (!campaign) return [];
  return [campaign.category, ...text(campaign.title).toLowerCase().match(/[a-z]{5,}/g)||[]]
    .map(s=>text(s).toLowerCase().replaceAll(" ","_")).filter(Boolean);
}
function ranking(source,campaign) {
  const tags = text(source.causes_supported).toLowerCase().split(",").map(t=>t.trim());
  const tokens = causeTokens(campaign);
  return tags.some(t=>tokens.includes(t)) ? 2 : 0;
}
function verifiedUrl(url) { try { const x=new URL(url); return x.protocol==="https:" && !x.username && !x.password; } catch { return false; } }
function SourceCard({source,campaign}) {
  const relevant=campaign && ranking(source,campaign)>0;
  const type=source.industry==="grants"?"Grant research":source.industry==="business"?"Business / procurement":"Volunteer research";
  return <article className="rounded-2xl border border-cyan-500/25 bg-card p-5 shadow-sm" aria-label={source.name}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">{type}</span>
      {relevant && <span className="rounded-full border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Related cause category</span>}
    </div>
    <h2 className="mt-3 text-xl font-bold">{source.name}</h2>
    <p className="mt-1 text-xs text-muted-foreground">{source.location || "Location eligibility varies"}</p>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">{source.description || source.mission}</p>
    {campaign && <p className="mt-3 rounded-xl bg-slate-900/5 p-3 text-xs dark:bg-white/5">
      <strong>Matching note:</strong> {relevant
        ? "This source covers causes related to the selected campaign. Review individual program eligibility, deadlines and application rules."
        : "Broader research source; a relevant opportunity has not been individually verified."}
    </p>}
    {verifiedUrl(source.website) &&
      <a className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700" href={source.website} target="_blank" rel="noopener noreferrer">
        Browse official listings <ArrowUpRight className="h-4 w-4"/>
      </a>}
  </article>;
}

export default function Institutions() {
  const {id}=useParams();
  const [sources,setSources]=useState([]);
  const [campaigns,setCampaigns]=useState([]);
  const [selectedCampaign,setSelectedCampaign]=useState("");
  const [type,setType]=useState("all");
  const [query,setQuery]=useState("");
  const [state,setState]=useState("loading");
  const [error,setError]=useState("");
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let active=true;
    setState("loading");setError("");
    (async()=>{
      try {
        const result=await fetch("/api/public/opportunity-sources",{cache:"no-store",signal:AbortSignal.timeout(9000)});
        const body=await result.json().catch(()=>({}));
        if(!result.ok || !Array.isArray(body.sources) || body.source!=="canonical_supabase_rls")
          throw new Error("Verified institution sources could not be loaded.");
        if(active) {setSources(body.sources);setState("ready");}
      } catch(e){if(active){setError("Live institution research sources are temporarily unavailable. No unverified listings were substituted.");setState("error");}}
    })();
    listActiveCampaigns({limit:100}).then(items=>{if(active)setCampaigns(items);}).catch(()=>{});
    return ()=>{active=false};
  },[reload]);
  const selected=campaigns.find(c=>c.id===selectedCampaign)||null;
  const visible=useMemo(()=>sources.filter(s=>(!id||s.id===id) &&
    (type==="all"||s.industry===type) &&
    (!query||[s.name,s.description,s.mission,s.causes_supported,s.location].join(" ").toLowerCase().includes(query.toLowerCase())))
    .sort((a,b)=>ranking(b,selected)-ranking(a,selected)||a.name.localeCompare(b.name)),[sources,type,query,selected,id]);
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-cyan-700 dark:text-cyan-300"><Globe2 className="h-5 w-5"/> Worldwide opportunity research</p>
      <h1 className="text-3xl font-extrabold sm:text-4xl">Institutions, grants, business & volunteers</h1>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Connect campaign needs with independent funding, procurement, and volunteer directories. Sources below are real external organizations. IFund has not verified eligibility for individual opportunities and is not affiliated with these directories.</p>
      <Link to="/discover" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-cyan-700 underline dark:text-cyan-300">Browse campaigns</Link>
    </header>
    <section className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
      <div className="flex gap-2"><Sparkles className="h-5 w-5 shrink-0 text-cyan-600"/><div>
        <strong>Agent-guided campaign matching</strong>
        <p className="mt-1 text-sm text-muted-foreground">Select a real public campaign for a cause-category relevance preview. Research agents will continually validate new opportunities, their deadlines and eligibility. This current matching preview uses published categories, not model-generated claims or automatic applications.</p>
      </div></div>
      <label className="mt-4 block text-sm font-semibold" htmlFor="inst-campaign">Compare with campaign</label>
      <select id="inst-campaign" value={selectedCampaign} onChange={e=>setSelectedCampaign(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3">
        <option value="">Browse all research sources</option>
        {campaigns.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
    </section>
    <div className="flex flex-wrap gap-2" aria-label="Opportunity categories">
      {KINDS.map(k=><button type="button" key={k.id} aria-pressed={type===k.id} onClick={()=>setType(k.id)}
        className={`min-h-11 rounded-full border px-4 py-2 text-sm font-semibold ${type===k.id?"border-cyan-500 bg-cyan-600 text-white":"border-border bg-card"}`}>{k.label}</button>)}
    </div>
    <label className="relative block" htmlFor="inst-search"><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground"/>
      <input id="inst-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search funding sources, causes, regions…" className="min-h-11 w-full rounded-xl border border-border bg-background pl-11 pr-3"/>
    </label>
    {state==="loading" && <p role="status">Loading canonical institution research sources…</p>}
    {state==="error" && <div role="alert" className="rounded-xl border border-red-400/30 p-4"><p>{error}</p><button className="mt-2 min-h-11 rounded-lg border border-border px-4" type="button" onClick={()=>setReload(n=>n+1)}>Try again</button></div>}
    {state==="ready" && <>
      <p className="text-sm text-muted-foreground">{visible.length} verified research source{visible.length===1?"":"s"} · Specific offers must be checked on the linked provider.</p>
      {visible.length===0?<p role="status" className="rounded-xl border border-border p-5">No sources match those filters. Try another cause or category.</p>:
      <div className="grid gap-4 md:grid-cols-2">{visible.map(s=><SourceCard key={s.id} source={s} campaign={selected}/>)}</div>}
    </>}
    <p className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0"/> Private donor information, draft campaign content and precise organizer locations are not used. Do not submit applications or contact providers without the campaign owner's permission. IFund is a research and matching interface, not the issuer of these programs.</p>
  </main>;
}
