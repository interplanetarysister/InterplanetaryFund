import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";

/** Admin Builder diagnostics are read-only; never queues a fix or deploys. */
export default function BuilderOperationalReview(){
  const [state,setState]=useState({phase:"loading",summary:null,error:""});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let mounted=true;
    setState({phase:"loading",summary:null,error:""});
    authClient().rpc("ifund_super_admin_operational_snapshot")
      .then(({data,error})=>{
        if(!mounted)return;
        if(error||!Array.isArray(data)||data.length!==1)
          throw new Error("Verified super-admin operations summary unavailable.");
        setState({phase:"ready",summary:data[0],error:""});
      }).catch(e=>{if(mounted)setState({phase:"error",summary:null,error:e.message||"Unavailable"})});
    return()=>{mounted=false};
  },[retry]);
  const display=n=>n===null||n===undefined||n===""||typeof n==="boolean"||
    !Number.isSafeInteger(Number(n))||Number(n)<0?"Unavailable":String(n);
  return <section className="rounded-xl border border-border bg-card p-5" aria-label="Admin Builder Coordinator diagnostic review">
    <h2 className="text-xl font-semibold">Admin Builder Coordinator · Diagnostics</h2>
    <p className="mt-2 text-sm text-muted-foreground">
      Free, read-only database diagnostics. This tool does not edit source code,
      dispatch a builder job or change production. Super-admin approval remains
      mandatory for engineering and deployment actions.
    </p>
    {state.phase==="loading"&&<p role="status" className="mt-3">Checking restricted operational records…</p>}
    {state.phase==="error"&&<div role="alert" className="mt-3">
      <p>{state.error}</p><button type="button" className="mt-2 min-h-11 rounded-lg border px-4"
      onClick={()=>setRetry(n=>n+1)}>Retry</button>
    </div>}
    {state.phase==="ready"&&<dl className="mt-4 grid gap-3 sm:grid-cols-3">
      {[
        ["Open incident records","unresolved_platform_incidents"],
        ["Failed workflow jobs","failed_workflow_jobs"],
        ["Overdue workflow jobs","overdue_workflow_jobs"],
      ].map(([title,key])=><div key={key} className="rounded-lg border border-border p-4">
        <dt className="text-xs text-muted-foreground">{title}</dt>
        <dd className="mt-2 text-2xl font-semibold">{display(state.summary[key])}</dd>
      </div>)}
    </dl>}
    <Link to="/finances#platform-finance" className="mt-4 inline-flex min-h-11 items-center text-sm underline">Review full verified finance and operations</Link>
  </section>;
}
