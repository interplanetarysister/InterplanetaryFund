import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { publicCreatorMandateRequest } from "@/api/managedCreatorMandates";

export default function CreatorReview() {
  const [params]=useSearchParams();
  const token=params.get("token")||"";
  const [mandate,setMandate]=useState(null);
  const [feedback,setFeedback]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [result,setResult]=useState("");
  useEffect(()=>{let alive=true;(async()=>{try{const r=await publicCreatorMandateRequest("review",token);if(alive)setMandate(r.mandate)}catch(e){if(alive)setError(e.message)}})();return()=>{alive=false}},[token]);
  async function decide(decision){
    if(decision==="revoked"&&!window.confirm("Revoke IFund's authority to manage this fundraiser?"))return;
    if(decision==="changes_requested"&&feedback.trim().length<10){setError("Describe the changes you need (at least 10 characters).");return}
    setBusy(true);setError("");setResult("");
    try{await publicCreatorMandateRequest("review",token,{decision,feedback});setResult(decision==="approved"?"Your approval is recorded. Publishing still requires separate authorization and IFund's required checks.":decision==="revoked"?"Your mandate has been revoked. IFund must stop future managed actions.":"Your requested changes have been recorded.");}
    catch(e){setError(e.message)}
    finally{setBusy(false)}
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
    <header className="space-y-2"><p className="text-sm font-semibold uppercase tracking-[.16em] text-emerald-600">Interplanetary Fund</p><h1 className="text-3xl font-bold">Review your fundraiser draft</h1><p className="text-sm text-muted-foreground">This private link is for the creator named in the mandate. Do not forward it.</p></header>
    {error&&<p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm">{error}</p>}
    {result&&<p role="status" className="rounded-xl border border-emerald-500/40 p-4 text-sm">{result}</p>}
    {mandate&&!result&&<section className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div><p className="text-sm text-muted-foreground">Creator</p><p className="font-semibold">{mandate.creator_name}</p><p className="mt-2 text-sm text-muted-foreground">Fundraiser</p><p className="font-semibold">{mandate.fundraiser_label}</p><p className="mt-2 text-sm text-muted-foreground">Beneficiary</p><p className="font-semibold">{mandate.beneficiary_name}</p><a href={mandate.fundraiser_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm underline">View original fundraiser</a></div>
      <div className="space-y-3 border-t border-border pt-4"><h2 className="text-xl font-semibold">{mandate.draft_payload.title}</h2><p className="text-sm text-muted-foreground">Category: {mandate.draft_payload.category} · Fundraising goal: {Number(mandate.draft_payload.goal_amount).toLocaleString("en-US")} USD</p>{mandate.draft_payload.summary&&<p className="text-sm leading-6">{mandate.draft_payload.summary}</p>}<article className="whitespace-pre-wrap text-sm leading-7">{mandate.draft_payload.story}</article><p className="text-xs text-muted-foreground">Prepared by IFund under your managed-service authorization. This is a draft and is not public.</p></div>
      <div className="space-y-2 border-t border-border pt-4"><h3 className="font-semibold">Request edits</h3><textarea value={feedback} onChange={e=>setFeedback(e.target.value)} rows={4} maxLength={4000} placeholder="Tell IFund what should change…" className="w-full rounded-lg border border-border bg-background p-3 text-sm"/><button disabled={busy||feedback.trim().length<10} onClick={()=>decide("changes_requested")} className="rounded-lg border border-border px-4 py-2 text-sm disabled:opacity-50">Request changes</button></div>
      <div className="flex flex-wrap gap-3 border-t border-border pt-4"><button disabled={busy} onClick={()=>decide("approved")} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Approve this final draft</button><button disabled={busy} onClick={()=>decide("revoked")} className="rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-600 disabled:opacity-50">Revoke IFund authorization</button></div>
      <p className="text-xs leading-5 text-muted-foreground">Your approval applies only to this exact draft. It does not grant publishing, external outreach, donor messaging, account connection, financial or payout permissions unless those were separately selected in your authorization and all required checks have passed.</p>
    </section>}
  </main>;
}
