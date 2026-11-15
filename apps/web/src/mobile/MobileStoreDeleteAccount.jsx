import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthSession } from "@/hooks/useAuthSession";
import { getMyAccountDeletionRequests, requestAccountDeletion } from "@/lib/accountDeletion";

const STATUS_LABELS={
  requested:"Request received",
  reviewing:"Reviewing your account data",
  requires_legal_retention:"Checking legally required financial retention",
  completed:"Deletion recorded as complete",
};
export default function MobileStoreDeleteAccount(){
  const {user,status}=useAuthSession();
  const [confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const [checking,setChecking]=useState(false),[reload,setReload]=useState(0);
  const [requests,setRequests]=useState([]);
  const [checkedFor,setCheckedFor]=useState(null);

  useEffect(()=>{
    let active=true;
    setRequests([]);setCheckedFor(null);setError("");
    if(status==="loading")return()=>{active=false;};
    if(!user?.id || user.is_anonymous){setCheckedFor("guest");return()=>{active=false;};}
    setChecking(true);
    getMyAccountDeletionRequests().then(rows=>{
      if(active){setRequests(rows);setCheckedFor(user.id);}
    }).catch(cause=>{
      if(active)setError(cause?.message||"Could not verify account deletion requests.");
    }).finally(()=>{if(active)setChecking(false);});
    return()=>{active=false;};
  },[user?.id,user?.is_anonymous,status,reload]);

  async function requestDeletion(event){
    event.preventDefault();
    if(!confirmed||busy||checking)return;
    setBusy(true);setError("");
    try{
      const request=await requestAccountDeletion();
      setRequests(rows=>[{
        id:request.id,status:request.status,requestedAt:request.requestedAt,
        updatedAt:request.requestedAt,
      },...rows.filter(row=>row.id!==request.id)]);
      setConfirmed(false);
      setCheckedFor(user.id);
    }catch(cause){setError(cause?.message||"Request not confirmed. Please retry.");}
    finally{setBusy(false);}
  }
  const activeRequest=requests.find(r=>["requested","reviewing","requires_legal_retention"].includes(r.status));
  const accountVerified=checkedFor===user?.id;

  return <section className="space-y-6">
    <header className="space-y-3">
      <h1 className="text-3xl font-bold">Permanently delete your IFund account</h1>
      <p className="text-sm leading-6 text-slate-300">You can start deletion here without contacting support. This requests removal of your account and associated personal and user-generated content, subject only to legally required retention.</p>
    </header>
    <div className="space-y-3 rounded-xl border border-white/20 bg-white/5 p-5 text-sm leading-6 text-slate-300">
      <h2 className="text-lg font-bold text-white">What happens after you request deletion?</h2>
      <p>Your request is recorded directly in the IFund deletion queue. Account ownership and any required withdrawal, tax, legal, fraud or dispute retention are reviewed before eligible data is erased. Requesting deletion does not immediately remove published campaigns or financial records.</p>
      <p>You will see a reference and request status. We will confirm when deletion is complete. Any legally retained records will be limited to the applicable purpose and retention obligation; personal and published content is otherwise included in the deletion request.</p>
      <p>If a verification or legal review is necessary, you will be informed. There is no fee to submit a deletion request.</p>
      <Link to="/privacy" className="text-emerald-200 underline">Read the privacy policy</Link>
    </div>
    {(status==="loading"||checking||(user?.id&&!accountVerified&&!error))&&
      <p role="status" className="text-sm">Checking your account and existing deletion requests…</p>}
    {status!=="loading"&&!user&&<div className="space-y-3 rounded-xl border border-white/20 p-5">
      <p className="text-sm text-slate-300">Sign in to begin a secure account-deletion request. You can also initiate deletion using the website without keeping this app installed.</p>
      <Link to="/login?returnTo=%2Fdelete-account"
        className="inline-flex min-h-11 items-center rounded-lg bg-emerald-200 px-4 font-semibold text-slate-950">
        Sign in to delete account
      </Link>
    </div>}
    {user&&accountVerified&&activeRequest&&<div role="status" className="space-y-3 rounded-xl border border-emerald-300/40 bg-emerald-950/30 p-5">
      <h2 className="text-lg font-bold">Your account deletion is pending</h2>
      <p className="text-sm">Status: {STATUS_LABELS[activeRequest.status]||activeRequest.status}</p>
      <p className="break-all text-xs">Request reference: {activeRequest.id}</p>
      <p className="text-xs">Submitted: {activeRequest.requestedAt?new Date(activeRequest.requestedAt).toLocaleDateString():"Recorded by IFund"}</p>
      <p className="text-sm text-slate-200">This is not a completed deletion. The request stays open until the erasure/retention review is finished.</p>
      <button type="button" onClick={()=>setReload(n=>n+1)} className="min-h-11 rounded-lg border border-white/30 px-4 text-sm">Refresh status</button>
    </div>}
    {user&&accountVerified&&!activeRequest&&<form onSubmit={requestDeletion}
      className="space-y-4 rounded-xl border border-rose-300/40 bg-white/5 p-5">
      <h2 className="text-lg font-bold">Start deletion</h2>
      <p className="break-words text-sm">Signed-in account: <strong>{user.email||"Verified IFund account"}</strong></p>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
        <input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}
          className="mt-1 h-5 w-5 accent-rose-300"/>
        <span>I request permanent deletion of this IFund account and eligible associated data and content, including published user content. I understand certain legally required records may remain.</span>
      </label>
      <button type="submit" disabled={!confirmed||busy}
        className="min-h-12 rounded-xl bg-rose-200 px-5 font-semibold text-rose-950 disabled:opacity-50">
        {busy?"Recording your request…":"Request permanent account deletion"}
      </button>
    </form>}
    {error&&<div role="alert" className="space-y-2 rounded-xl border border-rose-300/40 p-4">
      <p className="text-sm text-rose-200">{error}</p>
      <button type="button" className="min-h-11 rounded-lg border border-rose-300/40 px-4"
        onClick={()=>setReload(n=>n+1)}>Retry secure deletion check</button>
    </div>}
    <p className="text-sm text-slate-300">Outside the app: <a href="https://interplanetaryfund.com/delete-account"
      className="text-emerald-200 underline">IFund account deletion page</a>.</p>
    <Link to="/account" className="inline-flex min-h-11 items-center text-emerald-200 underline">Back to account</Link>
  </section>;
}
