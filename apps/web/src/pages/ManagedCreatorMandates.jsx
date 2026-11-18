import { useEffect, useMemo, useState } from "react";
import { adminCreatorMandateRequest } from "@/api/managedCreatorMandates";
import { authClient } from "@/api/auth";
import { requestCampaignDraft } from "@/api/campaignDraft";
import { Clipboard, RefreshCw, ShieldCheck, UserRoundCheck, FileText, Ban } from "lucide-react";

const emptyInvite = { creator_name: "", creator_email: "", fundraiser_url: "", fundraiser_label: "", beneficiary_name: "", expires_in_days: 30 };
const emptyDraft = { title: "", summary: "", story: "" };

export default function ManagedCreatorMandates() {
  const [mandates, setMandates] = useState([]);
  const [invite, setInvite] = useState(emptyInvite);
  const [draft, setDraft] = useState(emptyDraft);
  const [creatorFacts, setCreatorFacts] = useState("");
  const [generating, setGenerating] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [consentUrl, setConsentUrl] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selected = useMemo(() => mandates.find((item) => item.id === selectedId) || null, [mandates, selectedId]);
  async function refresh() {
    setBusy(true); setError("");
    try {
      const result = await adminCreatorMandateRequest("list");
      setMandates(result.mandates || []);
      if (selectedId && !(result.mandates || []).some((item) => item.id === selectedId)) setSelectedId("");
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function createInvitation(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice(""); setConsentUrl("");
    try {
      const result = await adminCreatorMandateRequest("create", invite);
      setConsentUrl(result.consent_url);
      setNotice("Invitation created. Deliver this one-time link only to the creator's listed email address.");
      setInvite(emptyInvite);
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function verifyIdentity() {
    if (!selected) return;
    setBusy(true); setError(""); setNotice(""); setReviewUrl("");
    try {
      const result = await adminCreatorMandateRequest("verify_identity", { mandate_id: selected.id, identity_evidence_note: evidence });
      setReviewUrl(result.review_token ? "Identity verified. A new review link will be generated when the draft is ready." : "");
      setEvidence(""); setNotice("Identity verification recorded. The mandate is now active for campaign-specific AI work within its approved scope.");
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function generateWithAI() {
    if (!selected) return;
    if (creatorFacts.trim().length < 12) { setError("Add the creator's verified facts and instructions before asking AI to draft."); return; }
    setGenerating(true); setError(""); setNotice("");
    try {
      const suggestion = await requestCampaignDraft(authClient(), {
        details: creatorFacts,
        beneficiary: selected.beneficiary_name,
        need: selected.fundraiser_label,
        cause: "community fundraising",
      });
      setDraft({ title: suggestion.titles[0], summary: suggestion.summaries[0], story: suggestion.story });
      setNotice("AI prepared a private draft from the facts supplied. Review and edit it before saving for creator approval.");
    } catch (e) { setError(e.message); }
    finally { setGenerating(false); }
  }
  async function saveDraft(event) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(""); setNotice(""); setReviewUrl("");
    try {
      const result = await adminCreatorMandateRequest("save_draft", {
        mandate_id: selected.id,
        draft: { ...draft, beneficiary: selected.beneficiary_name, source_fundraiser_url: selected.fundraiser_url, managed_by_ifund: true },
      });
      setReviewUrl(result.review_url);
      setNotice("Draft saved privately. The creator must review and approve the final content before publication.");
      setDraft(emptyDraft); await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function revoke() {
    if (!selected || !window.confirm("Revoke this creator mandate and invalidate its outstanding links?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await adminCreatorMandateRequest("revoke", { mandate_id: selected.id, reason: "Revoked by the assigned IFund administrator." });
      setNotice("Mandate revoked. Future managed actions must stop."); setSelectedId(""); await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function copy(value) {
    try { await navigator.clipboard.writeText(value); setNotice("Link copied."); }
    catch { setError("Copy was blocked by this browser. Select and copy the link manually."); }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[.16em] text-emerald-600 dark:text-emerald-300">IFund administration</p>
        <h1 className="text-3xl font-bold tracking-tight">Managed fundraisers</h1>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">Invite an external fundraiser creator, record their explicit full-control AI mandate, verify their authority, and return drafts for secure creator review. This does not create an IFund login or permit publication by itself.</p>
      </header>
      {error && <p role="alert" className="rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-sm">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">{notice}</p>}
      {consentUrl && <section className="space-y-2 rounded-2xl border border-border bg-card p-4"><h2 className="font-semibold">Creator authorization link</h2><p className="break-all text-sm">{consentUrl}</p><button onClick={() => copy(consentUrl)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Clipboard size={16}/>Copy link</button><p className="text-xs text-muted-foreground">Send only to the invited creator's listed email address. Link possession alone is not identity verification.</p></section>}
      {reviewUrl && <section className="space-y-2 rounded-2xl border border-border bg-card p-4"><h2 className="font-semibold">Creator review link</h2><p className="break-all text-sm">{reviewUrl}</p><button onClick={() => copy(reviewUrl)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"><Clipboard size={16}/>Copy review link</button></section>}

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-4 text-xl font-semibold">Invite a fundraiser creator</h2>
        <form onSubmit={createInvitation} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">Creator's name<input required minLength={2} maxLength={120} value={invite.creator_name} onChange={e=>setInvite({...invite,creator_name:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2"/></label>
          <label className="grid gap-1 text-sm">Creator's email<input required type="email" value={invite.creator_email} onChange={e=>setInvite({...invite,creator_email:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2"/></label>
          <label className="grid gap-1 text-sm sm:col-span-2">Original fundraiser URL<input required type="url" placeholder="https://" value={invite.fundraiser_url} onChange={e=>setInvite({...invite,fundraiser_url:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2"/></label>
          <label className="grid gap-1 text-sm">Fundraiser name<input required minLength={3} value={invite.fundraiser_label} onChange={e=>setInvite({...invite,fundraiser_label:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2"/></label>
          <label className="grid gap-1 text-sm">Named beneficiary<input required minLength={2} value={invite.beneficiary_name} onChange={e=>setInvite({...invite,beneficiary_name:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2"/></label>
          <label className="grid gap-1 text-sm">Authorization term (days)<input required type="number" min="1" max="90" value={invite.expires_in_days} onChange={e=>setInvite({...invite,expires_in_days:Number(e.target.value)})} className="rounded-lg border border-border bg-background px-3 py-2"/></label>
          <div className="flex items-end"><button disabled={busy} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Working…" : "Create secure invitation"}</button></div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Mandate records</h2><button disabled={busy} onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><RefreshCw size={15}/>Refresh</button></div>
        {mandates.length === 0 ? <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">No creator mandates have been created by this admin account.</p> : <div className="grid gap-3 md:grid-cols-2">{mandates.map((item)=><button key={item.id} onClick={()=>setSelectedId(item.id)} className={`rounded-xl border p-4 text-left ${selectedId===item.id?"border-primary bg-primary/5":"border-border bg-card"}`}><div className="flex items-start justify-between gap-2"><strong>{item.fundraiser_label}</strong><span className="rounded-full border border-border px-2 py-1 text-xs">{item.status.replaceAll("_"," ")}</span></div><p className="mt-2 text-sm text-muted-foreground">{item.creator_name} · {item.creator_email}</p><p className="mt-1 text-xs text-muted-foreground">Expires {new Date(item.expires_at).toLocaleDateString()}</p><p className="mt-2 text-xs">Creator review: {item.creator_review_state.replaceAll("_"," ")}</p></button>)}</div>}
      </section>

      {selected && <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected mandate</p><h2 className="text-xl font-semibold">{selected.fundraiser_label}</h2><p className="text-sm text-muted-foreground">{selected.creator_name} · {selected.creator_email}</p><a className="text-sm underline" href={selected.fundraiser_url} target="_blank" rel="noreferrer">Open original fundraiser</a></div>
        <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-border px-2 py-1">AI all-features delegation: {selected.status==="active"?"granted":"pending"}</span><span className="rounded-full border border-border px-2 py-1">Identity: {selected.identity_verified_at?"verified":"not verified"}</span><span className="rounded-full border border-border px-2 py-1">Creator approval: {selected.creator_review_state}</span></div>
        {selected.status==="consented_pending_verification" && <div className="space-y-2 border-t border-border pt-4"><h3 className="flex items-center gap-2 font-semibold"><UserRoundCheck size={17}/>Verify creator identity and authority</h3><p className="text-sm text-muted-foreground">Record the real verification evidence you checked (for example, authenticated control of the source fundraiser and matching beneficiary authority). Do not treat the invitation link or a public profile alone as proof.</p><textarea value={evidence} onChange={e=>setEvidence(e.target.value)} minLength={30} maxLength={2000} rows={3} placeholder="Describe the identity and authority checks completed…" className="w-full rounded-lg border border-border bg-background p-3 text-sm"/><button disabled={busy||evidence.trim().length<30} onClick={verifyIdentity} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><ShieldCheck size={16}/>Record verified identity</button></div>}
        {selected.status==="active" && <form onSubmit={saveDraft} className="space-y-3 border-t border-border pt-4"><h3 className="flex items-center gap-2 font-semibold"><FileText size={17}/>Prepare a private draft for creator review</h3><label className="grid gap-1 text-sm">Creator-supplied facts and instructions<textarea required minLength={12} rows={4} value={creatorFacts} onChange={e=>setCreatorFacts(e.target.value)} placeholder="Use only facts and details the creator supplied or that have been verified…" className="w-full rounded-lg border border-border bg-background p-3"/></label><button type="button" disabled={busy||generating||creatorFacts.trim().length<12} onClick={generateWithAI} className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">{generating?"Generating…":"Generate with IFund AI"}</button><label className="grid gap-1 text-sm">Campaign title<input required value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2"/></label><label className="grid gap-1 text-sm">Short description<textarea required rows={2} value={draft.summary} onChange={e=>setDraft({...draft,summary:e.target.value})} className="rounded-lg border border-border bg-background p-3"/></label><label className="grid gap-1 text-sm">Campaign story<textarea required rows={8} value={draft.story} onChange={e=>setDraft({...draft,story:e.target.value})} className="rounded-lg border border-border bg-background p-3"/></label><button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save draft and create review link</button><p className="text-xs text-muted-foreground">This stores a private review draft only. It does not create or publish a public campaign.</p></form>}
        {selected.status!=="revoked" && selected.status!=="declined" && <div className="border-t border-border pt-4"><button disabled={busy} onClick={revoke} className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-600 disabled:opacity-50"><Ban size={15}/>Revoke mandate</button></div>}
      </section>}
      <p className="text-xs leading-5 text-muted-foreground">Production safety: the assigned admin account is the management principal. This workflow does not create a creator account, alter campaign owner_id, bypass RLS, connect external accounts, move money, or publish. High-impact permissions remain individually recorded; final creator approval is required before any publication workflow may be enabled.</p>
    </main>
  );
}
