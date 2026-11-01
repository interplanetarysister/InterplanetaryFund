import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

async function readStatus(path){
  const res=await fetch(path,{cache:"no-store",credentials:"same-origin"});
  if(!res.ok || !(res.headers.get("content-type")||"").includes("application/json"))throw Error("No verified response");
  return res.json();
}
export default function OpsCenter(){
  const [health,setHealth]=useState({phase:"loading",data:null});
  const [automations,setAutomations]=useState({phase:"loading",data:null});
  useEffect(()=>{
    let mounted=true;
    readStatus("/api/health")
      .then(data=>{if(mounted)setHealth({phase:data.service==="ifund-migration-api"?"ready":"unverified",data});})
      .catch(()=>{if(mounted)setHealth({phase:"error",data:null});});
    readStatus("/api/automations/readiness")
      .then(data=>{if(mounted)setAutomations({phase:data.source_workflows===17?"ready":"unverified",data});})
      .catch(()=>{if(mounted)setAutomations({phase:"error",data:null});});
    return()=>{mounted=false;};
  },[]);
  return <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
    <header><p className="text-sm font-semibold uppercase text-primary">Administration</p><h1 className="font-display text-3xl font-bold">Operations center</h1><p className="mt-2 text-muted-foreground">Independent infrastructure status and guarded migration controls.</p></header>
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border border-border bg-card p-5"><h2 className="text-lg font-semibold">Migration API</h2>
        {health.phase==="loading"?<p role="status">Checking API…</p>:health.phase==="error"?<p role="alert">API health could not be verified.</p>:
         <p role="status">{health.phase==="ready"?"Migration API responded; this does not prove production parity.":"Response did not match independent IFund API."}</p>}
        {health.data&&<p className="mt-2 text-sm text-muted-foreground">Production release: {health.data.production===true?"reported active":"not verified as active"}</p>}
      </section>
      <section className="rounded-2xl border border-border bg-card p-5"><h2 className="text-lg font-semibold">Workflow execution</h2>
        {automations.phase==="loading"?<p role="status">Checking workflow registry…</p>:automations.phase==="error"?<p role="alert">Workflow status could not be verified.</p>:
        <p role="status">{automations.data?.execution_enabled===true?"Execution was reported enabled. Verify service ownership and audit before trusting this status.":"Workflow execution is disabled or not independently verified."}</p>}
        {automations.data&&<p className="mt-2 text-sm text-muted-foreground">{automations.data.source_workflows} historical workflow definitions registered; {automations.data.verified_active_workflows} confirmed active.</p>}
      </section>
    </div>
    <section className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-lg font-semibold">Operational controls</h2>
      <p>Release actions, PayPal settlement, role changes, provider grants, AI execution, and data reconciliation require independently authorized backend handlers. No unsafe actions are offered by this page.</p>
      <nav aria-label="Administrative workspaces" className="flex flex-wrap gap-3">
        <Link to="/admin/integrations" className="rounded-xl border border-border px-4 py-2">Integrations</Link>
        <Link to="/admin/audit" className="rounded-xl border border-border px-4 py-2">Audit</Link>
        <Link to="/admin/sustainability" className="rounded-xl border border-border px-4 py-2">Sustainability</Link>
      </nav>
    </section>
  </main>;
}
