import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listActiveCampaigns } from "@/api/publicData";
import { categoryLabels } from "@/components/campaigns/CampaignCard";

export default function Analytics(){
  const [state,setState]=useState({phase:"loading",campaigns:[]});
  useEffect(()=>{
    let active=true;
    listActiveCampaigns({limit:500})
      .then(campaigns=>{if(active)setState({phase:"ready",campaigns});})
      .catch(()=>{if(active)setState({phase:"error",campaigns:[]});});
    return()=>{active=false;};
  },[]);
  const counts={};
  for(const campaign of state.campaigns)counts[campaign.category]=(counts[campaign.category]||0)+1;
  const total=state.campaigns.length;
  return <main className="mx-auto max-w-6xl space-y-7 px-4 py-8">
    <header><p className="text-sm uppercase font-semibold tracking-wide text-primary">Administration</p><h1 className="font-display text-3xl font-bold">Analytics</h1><p className="mt-2 text-muted-foreground">A bounded, public-campaign discovery snapshot from the canonical IFund database.</p></header>
    {state.phase==="loading"&&<p role="status">Loading verified public campaign records…</p>}
    {state.phase==="error"&&<p role="alert">Canonical campaign data is unavailable. No example metrics have been substituted.</p>}
    {state.phase==="ready"&&<>
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Active public campaigns in this result</h2>
        <p className="mt-2 text-4xl font-bold tabular-nums">{total}</p>
        <p className="mt-2 text-sm text-muted-foreground">Up to 500 recent public campaigns; this is not a platform-wide total, donor count, payment aggregate, or historical source migration total.</p>
      </section>
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Campaign categories in this result</h2>
        {total===0?<p className="text-muted-foreground">No publicly active campaigns were returned by the canonical project.</p>:
        <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Category</th><th className="py-2 text-right">Active campaigns</th></tr></thead><tbody>
        {Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([key,n])=><tr key={key} className="border-b"><td className="py-3">{categoryLabels[key]||key}</td><td className="py-3 text-right tabular-nums">{n}</td></tr>)}</tbody></table>}
      </section>
    </>}
    <p className="text-sm text-muted-foreground">Financial reporting, creator conversion, distribution reach, and historic data reconciliation remain unavailable until provider ledger and private backend controls pass verification.</p>
    <Link to="/ops" className="inline-block underline">Operations center</Link>
  </main>;
}
