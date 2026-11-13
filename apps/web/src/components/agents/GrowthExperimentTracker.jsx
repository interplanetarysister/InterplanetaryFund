import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

/** Manual experiment journal; no external messages or provider outcome claims. */
export default function GrowthExperimentTracker({campaigns=[]}) {
 const [state,setState]=useState({phase:"loading",rows:[],error:""});
 const [campaignId,setCampaignId]=useState("");
 const [channel,setChannel]=useState("social");
 const [hypothesis,setHypothesis]=useState("");
 const [outcomes,setOutcomes]=useState({});
 const [busy,setBusy]=useState("");
 const [notice,setNotice]=useState("");
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{
   let active=true;
   setState({phase:"loading",rows:[],error:""});
   authClient().rpc("ifund_my_growth_experiments").then(({data,error})=>{
     if(!active)return;
     if(error||!Array.isArray(data))throw new Error("Your private experiment journal is unavailable.");
     setState({phase:"ready",rows:data,error:""});
   }).catch(e=>{if(active)setState({phase:"error",rows:[],error:e.message||"Unavailable"});});
   return ()=>{active=false};
 },[refresh]);
 async function create(e){
   e.preventDefault();if(busy)return;
   if(!campaignId||hypothesis.trim().length<15||hypothesis.trim().length>500){setNotice("Choose your campaign and write a 15–500 character hypothesis.");return}
   setBusy("create");setNotice("");
   try{
     const {data,error}=await authClient().rpc("ifund_create_growth_experiment",{
       p_campaign_id:campaignId,p_channel:channel,p_hypothesis:hypothesis.trim(),
     });
     if(error||typeof data!=="string")throw new Error(error?.message||"Experiment was not recorded.");
     setHypothesis("");setNotice("Private experiment plan saved. No outreach was sent.");setRefresh(n=>n+1);
   }catch(x){setNotice(x.message||"Unable to save experiment.");}
   finally{setBusy("")}
 }
 async function close(id){
   if(busy)return;
   const value=(outcomes[id]||"").trim();
   if(value.length<10||value.length>1000){setNotice("Describe the observed outcome in 10–1000 characters.");return;}
   setBusy(id);setNotice("");
   try{
     const {data,error}=await authClient().rpc("ifund_close_growth_experiment",{
       p_experiment_id:id,p_outcome:value,
     });
     if(error||data!==true)throw new Error(error?.message||"Outcome was not confirmed.");
     setNotice("Self-reported outcome recorded. This is not a provider-verified conversion.");
     setRefresh(n=>n+1);
   }catch(x){setNotice(x.message||"Unable to close experiment.");}
   finally{setBusy("")}
 }
 return <section className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="FORGE outreach experiments">
  <h2 className="text-xl font-semibold">FORGE · Outreach experiment journal</h2>
  <p className="text-sm text-muted-foreground">Plan one campaign outreach approach at a time, record the observed results, and compare with verified activity trends. This journal cannot send posts or verify provider delivery.</p>
  <form className="space-y-3" onSubmit={create}>
   <label className="block text-sm font-semibold">Campaign
    <select className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" value={campaignId} onChange={e=>setCampaignId(e.target.value)}>
      <option value="">Choose one of your campaigns</option>
      {campaigns.map(c=><option key={c.campaign_id} value={c.campaign_id}>{c.campaign_title||"Campaign"}</option>)}
    </select>
   </label>
   <label className="block text-sm font-semibold">Outreach channel
    <select className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" value={channel} onChange={e=>setChannel(e.target.value)}>
      <option value="social">Social post</option><option value="email">Approved email</option>
      <option value="community">Community group</option><option value="in_person">In-person outreach</option><option value="other">Other</option>
    </select>
   </label>
   <label className="block text-sm font-semibold">Hypothesis
     <textarea maxLength={500} required value={hypothesis} onChange={e=>setHypothesis(e.target.value)}
       placeholder="Describe what you want to learn and how you'll measure the result."
       className="mt-1 min-h-24 w-full rounded-lg border bg-background p-3"/>
   </label>
   <button type="submit" disabled={Boolean(busy)||!campaignId} className="min-h-11 rounded-lg bg-cyan-600 px-4 font-semibold text-white disabled:opacity-50">Save experiment plan</button>
  </form>
  {notice&&<p role="status" className="text-sm">{notice}</p>}
  {state.phase==="loading"&&<p role="status">Loading experiment journal…</p>}
  {state.phase==="error"&&<p role="alert" className="text-red-600">{state.error}</p>}
  {state.phase==="ready"&&<ul className="space-y-3">{state.rows.map(row=><li key={row.experiment_id} className="space-y-2 rounded-lg border p-4">
   <strong className="text-sm capitalize">{row.channel} · {row.status}</strong>
   <p className="text-sm whitespace-pre-wrap">{row.hypothesis}</p>
   <p className="text-xs text-muted-foreground">Started {new Date(row.created_at).toLocaleString()}</p>
   {row.status==="closed"?<p className="text-sm">Owner-reported result: {row.outcome_note}</p>:<>
     <label className="block text-sm">Observed outcome (not verified by provider)
       <textarea className="mt-1 min-h-24 w-full rounded-lg border bg-background p-3" maxLength={1000}
         value={outcomes[row.experiment_id]||""} onChange={e=>setOutcomes(x=>({...x,[row.experiment_id]:e.target.value}))}/>
     </label>
     <button type="button" disabled={Boolean(busy)} onClick={()=>close(row.experiment_id)}
       className="min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50">Record outcome and close</button>
   </>}
  </li>)}</ul>}
 </section>;
}
