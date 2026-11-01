import { useEffect, useState } from "react";
import { authClient } from "@/api/auth";

// Only the server-authorized RPC can read the private workflow registry.
// This screen contains no run-now, payment, posting, or scheduler mutations.
export default function WorkflowRegistryAdmin() {
  const [rows,setRows] = useState([]);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  async function refresh() {
    setLoading(true);setError("");
    try {
      const { data,error:dbError }=await authClient().rpc("ifund_admin_workflow_registry");
      if(dbError)throw dbError;
      if(!Array.isArray(data))throw Error("Unexpected workflow registry response");
      setRows(data);
    } catch {setRows([]);setError("Unable to read workflows. Confirm this account has the required administrator role.");}
    finally {setLoading(false);}
  }
  useEffect(()=>{refresh();},[]);
  const complete=rows.filter(row=>row.migration_status==="verified").length;
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
    <header><p className="text-xs font-semibold uppercase tracking-widest text-primary">Interplanetary Fund · Administration</p><h1 className="mt-2 text-3xl font-bold">Workflow migration</h1><p className="mt-2 text-muted-foreground">Original Base44 workflow records in the independent Supabase control registry. Inventory is not operational parity. Execution remains disabled until reviewed.</p></header>
    <div className="flex flex-wrap gap-3"><div className="rounded-xl border p-4"><strong className="text-2xl">{rows.length}</strong><p className="text-sm text-muted-foreground">Tracked workflows</p></div><div className="rounded-xl border p-4"><strong className="text-2xl">{complete}</strong><p className="text-sm text-muted-foreground">Verified</p></div><div className="rounded-xl border p-4"><strong className="text-2xl">{rows.filter(row=>row.execution_enabled).length}</strong><p className="text-sm text-muted-foreground">Execution enabled</p></div></div>
    <button type="button" disabled={loading} onClick={refresh} className="min-h-11 rounded-xl border border-input px-5 disabled:opacity-50">{loading?"Loading…":"Refresh registry"}</button>
    {error&&<p role="alert" className="text-destructive">{error}</p>}
    <div className="space-y-3">{rows.map(row=><section key={row.source_id} className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{row.name}</h2><span className="rounded-lg bg-muted px-2 py-1 text-xs">{row.migration_status.replaceAll("_"," ")}</span></div><p className="mt-2 text-sm text-muted-foreground">Trigger: {row.trigger_kind}{row.original_cron?" · Original cron: "+row.original_cron:""} · Original status: {row.source_status}</p><p className="mt-1 text-sm">{row.execution_enabled?"Execution enabled":"Execution paused"} · {row.target_handler||"Target handler not verified"}</p></section>)}</div>
  </main>;
}
