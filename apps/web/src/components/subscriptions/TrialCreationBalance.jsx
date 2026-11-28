import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";

/** Display server-computed, account-scoped allowances; never trust local counts. */
export default function TrialCreationBalance({ compact = false }) {
  const [info,setInfo]=useState(null);
  useEffect(()=>{
    const refresh=()=>setInfo(null);
    window.addEventListener("ifund-ai-creation-completed",refresh);
    return ()=>window.removeEventListener("ifund-ai-creation-completed",refresh);
  },[]);
  useEffect(()=>{
    if(info!==null)return;
    let live=true;
    authClient().rpc("ifund_ai_content_status").then(({data,error})=>{
      if(live && !error && ((data?.admin===true && data.entitled===true && data.limit===null && data.remaining===null) || (Number.isInteger(data?.remaining) && [15,50].includes(data.limit))))setInfo(data);
    }).catch(()=>{});
    return ()=>{live=false;};
  },[info]);
  if(!info)return null;
  if(info.admin===true && info.entitled===true && info.limit===null)
    return <section aria-label="Administrator AI generation allowance" className="rounded-lg bg-cyan-500/[.055] p-3">
      <p className="text-sm font-semibold">Administrator AI access: unlimited</p>
      {!compact&&<p className="mt-1 text-xs text-muted-foreground">No subscription or personal creation credits required. Shared provider capacity and your AI permission still apply.</p>}
    </section>;
  if(!info.trial && !info.paid)return null;
  const done=info.remaining<=0;
  const maximum=info.paid?50:15;
  return <section aria-label="Account AI generation allowance"
    className={compact
      ?"rounded-lg bg-cyan-500/[.055] px-2 py-2 text-xs"
      :"rounded-xl border "+(done?"border-amber-400/40":"border-cyan-400/30")+" bg-background/70 p-4"}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-semibold">{done?(info.paid?"Monthly AI creations used":"Your 15 free AI creations are used"):(info.paid?"Premium AI creations: ":"Trial AI creations: ")+info.remaining+" of "+maximum+" left"}</p>
      {done&&<Link to="/subscriptions" className="inline-flex min-h-11 items-center rounded-lg bg-cyan-700 px-3 text-sm font-semibold text-white">Review plan & credits</Link>}
    </div>
    {!compact&&<p className="mt-1 text-xs text-muted-foreground">{done
      ?"You can still write, upload, edit, save and publish campaigns without AI."
      :"AI writing, artwork and image improvements share your account allowance. Premium creations renew with a verified monthly payment; unused credits do not roll over. Manual campaign tools remain free."}</p>}
  </section>;
}
