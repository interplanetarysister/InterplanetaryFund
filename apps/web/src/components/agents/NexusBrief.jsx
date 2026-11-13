import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { nexusCampaignPriorities } from "@/lib/nexusTriage.mjs";
import NexusBriefSchedule from "@/components/agents/NexusBriefSchedule";

/** Read-only NEXUS triage from verified member campaign aggregates. */
export default function NexusBrief() {
  const [state,setState]=useState({phase:"loading",actions:[],campaignCount:null,editorialCount:null,error:""});
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true;
    setState({phase:"loading",actions:[],campaignCount:null,editorialCount:null,error:""});
    const client=authClient();
    (async()=>{
      const before=await client.auth.getUser();
      const owner=before?.data?.user?.id;
      if(before?.error||!owner)throw Error("Sign in to review your campaign priorities.");
      const [campaignResult,editorialResult,growthResult]=await Promise.allSettled([
        client.rpc("ifund_owner_campaign_engagement"),
        client.rpc("ifund_my_editorial_agent_reviews"),
        client.rpc("ifund_owner_growth_trends"),
      ]);
      const after=await client.auth.getUser();
      if(!active)return;
      if(after?.error||after?.data?.user?.id!==owner)
        throw Error("Account changed during the review. Reload the agent workspace.");
      if(campaignResult.status!=="fulfilled")throw Error("Owner campaign status could not be verified.");
      const {data,error}=campaignResult.value;
      if(error||!Array.isArray(data))throw Error("Owner campaign status could not be verified.");
      const growth=growthResult.status==="fulfilled"&&!growthResult.value.error&&Array.isArray(growthResult.value.data)
        ? growthResult.value.data:null;
      const editorialRows=editorialResult.status==="fulfilled"&&!editorialResult.value.error&&Array.isArray(editorialResult.value.data)
        ? editorialResult.value.data:null;
      const actions=nexusCampaignPriorities(data,growth||[],editorialRows);
      const editorial=editorialRows===null?null:editorialRows.filter(row=>row.review_status!=="acknowledged").length;
      setState({phase:"ready",actions:actions||[],campaignCount:data.length,editorialCount:editorial,trendVerified:growth!==null,error:""});
    })().catch(e=>{if(active)setState({phase:"error",actions:[],campaignCount:null,editorialCount:null,error:e.message||"Unavailable"});});
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
    {state.phase==="ready" && <p className="rounded-xl border border-border p-3 text-sm">
      <strong>Agent editorial handoffs awaiting owner review:</strong> {state.editorialCount===null?"Unavailable":state.editorialCount}
      <span className="block text-muted-foreground">Tasks and rule-based discussion proposals are recorded; no autonomous agent completion is inferred.</span>
      <span className="block text-muted-foreground">{state.trendVerified ? "Recent fundraising momentum uses verified capture counts." : "Recent trend data is unavailable; basic campaign priorities remain visible."}</span>
    </p>}
    {state.phase==="ready"&& (state.campaignCount===0
      ? <p>No owned campaigns were returned. <Link className="underline" to="/create">Start a campaign</Link> to create a mission.</p>
      : state.actions.length===0
        ? <p>No checklist priorities were identified from the verified campaign status and activity counts. This is not an assurance that there are no campaign issues.</p>
        : <ol className="space-y-3">{state.actions.map((item,index)=><li key={item.campaignId+":"+item.label} className="rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Priority {index+1} · {item.title}</p>
            <p className="mt-1 font-semibold">{item.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.why}</p>
            <Link to={item.path || "/campaigns/"+item.campaignId+"/edit"} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold underline">{item.path ? "Open agent team review" : "Review campaign"}</Link>
          </li>)}</ol>)}
    <NexusBriefSchedule />
  </section>;
}
