import {useEffect,useRef,useState} from "react";
import {ArrowUpRight,Radar,Search} from "lucide-react";
import {scoutSafeLink,SCOUT_PUBLIC_FEEDS} from "@/lib/scoutFeeds.mjs";
export default function ScoutResearchPanel(){
 const [query,setQuery]=useState("");
 const [state,setState]=useState({phase:"idle",leads:[],sources:[],error:""});
 const active=useRef(null);
 useEffect(()=>()=>{active.current?.abort();},[]);
 async function search(event){
  event.preventDefault();
  active.current?.abort();const controller=new AbortController();active.current=controller;
  setState({phase:"loading",leads:[],sources:[],error:""});
  try{
   const r=await fetch("/api/public/scout-feed?q="+encodeURIComponent(query.trim()),{cache:"no-store",signal:controller.signal});
   const data=await r.json().catch(()=>null);
   if(!r.ok||!Array.isArray(data?.leads)||data.source_status!=="unreviewed_official_feed"||data.earning_opportunities_verified!==false)
    throw Error(data?.error||"Official opportunity feeds are currently unavailable.");
   const leads=data.leads.filter(x=>{
    const source=SCOUT_PUBLIC_FEEDS.find(p=>p.id===x.source_id);
    return source&&scoutSafeLink(x.url,source.domain)&&x.status==="unreviewed_official_feed";
   }).slice(0,30);
   if(!controller.signal.aborted)setState({phase:"ready",leads,sources:Array.isArray(data.source_results)?data.source_results:[],error:""});
  }catch(e){if(!controller.signal.aborted)setState({phase:"error",leads:[],sources:[],error:e?.message||"Research feeds unavailable."});}
 }
 return <section className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-7" aria-label="SCOUT official opportunity feed search">
  <div className="flex items-start gap-3"><Radar className="mt-1 shrink-0 text-cyan-600" size={24}/><div>
    <h3 className="text-xl font-bold">Search official opportunity notices</h3>
    <p className="mt-1 text-sm text-muted-foreground">SCOUT checks public grants feeds from Grants.gov by agency and category. Results are unreviewed announcements, not approved sponsor tasks, confirmed awards, or personal eligibility.</p>
  </div></div>
  <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
   <label className="sr-only" htmlFor="scout-keywords">Search words</label>
   <input id="scout-keywords" type="search" maxLength={100} value={query} onChange={e=>setQuery(e.target.value)}
    placeholder="Optional topic, e.g. housing, education" className="min-h-12 flex-1 rounded-xl border border-input bg-background px-4 text-sm"/>
   <button type="submit" disabled={state.phase==="loading"} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 font-semibold text-white disabled:opacity-50">
    <Search size={17}/> {state.phase==="loading"?"Checking official sources…":"Search opportunities"}
   </button>
  </form>
  {state.error&&<p role="alert" className="text-sm text-muted-foreground">{state.error} <span>Official sources can also be browsed directly from the opportunity directory.</span></p>}
  {state.phase==="ready"&&<>
    <p role="status" className="text-sm text-muted-foreground">{state.leads.length} unreviewed source notices matched. Verify deadlines, access and eligibility with the originating agency.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {state.leads.map((lead,i)=><article key={lead.source_id+lead.url+i} className="rounded-2xl border border-border p-4">
       <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{lead.source_name} · Unreviewed</p>
       <h4 className="mt-2 font-semibold">{lead.title}</h4>
       {lead.published_at&&<p className="mt-1 text-xs text-muted-foreground">Published {lead.published_at.slice(0,10)}</p>}
       {lead.summary&&<p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{lead.summary}</p>}
       <a href={lead.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">Review agency notice <ArrowUpRight size={15}/></a>
      </article>)}
    </div>
    {!state.leads.length&&<p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No matching notices in the currently available feeds. Try broader terms.</p>}
  </>}
 </section>;
}
