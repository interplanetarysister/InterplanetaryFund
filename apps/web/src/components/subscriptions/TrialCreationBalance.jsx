import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";

/** Display server-computed, account-scoped allowances; never trust local counts. */
export default function TrialCreationBalance({ compact = false }) {
  const [info,setInfo]=useState(null);
  useEffect(()=>{
    let live=true;
    authClient().rpc("ifund_trial_ai_generation_status").then(({data,error})=>{
      if(live&& !error && Number.isInteger(data?.remaining) && data.limit===15)
        setInfo(data);
    }).catch(()=>{});
    const refresh=()=>setInfo(null);
    window.addEventListener("ifund-ai-creation-completed",refresh);
    return ()=>{live=false;window.removeEventListener("ifund-ai-creation-completed",refresh);};
  },[]);
  useEffect(()=>{
    if(info!==null)return;
    let live=true;
    authClient().rpc("ifund_trial_ai_generation_status").then(({data,error})=>{
      if(live && !error && Number.isInteger(data?.remaining) && data.limit===15)setInfo(data);
    }).catch(()=>{});
    return ()=>{live=false;};
  },[info]);
  if(!info || !info.trial)return null;
  const done=info.remaining<=0;
  return <section aria-label="Free trial AI generation allowance"
    className={compact
      ?"rounded-lg bg-cyan-500/[.055] px-2 py-2 text-xs"
      :"rounded-xl border "+(done?"border-amber-400/40":"border-cyan-400/30")+" bg-background/70 p-4"}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-semibold">{done?"Your 15 free AI creations are used":"Trial AI creations: "+info.remaining+" of 15 left"}</p>
      {done&&<Link to="/subscriptions" className="inline-flex min-h-11 items-center rounded-lg bg-cyan-700 px-3 text-sm font-semibold text-white">Explore premium access</Link>}
    </div>
    {!compact&&<p className="mt-1 text-xs text-muted-foreground">{done
      ?"You can still write, upload, edit, save and publish campaigns without AI."
      :"AI-created writing, artwork and image improvements share this allowance. Manual campaign tools remain free."}</p>}
  </section>;
}
