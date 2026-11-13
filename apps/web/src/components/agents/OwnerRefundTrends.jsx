import {useEffect,useState} from "react";
import {authClient} from "@/api/auth";
import {formatUsdCents} from "@/components/finance/FinanceDataGrid";

const money=value=>value==null?"Unavailable":formatUsdCents(value);
export default function OwnerRefundTrends(){
 const [state,setState]=useState({phase:"loading",rows:[],error:""});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  setState({phase:"loading",rows:[],error:""});
  authClient().rpc("ifund_owner_refund_trends").then(({data,error})=>{
   if(!active)return;
   if(error||!Array.isArray(data))throw new Error("Refund activity could not be verified.");
   setState({phase:"ready",rows:data,error:""});
  }).catch(error=>{if(active)setState({phase:"error",rows:[],error:error.message||"Unavailable"});});
  return ()=>{active=false};
 },[retry]);
 return <section className="space-y-3 rounded-xl border border-border bg-card p-5" aria-label="ORBIT monthly refunds and captures">
  <h2 className="text-lg font-semibold">ORBIT · Refund-aware monthly activity</h2>
  <p className="text-xs text-muted-foreground">Read-only grouped campaign events for your owned campaigns. Captures require recorded provider verification. Refund figures show recorded campaign-principal refunds with provider identifiers; pending or unmatched refunds are counted separately. These are not available withdrawal balances.</p>
  {state.phase==="loading"&&<p role="status">Loading owner-scoped financial activity…</p>}
  {state.phase==="error"&&<div role="alert" className="space-y-2">
   <p>{state.error}</p><button type="button" className="min-h-11 rounded-lg border px-4" onClick={()=>setRetry(v=>v+1)}>Retry</button>
  </div>}
  {state.phase==="ready"&&(state.rows.length===0?<p className="text-sm text-muted-foreground">No provider-backed campaign capture or refund periods are recorded.</p>:
   <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
    <thead><tr className="border-b border-border">
     <th className="p-2">Month</th><th className="p-2">Campaign</th>
     <th className="p-2">Recorded captures</th><th className="p-2">Referenced refunds</th><th className="p-2">Unverified refund records</th>
    </tr></thead>
    <tbody>{state.rows.map((row,i)=><tr key={row.campaign_id+":"+row.period_month+":"+i} className="border-b border-border">
     <td className="p-2">{row.period_month}</td><td className="p-2 font-mono text-xs">{row.campaign_id?.slice(0,8)||"Unavailable"}</td>
     <td className="p-2">{money(row.verified_captured_cents)}</td>
     <td className="p-2">{money(row.verified_refunded_cents)}</td>
     <td className="p-2">{row.pending_verification_refund_records==null?"Unavailable":String(row.pending_verification_refund_records)}</td>
    </tr>)}</tbody>
   </table></div>)}
 </section>;
}
