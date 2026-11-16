import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { authClient } from "@/api/auth";

// Route is guarded by MemberAccess + SuperAdminAccess. RPC separately verifies
// the server-side super-admin role; this view cannot mark deletion completed.
export default function AdminDeletionQueue(){
  const [rows,setRows]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const [inspection,setInspection]=useState({});
  const [inspectionLoading,setInspectionLoading]=useState("");
  const [inspectionError,setInspectionError]=useState({});
  const inspect=async requestId=>{
    setInspectionLoading(requestId);
    setInspectionError(current=>({...current,[requestId]:""}));
    try{
      const {data,error:issue}=await authClient().rpc("ifund_admin_account_erasure_preflight",{p_request_id:requestId});
      if(issue||!data||data.open_request!==true)throw new Error(issue?.message||"Dependency review unavailable.");
      setInspection(current=>({...current,[requestId]:data}));
    }catch(cause){
      setInspection(current=>{const next={...current};delete next[requestId];return next;});
      setInspectionError(current=>({...current,[requestId]:cause.message||"Dependency review unavailable."}));
    }finally{setInspectionLoading("");}
  };
  useEffect(()=>{
    let alive=true;
    setLoading(true);setError("");setRows([]);setInspection({});setInspectionError({});
    let client;
    try{client=authClient();}
    catch{setError("Unable to initialize the verified administrative session.");setLoading(false);return;}
    client.rpc("ifund_super_admin_account_deletion_queue",{p_limit:100}).then(({data,error:issue})=>{
      if(!alive)return;
      if(issue||!Array.isArray(data))throw new Error(issue?.message||"Unable to verify account-deletion requests.");
      setRows(data);setLoading(false);
    }).catch(cause=>{if(alive){setRows([]);setError(cause.message||"Queue unavailable.");setLoading(false);}});
    return()=>{alive=false;};
  },[refresh]);
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
    <header className="space-y-3">
      <Link to="/admin" className="text-sm text-primary underline">Administration</Link>
      <h1 className="flex items-center gap-3 text-3xl font-bold"><ShieldCheck aria-hidden="true" className="h-7 w-7"/> Account deletion requests</h1>
      <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
        Authorized account-erasure queue. Confirm a requester's eligibility, dependent content,
        third-party records, outstanding transactions and applicable retention obligations before
        taking independently audited erasure action. This view cannot delete users or financial records.
      </p>
      <button type="button" onClick={()=>setRefresh(n=>n+1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4">
        <RefreshCw aria-hidden="true" className="h-4 w-4"/> Refresh queue
      </button>
    </header>
    {loading&&<p role="status">Checking authorized deletion requests…</p>}
    {error&&<p role="alert" className="rounded-lg border border-destructive p-4 text-sm">{error}</p>}
    {!loading&&!error&&<section aria-label="Pending account-deletion requests" className="space-y-4">
      <p className="text-sm text-muted-foreground">{rows.length} requests returned (up to 100 oldest)</p>
      {!rows.length&&<p className="rounded-xl border border-border p-5">No outstanding deletion requests.</p>}
      <div className="space-y-3">{rows.map(row=><article key={row.request_id} className="space-y-2 rounded-xl border border-border bg-card p-5">
        <h2 className="break-all text-sm font-semibold">Reference: {row.request_id}</h2>
        <p className="break-all text-xs">User reference: {row.requested_user_id||"Account identity already removed"}</p>
        <p className="text-sm">Current status: <strong>{row.request_status}</strong></p>
        <p className="text-xs text-muted-foreground">Submitted: {row.submitted_at?new Date(row.submitted_at).toLocaleString():"Unknown"}</p>
        <p className="text-xs text-muted-foreground">Updated: {row.updated_at?new Date(row.updated_at).toLocaleString():"Unknown"}</p>
        <button type="button" disabled={inspectionLoading===row.request_id} onClick={()=>inspect(row.request_id)} className="min-h-11 rounded-xl border border-border px-4 text-sm disabled:opacity-50">
          {inspectionLoading===row.request_id?"Inspecting…":"Review dependent data"}
        </button>
        {inspectionError[row.request_id]&&<p role="alert" className="text-sm text-destructive">{inspectionError[row.request_id]}</p>}
        {inspection[row.request_id]&&<section aria-label="Partial account erasure dependency review" className="space-y-2 rounded-lg border border-border p-4 text-sm">
          <p className="font-semibold">Read-only dependency snapshot (not clearance to erase)</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Campaigns: {inspection[row.request_id].campaigns}</li>
            <li>Connected providers: {inspection[row.request_id].connections}</li>
            <li>Notifications: {inspection[row.request_id].notifications}</li>
            <li>Supabase Storage objects: {inspection[row.request_id].storage_objects}</li>
          </ul>
          <p className="text-muted-foreground">Financial records, other database schemas, R2 objects and external providers still require independent review. This interface cannot approve or perform deletion.</p>
        </section>}
      </article>)}</div>
    </section>}
    <p className="border-t border-border pt-5 text-xs text-muted-foreground">
      Do not label an account deletion completed until eligibility, erasure, legally required retention,
      notifications and evidence have been independently verified. No workflow or button here performs deletion.
    </p>
  </main>;
}
