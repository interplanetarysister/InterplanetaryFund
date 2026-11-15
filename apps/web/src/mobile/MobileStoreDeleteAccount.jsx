import { useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";

export default function MobileStoreDeleteAccount() {
  const {user,status}=useAuthSession();
  const [confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);
  const [reference,setReference]=useState(""),[error,setError]=useState("");
  async function requestDeletion(event) {
    event.preventDefault();
    if(!confirmed||busy)return;
    setBusy(true);setError("");
    try{
      const client=authClient();
      const {data,error:issue}=await client.auth.getUser();
      if(issue||!data?.user?.id||data.user.id!==user?.id)throw new Error("Verify your signed-in account before requesting deletion.");
      const {data:result,error:rpcError}=await client.rpc("ifund_create_support_ticket",{
        p_subject:"Permanent account and associated data deletion",
        p_message:"I request permanent deletion of my Interplanetary Fund account and associated personal and user-generated data. Please verify ownership, explain any legally required financial or fraud-prevention record retention, cancel applicable IFund billing where authorized, and confirm the completed deletion. My account ID is "+data.user.id+".",
      });
      if(rpcError||!Array.isArray(result)||!result[0]?.ticket_id)
        throw new Error(rpcError?.message||"Your request could not be recorded.");
      setReference(result[0].ticket_id);
    }catch(cause){setError(cause.message||"Your request could not be recorded. Try again or use the public deletion page.");}
    finally{setBusy(false);}
  }
  return <div className="space-y-5">
    <header className="space-y-2"><h1 className="text-3xl font-bold">Delete your IFund account</h1>
      <p className="text-sm leading-6 text-slate-300">This requests deletion of the entire account and associated personal data, not just a temporary deactivation.</p></header>
    <section className="space-y-3 rounded-xl border border-white/20 p-5 text-sm leading-6 text-slate-300">
      <h2 className="text-base font-bold text-white">What happens next</h2>
      <p>IFund must verify ownership, examine any unresolved campaigns or withdrawals, and delete associated personal information and published content unless a legal obligation requires limited retention. Certain transaction, tax, fraud or dispute records may need to be retained. Any active external subscriptions must be addressed separately.</p>
      <p>A verified request is sent to the existing IFund administrative queue; it is not an immediate deletion. You will receive a reference you can use when following up. Never submit passwords or card details.</p>
      <p>The <Link to="/privacy" className="text-emerald-200 underline">privacy policy</Link> explains your rights and how IFund handles personal data.</p>
    </section>
    {status==="loading"&&<p role="status">Checking account identity…</p>}
    {status!=="loading"&&!user&&<section className="space-y-4 rounded-xl border border-white/20 p-5">
      <p className="text-sm text-slate-300">For a tracked request, sign in. If you've removed the app or cannot sign in, you can request deletion outside the app using the contact below.</p>
      <Link to="/login?returnTo=%2Fdelete-account" className="inline-flex min-h-11 items-center rounded-lg bg-emerald-200 px-4 text-sm font-bold text-slate-950">Sign in to request deletion</Link>
      <a href="mailto:hello@interplanetaryfund.com?subject=Interplanetary%20Fund%20account%20deletion%20request" className="block break-words text-sm text-emerald-200 underline">Request deletion by email</a>
    </section>}
    {user&&!reference&&<form onSubmit={requestDeletion} className="space-y-4 rounded-xl border border-rose-300/30 bg-white/5 p-5">
      <p className="break-words text-sm">Account: <strong>{user.email||"Verified member"}</strong></p>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
        <input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1 h-5 w-5 accent-rose-300"/>
        <span>I want to permanently delete my IFund account and eligible associated personal data. I understand legally required records may be retained and this request requires verification.</span>
      </label>
      <button type="submit" disabled={!confirmed||busy} className="min-h-12 rounded-xl bg-rose-200 px-5 text-sm font-bold text-rose-950 disabled:opacity-50">{busy?"Recording deletion request…":"Request permanent account deletion"}</button>
    </form>}
    {error&&<p role="alert" className="rounded-xl border border-rose-300/40 p-4 text-sm text-rose-200">{error}</p>}
    {reference&&<section className="space-y-2 rounded-xl border border-emerald-300/40 bg-emerald-950/40 p-5" role="status">
      <h2 className="text-lg font-bold">Deletion request recorded</h2><p className="text-sm">Reference: <code className="break-all">{reference}</code></p>
      <p className="text-sm text-slate-200">Your account has not yet been deleted. IFund must verify and complete the request, then confirm the outcome.</p>
    </section>}
    <p className="text-sm text-slate-300">You can also use the public <a href="https://interplanetaryfund.com/delete-account" className="text-emerald-200 underline">account deletion resource</a> without installing this app.</p>
    <Link to="/account" className="inline-flex min-h-11 items-center text-emerald-200 underline">Back to account</Link>
  </div>;
}
