import {Link} from "react-router-dom";
import {useEffect,useRef,useState} from "react";
import {matchOpportunity} from "@/lib/opportunityMatch";
import {analyzeGoalSuccess} from "@/lib/goalSuccessAnalysis.mjs";

const label={baseline:"Useful starting point",explore:"Worth researching",consider_carefully:"Review risks first",optional:"Optional avenue"};
export default function GoalSuccessAnalysis({campaign}) {
  const analysis=analyzeGoalSuccess(campaign);
  const [results,setResults]=useState({state:"idle",items:[],error:""});
  const pending=useRef(null);
  useEffect(()=>{pending.current?.abort();setResults({state:"idle",items:[],error:""});return()=>pending.current?.abort();},[campaign?.id]);
  async function findMatches(){
    pending.current?.abort();const controller=new AbortController();pending.current=controller;
    setResults({state:"loading",items:[],error:""});
    try{
      const response=await fetch("/api/public/opportunity-sources",{cache:"no-store",signal:controller.signal});
      const payload=await response.json().catch(()=>null);
      if(!response.ok||payload?.source!=="canonical_supabase_rls"||!Array.isArray(payload.opportunities))
        throw Error("Verified opportunity records are unavailable; no unreviewed leads were substituted.");
      const today=new Date().toISOString().slice(0,10);
      const items=payload.opportunities.filter(item=>{
        try{
          const url=new URL(item.url);
          return url.protocol==="https:"&&!url.username&&!url.password&&
            item.status==="open"&&Boolean(item.verified_at)&&
            (!item.deadline_date||item.deadline_date>=today)&&
            matchOpportunity(item,campaign).score>0;
        }catch{return false;}
      }).sort((a,b)=>matchOpportunity(b,campaign).score-matchOpportunity(a,campaign).score).slice(0,6);
      if(!controller.signal.aborted)setResults({state:"ready",items,error:""});
    }catch(cause){
      if(!controller.signal.aborted)setResults({state:"error",items:[],error:cause?.message||"Could not check official sources."});
    }
  }
  const query=encodeURIComponent(campaign?.id||"");
  const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2});
  return <section className="space-y-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/[.04] p-4 sm:p-5" aria-label="Goal Success Analysis">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="text-lg font-bold">Goal Success Analysis</h3>
        <p className="mt-1 text-sm text-muted-foreground">Explore more than donations: opportunities to earn, receive, borrow responsibly, or reduce the cash needed.</p>
      </div>
      <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">NEXUS · Team planning</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground">Campaign cash target</p>
        <p className="mt-1 font-semibold">{analysis.target===null?"Not specified":money.format(analysis.target)}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground">Verified funding received</p>
        <p className="mt-1 font-semibold">See verified finances</p>
        <p className="text-xs text-muted-foreground">Not calculated from opportunities</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground">Confirmed donated resources</p>
        <p className="mt-1 font-semibold">Not verified here</p>
        <p className="text-xs text-muted-foreground">Keep separate from cash</p>
      </div>
    </div>
    <p className="text-sm font-medium">{analysis.suggestedNextStep}</p>
    <section aria-label="Research matching opportunities" className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h4 className="font-semibold">Research opportunities for this goal</h4>
      <p className="text-sm text-muted-foreground">Check the current curated records and surface topic-related programs, without implying your eligibility, award, or a verified match.</p>
      <button type="button" onClick={findMatches} disabled={results.state==="loading"||!campaign?.id} className="min-h-11 rounded-xl border border-cyan-400/50 px-4 text-sm font-semibold disabled:opacity-50">
        {results.state==="loading"?"Checking official opportunities…":"Find possible opportunities"}
      </button>
      {results.state==="error"&&<p role="alert" className="text-sm text-muted-foreground">{results.error}</p>}
      {results.state==="ready"&&<p role="status" className="text-sm text-muted-foreground">{results.items.length} currently open, checked records show topic overlap. Eligibility and award availability are still unverified.</p>}
      {results.state==="ready"&&results.items.map(item=><article key={item.id} className="space-y-2 rounded-xl border border-border p-3">
        <h5 className="font-semibold">{item.title}</h5>
        <p className="text-xs text-muted-foreground">{item.provider} · Source checked {String(item.verified_at).slice(0,10)}</p>
        <p className="text-sm">{matchOpportunity(item,campaign).summary}</p>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">Review official terms and eligibility</a>
      </article>)}
      <button type="button" onClick={()=>window.dispatchEvent(new CustomEvent("ifund-open-agent",{detail:{agent:"nexus",prefill:"Help me evaluate realistic, verified options to achieve this campaign goal: "+analysis.title+". Check eligibility before recommending any grant, sponsor, earning task, donations or noncash resources."}}))}
        className="min-h-11 rounded-xl border border-violet-400/40 bg-violet-500/10 px-4 text-sm font-semibold">Ask NEXUS to interpret my options</button>
    </section>
    <div className="grid gap-3 sm:grid-cols-2">
      {analysis.channels.map(channel=><article key={channel.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold">{channel.title}</h4>
          <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{label[channel.relevance]}</span>
        </div>
        <p className="text-xs font-medium text-cyan-700 dark:text-cyan-300">{channel.role}</p>
        <p className="text-sm text-muted-foreground">{channel.why}</p>
        <p className="text-sm">{channel.start}</p>
        <p className="text-xs text-muted-foreground">Individual opportunity: {channel.verification} · No funds or supplies confirmed</p>
        <Link to={channel.route+(channel.route==="/institutions"&&query?"?campaign="+query:"")}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">
          {channel.id==="financing"?"Review financial information":"Explore this pathway"}
        </Link>
      </article>)}
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{analysis.disclaimer} Check original sources, program conditions, deadlines, contact permissions and legal requirements before taking action.</p>
  </section>;
}
