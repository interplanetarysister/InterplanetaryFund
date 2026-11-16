import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { authClient } from "@/api/auth";

// Route is guarded by MemberAccess + SuperAdminAccess. RPC separately verifies
// the server-side super-admin role; this view cannot mark deletion completed.
export default function AdminDeletionQueue(){
  const [rows,setRows]=useState([]);
  const [dependencySnapshot,setDependencySnapshot]=useState({});
  const [dependencyBusy,setDependencyBusy]=useState("");
  const [dependencyIssue,setDependencyIssue]=useState({});
  const [reviewed,setReviewed]=useState({});
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  const [selected,setSelected]=useState("");
  const [reviewNote,setReviewNote]=useState("");
  const [processing,setProcessing]=useState("");
  const [notice,setNotice]=useState("");
  useEffect(()=>{
    let alive=true;
    setLoading(true);setError("");setRows([]);setReviewed({});
    let client;
    try{client=authClient();}
    catch{setError("Unable to initialize the verified administrative session.");setLoading(false);return;}
    let verifiedAdmin=null;
    const {data:subscription}=client.auth.onAuthStateChange((_event,session)=>{
      if(!alive||!verifiedAdmin)return;
      if(session?.user?.id!==verifiedAdmin){
        setRows([]);setReviewed({});
        setError("The administrative session changed. Reload to verify access.");
        setLoading(false);
      }
    });
    (async()=>{
      const {data:before,error:beforeError}=await client.auth.getUser();
      if(beforeError||!before?.user?.id)throw Error("Verified administrator required.");
      verifiedAdmin=before.user.id;
      const [queue,approvals]=await Promise.all([
        client.rpc("ifund_super_admin_account_deletion_queue",{p_limit:100}),
        client.rpc("ifund_super_admin_private_document_reviewed_queue",{}),
      ]);
      if(queue.error||!Array.isArray(queue.data)||
         approvals.error||!Array.isArray(approvals.data))
        throw Error("The protected account-deletion review queue is unavailable.");
      const {data:after,error:afterError}=await client.auth.getUser();
      if(afterError||after?.user?.id!==verifiedAdmin)
        throw Error("The administrative session changed during review.");
      if(!alive)return;
      const ids=new Set(queue.data.map(item=>item.request_id));
      const status={};
      for(const item of approvals.data){
        if(ids.has(item.request_id)&&typeof item.review_ready==="boolean")
          status[item.request_id]=item.review_ready;
      }
      setReviewed(status);
      setRows(queue.data);
      setLoading(false);
    })().catch(cause=>{
      if(alive){setRows([]);setReviewed({});setError(cause.message||"Queue unavailable.");setLoading(false);}
    });
    return()=>{alive=false;subscription?.subscription?.unsubscribe();};
  },[refresh]);

  async function inspectDependencies(row){
    setDependencyBusy(row.request_id);
    setDependencyIssue(current=>({...current,[row.request_id]:""}));
    try {
      const {data,error:issue}=await authClient().rpc("ifund_admin_account_erasure_preflight",{p_request_id:row.request_id});
      if(issue||data?.open_request!==true||data?.safe_to_erase!==false)throw Error(issue?.message||"Verified dependency snapshot unavailable.");
      setDependencySnapshot(current=>({...current,[row.request_id]:data}));
    }catch(cause){
      setDependencySnapshot(current=>{const next={...current};delete next[row.request_id];return next;});
      setDependencyIssue(current=>({...current,[row.request_id]:cause.message||"Dependency review unavailable."}));
    }finally{setDependencyBusy("");}
  }
  async function act(row,reviewOnly=false){
    if(processing)return;
    if(!reviewOnly&&!window.confirm("Permanently remove this reviewed account's private campaign document files? This is irreversible and does not complete financial or account deletion."))return;
    setProcessing(row.request_id);setError("");setNotice("");
    try{
      const client=authClient();
      const {data:identity,error:identityError}=await client.auth.getUser();
      if(identityError||!identity?.user?.id)throw Error("Administrator session is not verified.");
      if(reviewOnly){
        if(reviewNote.trim().length<30||reviewNote.trim().length>1000)
          throw Error("Record a review decision of 30–1,000 characters.");
        const {data,error:approvalError}=await client.rpc("ifund_super_admin_review_private_document_cleanup",{
          p_request_id:row.request_id,p_review_note:reviewNote.trim()
        });
        if(approvalError||data!==true)throw Error("Administrative file-cleanup review was not accepted.");
        setNotice("Review recorded. This does not complete the account deletion.");
        setReviewNote("");
      }else{
        const {data:session,error:sessionError}=await client.auth.getSession();
        if(sessionError||session?.session?.user?.id!==identity.user.id||!session.session.access_token)
          throw Error("Administrator session changed.");
        const reply=await fetch("/api/services/admin/private-document-erasure",{
          method:"POST",
          headers:{authorization:"Bearer "+session.session.access_token,"content-type":"application/json"},
          body:JSON.stringify({request_id:row.request_id}),
          signal:AbortSignal.timeout(90000)
        });
        const result=await reply.json().catch(()=>null);
        if(!reply.ok||typeof result?.verified!=="boolean"||
           !Number.isInteger(result.documents_removed)||result.documents_removed<0||
           result.account_deleted!==false||
           (result.verified===false&&result.more_documents!==true))
          throw Error("Private document cleanup is not verified. Review the restricted service and retry.");
        const {data:after,error:changed}=await client.auth.getUser();
        if(changed||after?.user?.id!==identity.user.id)throw Error("Administrator session changed.");
        setNotice(result.documents_removed+" private campaign documents removed. "+(result.verified
          ? "Private document cleanup is verified complete."
          : "More private documents remain; repeat the reviewed cleanup.")+
          " Financial and account erasure remain separately pending.");
      }
      setRefresh(value=>value+1);
    }catch(cause){
      setError(cause?.message||"The operation was not completed.");
    }finally{setProcessing("");}
  }
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
    {notice&&<p role="status" className="rounded-lg border border-border p-4 text-sm">{notice}</p>}
    {!loading&&!error&&<section aria-label="Pending account-deletion requests" className="space-y-4">
      <p className="text-sm text-muted-foreground">{rows.length} requests returned (up to 100 oldest)</p>
      {!rows.length&&<p className="rounded-xl border border-border p-5">No outstanding deletion requests.</p>}
      <div className="space-y-3">{rows.map(row=><article key={row.request_id} className="space-y-2 rounded-xl border border-border bg-card p-5">
        <h2 className="break-all text-sm font-semibold">Reference: {row.request_id}</h2>
        <p className="break-all text-xs">User reference: {row.requested_user_id||"Account identity already removed"}</p>
        <p className="text-sm">Current status: <strong>{row.request_status}</strong></p>
        <p className="text-xs text-muted-foreground">Private-file cleanup authorization: {reviewed[row.request_id]===true?"Reviewed and authorized":"Not yet reviewed for document erasure"}</p>
        <p className="text-xs text-muted-foreground">Submitted: {row.submitted_at?new Date(row.submitted_at).toLocaleString():"Unknown"}</p>
        <p className="text-xs text-muted-foreground">Updated: {row.updated_at?new Date(row.updated_at).toLocaleString():"Unknown"}</p>
        {["requested","reviewing"].includes(row.request_status)&&reviewed[row.request_id]!==true&&<div className="rounded-xl border border-border p-3 space-y-2">
          <label className="block text-sm font-semibold" htmlFor={"review-"+row.request_id}>Private-document cleanup review evidence</label>
          <textarea id={"review-"+row.request_id} value={selected===row.request_id?reviewNote:""}
            onFocus={()=>{if(selected!==row.request_id){setSelected(row.request_id);setReviewNote("");}}}
            onChange={event=>{setSelected(row.request_id);setReviewNote(event.target.value);}}
            maxLength={1000} rows={3} className="w-full rounded-lg border border-border bg-background p-3 text-sm"
            placeholder="Record the completed authorization, retention and financial dependency checks; this only approves document-file cleanup." />
          <button type="button" disabled={Boolean(processing)||selected!==row.request_id||reviewNote.trim().length<30}
            onClick={()=>act(row,true)} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">
            Record reviewed file-cleanup authorization
          </button>
        </div>}
        {row.request_status==="reviewing"&&reviewed[row.request_id]===true&&<button type="button" disabled={Boolean(processing)}
          onClick={()=>act(row,false)}
          className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold">
          Remove reviewed account's private campaign documents
        </button>}

      </article>)}</div>
    </section>}
    <p className="border-t border-border pt-5 text-xs text-muted-foreground">
      Do not label an account deletion completed until eligibility, erasure, legally required retention,
      notifications and evidence have been independently verified. Private-file cleanup is a separate irreversible action; this screen never completes identity or financial-record deletion.
    </p>
  </main>;
}
