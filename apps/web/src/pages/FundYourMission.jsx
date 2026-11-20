import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, HeartHandshake, BriefcaseBusiness, Compass, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { SCOUT_PROVIDERS, safeScoutUrl } from "@/lib/scoutCatalog.mjs";

const tiles=[
 {title:"Raise",subtitle:"Grow your fundraising reach",detail:"Create a fundraiser or bring one you already run on another trusted platform. Donations stay with the original host when linked externally.",to:"/fundraising-hub",secondary:"Manage connected fundraisers",icon:HeartHandshake},
 {title:"Earn",subtitle:"Sponsor-funded opportunities",detail:"A future marketplace for optional, clearly disclosed tasks with verified completion and compensation. No member earning offers are active yet.",to:"/fund-your-mission#scout",secondary:"Explore provider research",icon:BriefcaseBusiness},
 {title:"Discover",subtitle:"Explore grants and support",detail:"Find source-checked programs and opportunity directories. Eligibility, awards, and availability must be confirmed with each provider.",to:"/institutions",secondary:"Browse research opportunities",icon:Compass}
];
export default function FundYourMission() {
 const [state,setState]=useState({phase:"loading",items:[],error:""});
 useEffect(()=>{
   const controller=new AbortController();
   fetch("/api/public/opportunity-sources",{signal:controller.signal,cache:"no-store"})
     .then(async r=>{if(!r.ok)throw Error("Opportunity research is temporarily unavailable.");
       const data=await r.json();
       if(!Array.isArray(data.opportunities))throw Error("Opportunity catalog could not be verified.");
       return data.opportunities.filter(x=>safeScoutUrl(x.url)&&typeof x.title==="string").slice(0,6);
     })
     .then(items=>{if(!controller.signal.aborted)setState({phase:"ready",items,error:""});})
     .catch(()=>{if(!controller.signal.aborted)setState({phase:"error",items:[],error:"Opportunity research is temporarily unavailable. You can still browse the official directories."});});
   return ()=>controller.abort();
 },[]);
 return <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8 sm:py-12">
   <header className="relative overflow-hidden rounded-[2rem] border border-cyan-500/25 bg-slate-950 px-6 py-10 text-white shadow-xl sm:px-10 sm:py-14">
     <div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full border border-cyan-400/20 shadow-[0_0_0_35px_#22d3ee07,0_0_0_90px_#818cf807]" aria-hidden="true"/>
     <div className="relative max-w-3xl space-y-4">
       <p className="text-xs font-bold uppercase tracking-[.2em] text-cyan-300">Your possibilities, your progress</p>
       <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Fund your Mission</h1>
       <p className="max-w-2xl text-base leading-7 text-slate-200">Raise support, find relevant opportunities and discover legitimate ways to earn toward your goals—all in one place.</p>
       <div className="flex flex-wrap gap-3">
         <Link to="/what-if" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950"><Sparkles size={17}/>Start a private Mission</Link>
         <Link to="/missions" className="inline-flex min-h-12 items-center rounded-xl border border-white/30 px-5 py-3 font-semibold text-white">My Missions</Link>
       </div>
     </div>
   </header>
   <section aria-label="Ways to fund your Mission" className="grid gap-4 md:grid-cols-3">
    {tiles.map(({title,subtitle,detail,to,secondary,icon:Icon})=>
      <article key={title} className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"><Icon size={25}/></div>
        <div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p><h2 className="mt-1 text-xl font-bold">{subtitle}</h2></div>
        <p className="flex-1 text-sm leading-6 text-muted-foreground">{detail}</p>
        <Link to={to} className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary">{secondary}<ArrowUpRight size={16}/></Link>
      </article>)}
   </section>
   <section className="rounded-3xl border border-border bg-card p-6 sm:p-8" aria-label="Partner-first fundraising">
     <div className="flex items-center gap-3"><HeartHandshake className="text-cyan-600" size={26}/><h2 className="text-xl font-bold">Already raising funds somewhere else?</h2></div>
     <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">IFund can help you organize supported external fundraiser links and plan how to reach more supporters. Your donations continue through your original host. Adding a link does not create a partnership or grant access to your account.</p>
     <Link to="/fundraising-hub" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2 font-semibold">Connect your existing fundraiser <ArrowUpRight size={16}/></Link>
   </section>
   <section id="scout" className="space-y-4 scroll-mt-20" aria-labelledby="scout-title">
     <div className="flex items-start gap-3"><Radar className="mt-1 text-cyan-600" size={28}/><div><h2 id="scout-title" className="text-2xl font-bold">SCOUT opportunity research</h2>
       <p className="mt-1 text-sm text-muted-foreground">Provider documentation being evaluated for future sponsor-supported tasks. These companies are not yet verified IFund partners or currently payable member offers.</p></div></div>
     <div className="grid gap-3 md:grid-cols-3">
       {SCOUT_PROVIDERS.map(p=><article key={p.id} className="space-y-3 rounded-2xl border border-border bg-card p-5">
         <div className="flex items-center justify-between gap-2"><h3 className="font-bold">{p.name}</h3><span className="rounded-full border px-2 py-1 text-[11px] font-semibold text-muted-foreground">Research only</span></div>
         <p className="text-sm">{p.evidence}</p><p className="text-xs text-muted-foreground">{p.eligibility}</p>
         <a className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary" href={p.official_url} rel="noopener noreferrer" target="_blank">Official documentation <ArrowUpRight size={15}/></a>
       </article>)}
     </div>
   </section>
   <section className="space-y-4" aria-labelledby="opportunity-title">
     <div className="flex items-center gap-3"><Compass className="text-cyan-600" size={25}/><h2 id="opportunity-title" className="text-xl font-bold">Source-checked opportunities</h2></div>
     <p className="text-sm text-muted-foreground">Research listings are not paid IFund tasks, endorsements, verified eligibility or guaranteed funding.</p>
     {state.phase==="loading"&&<p role="status" className="text-sm">Loading checked sources…</p>}
     {state.error&&<p role="alert" className="text-sm">{state.error}</p>}
     {state.items.length>0?<div className="grid gap-3 sm:grid-cols-2">
       {state.items.map(x=><article key={x.id} className="rounded-2xl border border-border bg-card p-5">
         <h3 className="font-bold">{x.title}</h3><p className="mt-1 text-xs text-muted-foreground">{x.provider||"External provider"} · Source checked {String(x.verified_at||"").slice(0,10)}</p>
         <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{x.description}</p>
         <a href={x.url} rel="noopener noreferrer" target="_blank" className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">Review provider requirements <ArrowUpRight size={15}/></a>
       </article>)}
       </div>:state.phase==="ready"&&<p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">No currently source-checked listings are available. Check the opportunity directory for additional research.</p>}
     <Link to="/institutions" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2 font-semibold">Browse all opportunity research <ArrowUpRight size={16}/></Link>
   </section>
   <footer className="rounded-2xl border border-border p-5 text-sm text-muted-foreground">
    <div className="flex gap-3"><ShieldCheck size={22} className="shrink-0 text-cyan-600"/><p>Sponsor submissions, offer enrollment, commissions and payouts are not enabled. IFund does not guarantee income or awards. When sponsor tasks become available, each will require verified terms and funding before any reward is advertised.</p></div>
   </footer>
 </main>;
}
