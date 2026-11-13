import {useEffect,useState} from "react";
import {authClient} from "@/api/auth";

/** NEXUS mission brief schedule request, not proof the scheduler is active. */
export default function NexusBriefSchedule() {
 const [state,setState]=useState({phase:"loading",enabled:false,days:7,next:null,error:""});
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let active=true;
  setState({phase:"loading",enabled:false,days:7,next:null,error:""});
  authClient().rpc("ifund_my_nexus_brief_preferences").then(({data,error})=>{
   if(!active)return;
   if(error||!Array.isArray(data)||data.length!==1)throw new Error("Mission brief preferences could not be verified.");
   const value=data[0];
   setState({phase:"ready",enabled:value.enabled===true,days:value.frequency_days===1?1:7,next:value.next_run_at||null,error:""});
  }).catch(e=>{if(active)setState({phase:"error",enabled:false,days:7,next:null,error:e.message||"Unavailable"});});
  return ()=>{active=false};
 },[retry]);
 async function save(e){
  e.preventDefault();if(busy||state.phase!=="ready")return;
  setBusy(true);setNotice("");
  try{
   const {data,error}=await authClient().rpc("ifund_set_nexus_brief_preferences",{
    p_enabled:state.enabled,p_frequency_days:state.days,
   });
   if(error||data!==true)throw new Error(error?.message||"Brief preference was not confirmed.");
   setNotice("Mission brief preference saved. Delivery requires separately verified scheduled execution.");
   setRetry(x=>x+1);
  }catch(e){setNotice(e.message||"Unable to update mission briefs.");}
  finally{setBusy(false)}
 }
 return <section className="rounded-xl border border-border p-4 space-y-2" aria-label="NEXUS scheduled mission briefs">
  <h3 className="font-semibold">NEXUS · Scheduled mission briefs</h3>
  <p className="text-xs text-muted-foreground">Opt into a daily or weekly in-app reminder to review campaign priorities and owner-approved agent tasks. Scheduling requires an independently enabled and verified worker; saving a preference is not confirmation of delivery.</p>
  {state.phase==="loading"&&<p role="status">Loading schedule preference…</p>}
  {state.phase==="error"&&<p role="alert">{state.error} <button type="button" className="underline" onClick={()=>setRetry(x=>x+1)}>Retry</button></p>}
  {state.phase==="ready"&&<form onSubmit={save} className="space-y-3">
   <label className="flex items-center gap-2 text-sm">
    <input type="checkbox" checked={state.enabled} onChange={e=>setState(s=>({...s,enabled:e.target.checked}))}/>
    Request in-app mission brief reminders
   </label>
   <label className="block text-sm">Frequency
    <select className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3" value={state.days} onChange={e=>setState(s=>({...s,days:Number(e.target.value)}))}>
     <option value={7}>Weekly</option><option value={1}>Daily</option>
    </select>
   </label>
   {state.next&&<p className="text-xs text-muted-foreground">Next recorded due time: {new Date(state.next).toLocaleString()}. Actual delivery is subject to scheduler availability.</p>}
   <button type="submit" disabled={busy} className="min-h-11 rounded-lg border px-4 font-semibold disabled:opacity-50">Save schedule preference</button>
  </form>}
  {notice&&<p role="status" className="text-xs">{notice}</p>}
 </section>;
}
