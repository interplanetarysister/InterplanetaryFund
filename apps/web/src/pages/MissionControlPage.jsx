import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { loadOwnedCampaigns } from "@/lib/ownerCampaigns";

export default function MissionControlPage() {
  const [status,setStatus]=useState({phase:"loading",campaigns:[]});
  useEffect(()=>{
    let active=true;
    loadOwnedCampaigns(authClient())
      .then(campaigns=>{if(active)setStatus({phase:"ready",campaigns});})
      .catch(()=>{if(active)setStatus({phase:"error",campaigns:[]});});
    return()=>{active=false;};
  },[]);
  const campaigns=status.campaigns;
  const active=campaigns.filter(c=>c.status==="active").length;
  const drafts=campaigns.filter(c=>c.status==="draft").length;
  return <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
    <header><p className="text-sm font-semibold uppercase tracking-widest text-primary">Mission Control</p><h1 className="font-display text-3xl font-bold">Your fundraising command center</h1><p className="mt-2 text-muted-foreground">See your independent campaigns and choose what to work on next.</p></header>
    {status.phase==="loading"&&<p role="status">Checking your campaigns…</p>}
    {status.phase==="error"&&<p role="alert">Your campaign data could not be loaded. No example statistics have been substituted.</p>}
    {status.phase==="ready"&&<section className="grid gap-4 sm:grid-cols-3" aria-label="Verified campaign counts">
      <div className="rounded-2xl border border-border bg-card p-5"><h2 className="text-sm text-muted-foreground">Your campaigns</h2><p className="text-3xl font-semibold">{campaigns.length}</p></div>
      <div className="rounded-2xl border border-border bg-card p-5"><h2 className="text-sm text-muted-foreground">Published</h2><p className="text-3xl font-semibold">{active}</p></div>
      <div className="rounded-2xl border border-border bg-card p-5"><h2 className="text-sm text-muted-foreground">Private drafts</h2><p className="text-3xl font-semibold">{drafts}</p></div>
    </section>}
    <section className="grid gap-4 sm:grid-cols-2">
      {[
        ["/mine","My campaigns","Edit drafts, view published causes and manage your own campaign records."],
        ["/create","Create a campaign","Start or finish a campaign story and make it public when ready."],
        ["/agents","AI specialist team","View original IFund agent identities and verified connection readiness."],
        ["/connections","Connected accounts","Review independent provider connection status before authorizing external sharing."],
        ["/social","Social network","Read and publish within the independent IFund community."]
      ].map(([path,title,desc])=><Link key={path} to={path} className="rounded-2xl border border-border bg-card p-5 hover:border-primary"><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{desc}</p></Link>)}
    </section>
    <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Income totals, AI execution and external outreach have not been verified on this independent stack. No sample fundraising statistics or automated activity are displayed.</p>
  </main>;
}
