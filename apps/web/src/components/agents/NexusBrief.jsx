import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { nexusCampaignPriorities } from "@/lib/nexusTriage.mjs";

/** Read-only NEXUS triage from verified member campaign aggregates. */
export default function NexusBrief() {
  const [state,setState]=useState({phase:"loading",actions:[],campaignCount:null,error:""});
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true;
    setState({phase:"loading",actions:[],campaignCount:null,error:""});
    authClient().rpc("ifund_owner_campaign_engagement")
      .then(({data,error})=>{
        if (!active) return;
        if (error || !Array.isArray(data)) throw Error("Owner campaign status could not be verified.");
        const actions=nexusCampaignPriorities(data);
        setState({phase:"ready",actions:actions||[],campaignCount:data.length,error:""});
      })
      .catch(e=>{if(active)setState({phase:"error",actions:[],campaignCount:null,error:e.message||"Unavailable"});});
    return ()=>{active=false};
  },[refresh]);
  return <section className="rounded-2xl border border-border bg-card p-5 space-y-4" aria-label="NEXUS mission brief">
    <h2 className="text-xl font-semibold">NEXUS · Campaign priorities</h2>
    <p className="text-sm text-muted-foreground">
      Free, read-only checklist built from your account's verified campaign records. No AI credits used.
      NEXUS does not send messages, delegate tasks, or alter a campaign from this report.
    </p>
    {state.phase==="loading"&&<p role="status">Checking your campaign records…</p>}
    {state.phase==="error"&&<div role="alert" className="space-y-2">
      <p>Mission brief unavailable: {state.error}</p>
      <button className="min-h-11 rounded-lg border px-4" type="button" onClick={()=>setRefresh(n=>n+1)}>Retry</button>
    </div>}
    {state.phase==="ready"&& (state.campaignCount===0
      ? <p>No owned campaigns were returned. <Link className="underline" to="/create">Start a campaign</Link> to create a mission.</p>
      : state.actions.length===0
        ? <p>No checklist priorities were identified from the verified campaign status and activity counts. This is not an assurance that there are no campaign issues.</p>
        : <ol className="space-y-3">{state.actions.map((item,index)=><li key={item.campaignId+":"+item.label} className="rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Priority {index+1} · {item.title}</p>
            <p className="mt-1 font-semibold">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.why}</p>
            <Link to={"/campaigns/"+item.campaignId+"/edit"} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline">Review campaign</Link>
          </li>)}</ol>)}
  </section>;
}
