import { useState } from "react";
import { authClient } from "@/api/auth";

// No secrets, service keys or mutable operations are exposed to this browser view.
// All URLs must be same-origin and enabled only after verified Worker routes exist.
const SERVICES = [
  {name:"Migration API",key:"VITE_IFUND_MIGRATION_API_PATH",description:"Public migration API gateway; currently staged/disabled"},
  {name:"Notifications",key:"VITE_IFUND_NOTIFICATIONS_PATH",description:"Authenticated notifications and acknowledgement"},
  {name:"Workflows",key:"VITE_IFUND_WORKFLOWS_PATH",description:"Scheduled automation; administratively disabled"},
  {name:"Workforce",key:"VITE_IFUND_WORKFORCE_PATH",description:"Agent orchestration; administratively disabled"},
  {name:"OAuth",key:"VITE_IFUND_OAUTH_PATH",description:"Authorization and provider connections; disabled"},
];
const CONFIG = import.meta.env;
function readPath(key) {
  const candidate=CONFIG[key];
  if(typeof candidate!=="string" || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("..")) return "";
  return candidate;
}
export default function WorkerConnectionsAdmin() {
  const [results,setResults]=useState({});
  const [pending,setPending]=useState("");
  async function inspect(item) {
    const path=readPath(item.key);
    if(!path)return;
    setPending(item.key);
    try {
      const {data,error}=await authClient().auth.getSession();
      if(error || !data?.session?.access_token)throw Error("Sign in required");
      // Read-only health path must be implemented and audited by the backend.
      const response=await fetch(path.replace(/\\/$/,"")+"/health",{method:"GET",headers:{Authorization:"Bearer "+data.session.access_token},cache:"no-store",credentials:"same-origin"});
      const value=await response.text();
      setResults(old=>({...old,[item.key]:{status:response.status,ok:response.ok,body:value.slice(0,240)}}));
    } catch(e) {setResults(old=>({...old,[item.key]:{status:"Unavailable",body:e.message}}));}
    finally {setPending("");}
  }
  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
    <header className="space-y-2"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Interplanetary Fund · Infrastructure</p><h1 className="text-3xl font-bold">Worker connections</h1><p className="text-muted-foreground">Read-only connection inventory. A configured endpoint is not proof the service is enabled. No connection, OAuth flow, payment or automation is activated here.</p></header>
    <div className="grid gap-3">{SERVICES.map(item=>{const path=readPath(item.key),result=results[item.key];return <section key={item.key} className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{item.name}</h2><span className="text-xs text-muted-foreground">{path?"Path configured":"Not connected"}</span></div>
      <p className="text-sm text-muted-foreground">{item.description}</p>
      {path&&<code className="block break-all text-xs">{path}</code>}
      <button type="button" className="rounded-lg border border-input px-4 py-2 disabled:opacity-50" disabled={!path||Boolean(pending)} onClick={()=>inspect(item)}>{pending===item.key?"Checking…":"Check read-only health"}</button>
      {result&&<div role="status" className="rounded-lg bg-muted p-3 text-xs break-words">HTTP {result.status}: {result.body||"No response body"}</div>}
    </section>})}</div>
    <p className="text-sm text-muted-foreground">Configure paths only after a verified same-origin Cloudflare route exists. Status does not certify authorization, function parity or production readiness.</p>
  </main>;
}
