import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, BriefcaseBusiness, Globe2, HeartHandshake, Search, ShieldCheck, Sparkles } from "lucide-react";
import { listActiveCampaigns } from "@/api/publicData";
import { authClient } from "@/api/auth";
import { matchOpportunity } from "@/lib/opportunityMatch";
import OpportunityEligibilityReview from "@/components/agents/OpportunityEligibilityReview";
import PulseApplicationPreparation from "@/components/agents/PulseApplicationPreparation";

const KINDS = [
  {id:"all",label:"All research sources"},
  {id:"grants",label:"Grants"},
  {id:"business",label:"Business opportunities"},
  {id:"volunteer",label:"Volunteer"},
];
function text(value) { return String(value ?? "").trim(); }
function ranking(source,campaign) {
  return matchOpportunity({cause_tags:String(source.causes_supported||"").split(",").map(t=>t.trim())},campaign).score;
}
function verifiedUrl(url) { try { const x=new URL(url); return x.protocol==="https:" && !x.username && !x.password; } catch { return false; } }
function SourceCard({source,campaign}) {
  const relevance=matchOpportunity({cause_tags:String(source.causes_supported||'').split(',').map(t=>t.trim())},campaign);
  const relevant=campaign && relevance.score>0;
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
        ? relevance.summary
        : "Broader research source; a relevant opportunity has not been individually verified."}
    </p>}
    {verifiedUrl(source.website) &&
      <a className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white hover:bg-cyan-700" href={source.website} target="_blank" rel="noopener noreferrer">
        Browse official listings <ArrowUpRight className="h-4 w-4"/>
      </a>}
  </article>;
}

function OpportunityCard({opportunity,campaign,watched,onWatch,watchBusy,watchStatus}) {
  const relevance=matchOpportunity(opportunity,campaign);
  const matching=campaign && relevance.score>0;
  const expired=Boolean(opportunity.deadline_date && opportunity.deadline_date < new Date().toISOString().slice(0,10));
  const isOpen=opportunity.status==="open" && !expired;
  return <article className="rounded-2xl border border-emerald-500/30 bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-cyan-600 px-3 py-1 text-xs font-semibold text-white">{opportunity.type==="grant"?"Grant":opportunity.type==="volunteer"?"Volunteering":"Business"}</span>
      <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">{expired?"Application deadline passed":isOpen?"Official application window":"Verified program · individual listings vary"}</span>
      {matching&&<span className="text-xs font-semibold text-emerald-600">Related campaign cause</span>}
    </div>
    <h3 className="mt-3 text-xl font-bold">{opportunity.title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{opportunity.provider} · {opportunity.geography||"Eligibility varies"}</p>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">{opportunity.description}</p>
    {opportunity.estimated_value&&<p className="mt-2 text-sm"><strong>Program value:</strong> {opportunity.estimated_value}</p>}
    {opportunity.deadline_date&&<p className="mt-1 text-sm"><strong>Published deadline:</strong> {opportunity.deadline_date}</p>}
    <p className="mt-2 text-sm"><strong>Who may qualify:</strong> {opportunity.eligibility}</p>
    <OpportunityEligibilityReview opportunity={opportunity}/>
    <PulseApplicationPreparation opportunity={opportunity} campaign={campaign}/>
    {campaign&&<p className="mt-3 rounded-lg bg-slate-500/10 p-3 text-xs">{matching
      ?relevance.summary
      :"This program is a general reference, not a verified match for the selected campaign."}</p>}
    {opportunity.source_note&&<p className="mt-2 text-xs text-muted-foreground">{opportunity.source_note}</p>}
    <div className="mt-3">
      {watchStatus==="ready" ? <button type="button" disabled={Boolean(watchBusy)}
        onClick={()=>onWatch(opportunity.id,!watched)} className="min-h-11 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-40">
        {watchBusy===opportunity.id?"Saving watch…":watched?"Stop deadline alerts":"Watch deadline/status updates"}
      </button> : <p className="text-xs text-muted-foreground">
        {watchStatus==="sign-in" ? "Sign in to opt in to deadline-change alerts." : "Deadline watch status is currently unavailable."}
      </p>}
      <p className="mt-1 text-xs text-muted-foreground">Alerts occur only when the verified iFund opportunity record is updated; this does not continuously monitor the provider website.</p>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <a href={opportunity.url} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 font-bold text-white hover:bg-cyan-700">
        {expired?"Review provider for next cycle":isOpen?"Review official application":"View official provider"} <ArrowUpRight className="h-4 w-4"/>
      </a>
      <span className="text-xs text-muted-foreground">Source checked {String(opportunity.verified_at||"").slice(0,10)||"not recorded"}</span>
    </div>
  </article>;
}

export default function Institutions() {
  const {id}=useParams();
  const [sources,setSources]=useState([]);
  const [opportunities,setOpportunities]=useState([]);
  const [publicCampaigns,setPublicCampaigns]=useState([]);
  const [ownerCampaigns,setOwnerCampaigns]=useState([]);
  const [ownerLoadWarning,setOwnerLoadWarning]=useState("");
  const [watched,setWatched]=useState([]);
  const [watchStatus,setWatchStatus]=useState("loading");
  const [watchBusy,setWatchBusy]=useState("");
  const [watchNotice,setWatchNotice]=useState("");
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
        if(!result.ok || !Array.isArray(body.sources) || !Array.isArray(body.opportunities) || body.source!=="canonical_supabase_rls")
          throw new Error("Verified institution sources could not be loaded.");
        if(active) {setSources(body.sources);setOpportunities(body.opportunities);setState("ready");}
      } catch(e){if(active){setError("Live institution research sources are temporarily unavailable. No unverified listings were substituted.");setState("error");}}
    })();
    listActiveCampaigns({limit:100}).then(items=>{if(active)setPublicCampaigns(items);}).catch(()=>{});
    return ()=>{active=false};
  },[reload]);
  useEffect(()=>{
    let active=true;
    let revision=0;
    let observedIdentity=null;
    let subscription=null;
    try {
      const client=authClient();
      async function loadPrivate(){
        const ownRevision=++revision;
        try{
          const {data:{user},error:userError}=await client.auth.getUser();
          if(!active||ownRevision!==revision)return;
          if(userError||!user){setOwnerCampaigns([]);return;}
          observedIdentity=user.id;
          const {data,error}=await client.from("ifund_campaigns")
            .select("id,title,summary,story,category,status")
            .eq("owner_id",user.id).order("updated_at",{ascending:false}).limit(50);
          if(!active||ownRevision!==revision)return;
          if(error||!Array.isArray(data))throw new Error("Owner campaign query unavailable");
          const checked=await client.auth.getUser();
          if(!active||ownRevision!==revision)return;
          if(checked.error||checked.data?.user?.id!==user.id)throw new Error("Identity changed");
          setOwnerCampaigns(data.map(item=>({...item,isOwned:true})));
          setOwnerLoadWarning("");
        }catch{
          if(active&&ownRevision===revision){
            setOwnerCampaigns([]);
            setOwnerLoadWarning("Private draft matching is temporarily unavailable; public research is still available.");
          }
        }
      }
      subscription=client.auth.onAuthStateChange((event,session)=>{
        if(!active)return;
        const next=session?.user?.id||null;
        if(next!==observedIdentity){
          observedIdentity=next;
          ++revision;
          setOwnerCampaigns([]);
          setSelectedCampaign("");
          queueMicrotask(()=>{if(active)loadPrivate();});
        }
      }).data?.subscription;
      loadPrivate();
    }catch{setOwnerCampaigns([]);}
    return ()=>{active=false;++revision;subscription?.unsubscribe();};
  },[reload]);
  useEffect(()=>{
    let active=true;
    setWatchStatus("loading");setWatched([]);
    (async()=>{
      try{
        const client=authClient();
        const before=await client.auth.getUser();
        if(before.error||!before.data?.user?.id){if(active)setWatchStatus("sign-in");return;}
        const {data,error}=await client.rpc("ifund_my_opportunity_watches");
        if(error||!Array.isArray(data))throw new Error("Opportunity watch status unavailable.");
        const after=await client.auth.getUser();
        if(after.error||after.data?.user?.id!==before.data.user.id)throw new Error("Session changed.");
        if(active){setWatched(data.map(x=>x.opportunity_id));setWatchStatus("ready");}
      }catch{if(active)setWatchStatus("error");}
    })();
    return ()=>{active=false;};
  },[reload]);
  async function toggleOpportunityWatch(opportunityId,enabled){
    if(watchBusy||watchStatus!=="ready")return;
    setWatchBusy(opportunityId);setWatchNotice("");
    try{
      const client=authClient();
      const {data,error}=await client.rpc("ifund_set_opportunity_watch",{p_opportunity_id:opportunityId,p_enabled:enabled});
      if(error||data!==enabled)throw new Error(error?.message||"Watch change was not verified.");
      setWatched(items=>enabled?[...new Set([...items,opportunityId])]:items.filter(x=>x!==opportunityId));
      setWatchNotice(enabled?"Source-change alerts enabled for the selected opportunity.":"Opportunity watch disabled.");
    }catch(e){setWatchNotice(e.message||"Unable to update opportunity watch.");}
    finally{setWatchBusy("")}
  }
  const campaigns=[...ownerCampaigns,...publicCampaigns.filter(c=>!ownerCampaigns.some(o=>o.id===c.id))];
  const selected=campaigns.find(c=>c.id===selectedCampaign)||null;
  const visible=useMemo(()=>sources.filter(s=>(!id||s.id===id) &&
    (type==="all"||s.industry===type) &&
    (!query||[s.name,s.description,s.mission,s.causes_supported,s.location].join(" ").toLowerCase().includes(query.toLowerCase())))
    .sort((a,b)=>ranking(b,selected)-ranking(a,selected)||a.name.localeCompare(b.name)),[sources,type,query,selected,id]);
  const matchedOpportunities=useMemo(()=>opportunities
    .filter(o=>(!id || o.id===id) &&
      (type==="all" || (type==="grants" && o.type==="grant") ||
        (type==="business" && o.type==="business") || (type==="volunteer" && o.type==="volunteer")) &&
      (!query || [o.title,o.description,o.provider,o.eligibility,o.geography,...(o.cause_tags||[])].join(" ").toLowerCase().includes(query.toLowerCase()))
    ).sort((a,b)=>matchOpportunity(b,selected).score-matchOpportunity(a,selected).score ||
                      a.title.localeCompare(b.title)),[opportunities,id,type,query,selected]);
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
        <p className="mt-1 text-sm text-muted-foreground">Select a published campaign or one of your private drafts to preview category relevance. Matching runs locally in your browser: private draft content is not sent to external providers. This is not a guarantee of eligibility or an automatic application.</p>
      </div></div>
      <label className="mt-4 block text-sm font-semibold" htmlFor="inst-campaign">Compare with campaign</label>
      <select id="inst-campaign" value={selectedCampaign} onChange={e=>setSelectedCampaign(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3">
        <option value="">Browse all research sources</option>
        {campaigns.map(c=><option key={c.id} value={c.id}>{c.isOwned?"Your campaign · ":""}{c.title||"Untitled campaign"}{c.isOwned&&c.status!=="active"?" (private or unpublished)":""}</option>)}
      </select>
      {ownerLoadWarning&&<p role="status" className="mt-2 text-xs text-amber-700">{ownerLoadWarning}</p>}
      {watchNotice&&<p role="status" className="mt-2 text-xs">{watchNotice}</p>}
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
      <section aria-label="Source-verified external opportunities" className="space-y-3">
        <h2 className="text-2xl font-bold">Verified programs & applications</h2>
        <p className="text-sm text-muted-foreground">{matchedOpportunities.length} independently sourced program{matchedOpportunities.length===1?"":"s"}.
          A program listing is not a guarantee of an available award, vacancy, partnership, or eligibility. Applications stay with official providers.</p>
        {matchedOpportunities.length===0 ? <p className="rounded-xl border border-border p-4">No source-verified programs match these filters. Broader research directories appear below.</p> :
          <div className="grid gap-4 md:grid-cols-2">{matchedOpportunities.map(o=><OpportunityCard key={o.id} opportunity={o} campaign={selected} watched={watched.includes(o.id)} watchStatus={watchStatus} watchBusy={watchBusy} onWatch={toggleOpportunityWatch}/>)}</div>}
      </section>
      <h2 className="text-xl font-bold">Additional research directories</h2>
      <p className="text-sm text-muted-foreground">{visible.length} verified research source{visible.length===1?"":"s"} · Specific offers must be checked on the linked provider.</p>
      {visible.length===0?<p role="status" className="rounded-xl border border-border p-5">No sources match those filters. Try another cause or category.</p>:
      <div className="grid gap-4 md:grid-cols-2">{visible.map(s=><SourceCard key={s.id} source={s} campaign={selected}/>)}</div>}
    </>}
    <p className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0"/> Private donor information, draft campaign content and precise organizer locations are not used. Do not submit applications or contact providers without the campaign owner's permission. IFund is a research and matching interface, not the issuer of these programs.</p>
  </main>;
}
