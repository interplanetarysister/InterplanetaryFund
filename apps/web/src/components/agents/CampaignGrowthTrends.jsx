import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

/** Free owner-only activity view; capture counts do not represent cash received. */
export default function CampaignGrowthTrends({campaigns=[]}) {
  const [state,setState]=useState({phase:"loading",rows:[],error:""});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    setState({phase:"loading",rows:[],error:""});
    authClient().rpc("ifund_owner_growth_trends")
      .then(({data,error})=>{
        if(!active)return;
        if(error||!Array.isArray(data))throw new Error("Growth activity is currently unavailable.");
        setState({phase:"ready",rows:data,error:""});
      })
      .catch(err=>{if(active)setState({phase:"error",rows:[],error:err.message||"Unable to load activity."});});
    return ()=>{active=false};
  },[retry]);
  const display=value=>{
    if(value===null||value===undefined||value===""||typeof value==="boolean")return "Unavailable";
    const n=Number(value);
    return Number.isSafeInteger(n)&&n>=0?n.toLocaleString():"Unavailable";
  };
  return <section className="rounded-xl border border-border bg-card p-5" aria-label="Growth agent activity">
    <h2 className="text-xl font-semibold">Growth activity · last 7 and 30 days</h2>
    <p className="mt-2 text-sm text-muted-foreground">Read-only campaign-owner metrics. No outreach or payment action is triggered. Captures are provider-verified events, not net revenue or unique donors.</p>
    {state.phase==="loading"&&<p role="status" className="mt-3">Verifying growth activity…</p>}
    {state.phase==="error"&&<div role="alert" className="mt-3 space-y-2">
      <p>{state.error}</p><button type="button" className="min-h-11 rounded-lg border px-4" onClick={()=>setRetry(n=>n+1)}>Retry</button>
    </div>}
    {state.phase==="ready"&&(state.rows.length===0?
      <p className="mt-3 text-sm text-muted-foreground">No campaigns available for this account.</p>:
      <div className="mt-4 space-y-4">{state.rows.map(row=><article key={row.campaign_id} className="rounded-lg border border-border p-4">
        <p className="font-semibold">{campaigns.find(item=>item.campaign_id===row.campaign_id)?.campaign_title||"Campaign "+String(row.campaign_id).slice(0,8)}</p>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["New follows · 7d","new_follows_7d"],["New follows · 30d","new_follows_30d"],
            ["Verified captures · 7d","new_verified_captures_7d"],["Verified captures · 30d","new_verified_captures_30d"],
          ].map(([label,key])=><div key={key}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{display(row[key])}</dd>
          </div>)}
        </dl>
      </article>)}</div>)}
  </section>;
}
