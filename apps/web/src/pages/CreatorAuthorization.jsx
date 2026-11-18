import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { publicCreatorMandateRequest } from "@/api/managedCreatorMandates";

const scopeLabels = [
  ["publish","Publish the final IFund campaign after I approve its exact content"],
  ["external_outreach","Post or promote the fundraiser through approved external channels"],
  ["donor_messaging","Contact donors or supporters about this fundraiser"],
  ["account_connections","Connect or use external platform accounts for this fundraiser"],
  ["financial_actions","Perform financial or payout-related actions"],
  ["payout_changes","Change the payout destination"],
];

export default function CreatorAuthorization() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [mandate,setMandate] = useState(null);
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [fullControl,setFullControl] = useState(false);
  const [allAi,setAllAi] = useState(false);
  const [authority,setAuthority] = useState(false);
  const [accepted,setAccepted] = useState(false);
  const [scopes,setScopes] = useState({});
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [result,setResult] = useState("");

  useEffect(()=>{let alive=true;(async()=>{try{const r=await publicCreatorMandateRequest("consent",token);if(alive){setMandate(r.mandate);setName(r.mandate.creatorName||"");}}catch(e){if(alive)setError(e.message)}})();return()=>{alive=false}},[token]);

  async function submit(e) {
    e.preventDefault();setBusy(true);setError("");setResult("");
    try {
      const r=await publicCreatorMandateRequest("accept",token,{
        creator_name:name,creator_email:email,full_control_acknowledged:fullControl,
        ai_all_features_acknowledged:allAi,creator_authority_confirmed:authority,
        accepted_terms:accepted,scopes,
      });
      setResult(r.message || "Authorization recorded. IFund will complete identity verification before managed work begins.");
    } catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function decline() {
    if(!window.confirm("Decline this IFund managed-fundraiser invitation?"))return;
    setBusy(true);setError("");
    try { await publicCreatorMandateRequest("decline",token,{decline:true});setResult("Invitation declined. No campaign work or account creation will occur."); }
    catch(e){setError(e.message)}
    finally{setBusy(false)}
  }

  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-10">
    <header className="space-y-2"><p className="text-sm font-semibold uppercase tracking-[.16em] text-emerald-600">Interplanetary Fund</p><h1 className="text-3xl font-bold">Fundraiser management authorization</h1><p className="text-sm text-muted-foreground">Review the exact fundraiser, assigned IFund admin account, AI delegation and separate high-impact permissions before deciding.</p></header>
    {error&&<p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm">{error}</p>}
    {result&&<p role="status" className="rounded-xl border border-emerald-500/40 p-4 text-sm">{result}</p>}
    {mandate&& !result&&<>
      <section className="space-y-2 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Fundraiser covered by this authorization</h2>
        <p><strong>Creator:</strong> {mandate.creatorName}</p><p><strong>Fundraiser:</strong> {mandate.fundraiserLabel}</p><p><strong>Beneficiary:</strong> {mandate.beneficiaryName}</p><p><strong>Source:</strong> <a className="break-all underline" href={mandate.fundraiserUrl} target="_blank" rel="noreferrer">{mandate.fundraiserUrl}</a></p>
        <p><strong>Assigned IFund admin account ID:</strong> <span className="break-all">{mandate.assignedAdminId}</span></p>
        <p><strong>Authorization expires:</strong> {new Date(mandate.expiresAt).toLocaleString()}</p>
      </section>
      <section className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5">
        <h2 className="text-lg font-semibold">Full operational control and AI delegation</h2>
        <p className="text-sm leading-6">By accepting, you authorize the named IFund admin account above to receive <strong>full operational control</strong> of this specific fundraiser for the mandate term. You also grant <strong>every AI feature and AI agent available to that assigned admin account broad, unrestricted permission</strong> to access and use the information supplied for this fundraiser and perform all available campaign-related AI work on your behalf, including research, planning, writing, editing, design, media generation, optimization, scheduling, coordination, analytics and management.</p>
        <p className="text-sm leading-6">This delegation applies only to this fundraiser. It does not grant access to unrelated personal data, unrelated campaigns, passwords, credentials or other accounts, and it cannot override provider/API capabilities, platform rules, applicable law, security controls or safety restrictions. IFund will not create an IFund login for you or impersonate you.</p>
      </section>
      <section className="space-y-2 rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">Separate high-impact permissions</h2><p className="text-sm text-muted-foreground">These are optional and off unless you actively select them. Full AI assistance does not automatically grant any of these permissions.</p>{scopeLabels.map(([key,label])=><label key={key} className="flex items-start gap-3 py-2 text-sm"><input type="checkbox" checked={scopes[key]===true} onChange={e=>setScopes({...scopes,[key]:e.target.checked})} className="mt-1"/><span>{label}</span></label>)}</section>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Your explicit decision</h2>
        <label className="grid gap-1 text-sm">Your full name<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2"/></label>
        <label className="grid gap-1 text-sm">Confirm the invited email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Use the email address that received this link" className="rounded-lg border border-border bg-background px-3 py-2"/></label>
        <label className="flex items-start gap-3 text-sm"><input required type="checkbox" checked={fullControl} onChange={e=>setFullControl(e.target.checked)} className="mt-1"/><span>I expressly authorize the assigned IFund admin account to have full operational control of this identified fundraiser for the stated mandate term.</span></label>
        <label className="flex items-start gap-3 text-sm"><input required type="checkbox" checked={allAi} onChange={e=>setAllAi(e.target.checked)} className="mt-1"/><span>I expressly grant every AI feature and AI agent available to that assigned admin account broad, unrestricted permission to perform all available campaign-related AI work on my behalf, limited to this fundraiser and subject to the stated legal, provider, security and safety boundaries.</span></label>
        <label className="flex items-start gap-3 text-sm"><input required type="checkbox" checked={authority} onChange={e=>setAuthority(e.target.checked)} className="mt-1"/><span>I confirm that I am the creator of this fundraiser or have legal authority to grant this mandate for the creator and beneficiary.</span></label>
        <label className="flex items-start gap-3 text-sm"><input required type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1"/><span>I have read and accept the complete authorization terms above, including the separate permissions, expiry and revocation process.</span></label>
        <p className="text-xs leading-5 text-muted-foreground">Submitting records your consent but does not instantly activate managed work. IFund must independently verify your identity and authority. Your fundraiser will not be published and donations will not be solicited until you approve the final draft and the required beneficiary, payout and platform checks are complete.</p>
        <div className="flex flex-wrap gap-3"><button disabled={busy||!fullControl||!allAi||!authority||!accepted} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy?"Submitting…":"Accept managed authorization"}</button><button type="button" disabled={busy} onClick={decline} className="rounded-lg border border-border px-4 py-2.5 text-sm">Decline invitation</button></div>
      </form>
    </>}
  </main>;
}
