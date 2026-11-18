import { useEffect, useMemo, useState } from "react";
import { adminCreatorMandateRequest } from "@/api/managedCreatorMandates";
import { authClient } from "@/api/auth";
import { requestCampaignDraft } from "@/api/campaignDraft";
import { saveOwnerCampaign } from "@/api/ownerCampaigns";
import { Clipboard, RefreshCw, ShieldCheck, UserRoundCheck, FileText, Ban } from "lucide-react";

const emptyInvite = { creator_name: "", creator_email: "", fundraiser_url: "", fundraiser_label: "", beneficiary_name: "", expires_in_days: 30 };
const emptyDraft = { title: "", summary: "", story: "", category: "community", goal_amount: "" };

export default function ManagedCreatorMandates() {
  const [mandates, setMandates] = useState([]);
  const [invite, setInvite] = useState(emptyInvite);
  const [draft, setDraft] = useState(emptyDraft);
  const [titleOptions, setTitleOptions] = useState([]);
  const [summaryOptions, setSummaryOptions] = useState([]);
  const [regeneratingField, setRegeneratingField] = useState("");
  const [creatorFacts, setCreatorFacts] = useState("");
  const [evidence, setEvidence] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [consentUrl, setConsentUrl] = useState("");
  const [reviewUrl, setReviewUrl] = useState("");
  const [pendingCampaignId, setPendingCampaignId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [destinationForm, setDestinationForm] = useState({ provider_label: "", donation_url: "", destination_owner_name: "", destination_owner_relationship: "" });
  const [destinations, setDestinations] = useState([]);
  const [destinationEvidence, setDestinationEvidence] = useState("");
  const [destinationApprovalUrl, setDestinationApprovalUrl] = useState("");

  const selected = useMemo(() => mandates.find((item) => item.id === selectedId) || null, [mandates, selectedId]);
  useEffect(() => { setPendingCampaignId(""); setTitleOptions([]); setSummaryOptions([]); setDraft(emptyDraft); setCreatorFacts(""); setDestinations([]); setDestinationEvidence(""); setDestinationApprovalUrl(""); }, [selectedId]);
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
      setEvidence(""); setNotice("Identity verification recorded. Private Story AI drafting is available for this mandate while it remains active. Story, Strategy, Growth and Communications AI endpoints now enforce the linked mandate. This page launches Story drafting; Connections actions are available only when the creator separately enabled account_connections. External delivery, publishing, donor-message sending, and financial actions remain disabled.");
      await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function generateWithAI(field = "all") {
    if (!selected) return;
    if (creatorFacts.trim().length < 12) { setError("Add the creator's verified facts and instructions before asking AI to draft."); return; }
    setRegeneratingField(field); setError(""); setNotice("");
    try {
      const task = field === "all"
        ? ""
        : field === "title"
          ? "\n\nRegenerate five distinct campaign title options only. Keep the factual details unchanged."
          : field === "summary"
            ? "\n\nRegenerate two concise campaign description options only. Keep the factual details unchanged."
            : "\n\nRegenerate the campaign story only. Keep all factual details unchanged and do not invent information.";
      const suggestion = await requestCampaignDraft(authClient(), {
        details: creatorFacts + task,
        beneficiary: selected.beneficiary_name,
        need: selected.fundraiser_label,
        cause: "community fundraising",
        managed_mandate_id: selected.id,
      });
      if (field === "all" || field === "title") {
        const options = Array.isArray(suggestion.titles) ? suggestion.titles.filter(value => typeof value === "string" && value.trim()).slice(0, 5) : [];
        setTitleOptions(options);
        if (options.length) setDraft(current => ({ ...current, title: options[0] }));
      }
      if (field === "all" || field === "summary") {
        const options = Array.isArray(suggestion.summaries) ? suggestion.summaries.filter(value => typeof value === "string" && value.trim()).slice(0, 2) : [];
        setSummaryOptions(options);
        if (options.length) setDraft(current => ({ ...current, summary: options[0] }));
      }
      if (field === "all" || field === "story") {
        if (typeof suggestion.story === "string" && suggestion.story.trim())
          setDraft(current => ({ ...current, story: suggestion.story }));
      }
      setNotice(field === "all"
        ? "AI prepared up to five title choices, two descriptions and a private story draft. Select or edit each before saving."
        : "New " + field + " suggestions are ready. Select or edit the result before saving.");
    } catch (e) { setError(e.message); }
    finally { setRegeneratingField(""); }
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
  async function createManagedCampaign() {
    if (!selected || selected.status !== "active" || selected.creator_review_state !== "approved") return;
    setBusy(true); setError(""); setNotice("");
    try {
      if (selected.campaign_id) {
        const synced = await adminCreatorMandateRequest("sync_campaign", { mandate_id: selected.id });
        if (!synced?.synced || synced.campaign_id !== selected.campaign_id)
          throw new Error("The creator-approved revision could not be confirmed.");
        setNotice("The creator-approved revision has been applied to the canonical IFund campaign draft. It remains unpublished until beneficiary payout and separate publication checks are completed.");
        await refresh();
        return;
      }
      let campaignId = pendingCampaignId;
      if (!campaignId) {
        const created = await saveOwnerCampaign(authClient(), {
          title: selected.draft_payload.title,
          summary: selected.draft_payload.summary,
          story: selected.draft_payload.story,
          category: selected.draft_payload.category,
          goal_amount: String(selected.draft_payload.goal_amount),
          cover_image_url: "",
          map_opt_in: false,
          public_location_label: "",
          map_latitude: "",
          map_longitude: "",
        }, { status: "draft" });
        campaignId = created.id;
        setPendingCampaignId(campaignId);
      }
      await adminCreatorMandateRequest("link_campaign", {
        mandate_id: selected.id,
        campaign_id: campaignId,
      });
      setPendingCampaignId("");
      setNotice("The creator-approved draft is now linked to a canonical IFund campaign owned by the assigned admin account. It remains unpublished; beneficiary payout and separate publication checks are still required.");
      await refresh();
    } catch (e) {
      setError(pendingCampaignId
        ? e.message + " The IFund draft was created but its mandate link is still pending; retry the link."
        : e.message);
    } finally { setBusy(false); }
  }

  async function loadDestinations() {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const result = await adminCreatorMandateRequest("list_external_destinations", { mandate_id: selected.id });
      setDestinations(result.destinations || []);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function createExternalDestination(event) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError(""); setDestinationApprovalUrl(""); setNotice("");
    try {
      const result = await adminCreatorMandateRequest("create_external_destination", { mandate_id: selected.id, ...destinationForm });
      setDestinationApprovalUrl(result.creator_approval_url);
      setDestinationForm({ provider_label: "", donation_url: "", destination_owner_name: "", destination_owner_relationship: "" });
      setNotice("Destination submitted for creator approval. It cannot be used until provider ownership and compliance are separately verified.");
      await loadDestinations();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function verifyExternalDestination(destination, compliance = false) {
    setBusy(true); setError(""); setNotice("");
    try {
      const action = compliance ? "check_external_destination_compliance" : "verify_external_destination";
      const body = compliance
        ? { destination_id: destination.id, compliance_evidence: destinationEvidence }
        : { destination_id: destination.id, provider_verification_evidence: destinationEvidence };
      const result = await adminCreatorMandateRequest(action, body);
      setNotice(compliance
        ? "Compliance review recorded. The destination is marked ready for a future reviewed publication gate; publication is still disabled."
        : "Provider ownership verification recorded. Complete the separate compliance review next.");
      setDestinationEvidence("");
      await loadDestinations();
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
        <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-border px-2 py-1">AI permission consent: {selected.status==="active"?"recorded":"pending"}</span><span className="rounded-full border border-border px-2 py-1">Identity: {selected.identity_verified_at?"verified":"not verified"}</span><span className="rounded-full border border-border px-2 py-1">Creator approval: {selected.creator_review_state}</span></div>
        {selected.creator_feedback && <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm"><strong>Creator feedback:</strong><p className="mt-1 whitespace-pre-wrap">{selected.creator_feedback}</p></div>}
        {selected.draft_payload && <div className="rounded-xl border border-border p-3 text-sm"><p><strong>Saved private draft:</strong> {selected.draft_payload.title}</p><p className="mt-1 text-xs text-muted-foreground">Category: {selected.draft_payload.category} · Goal: ${Number(selected.draft_payload.goal_amount).toLocaleString("en-US")} USD</p><button type="button" onClick={()=>setDraft({title:selected.draft_payload.title||"",summary:selected.draft_payload.summary||"",story:selected.draft_payload.story||"",category:selected.draft_payload.category||"community",goal_amount:String(selected.draft_payload.goal_amount||"")})} className="mt-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold">Load saved draft for revision</button></div>}
        {selected.campaign_id && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">Canonical IFund campaign draft linked: <span className="break-all font-mono">{selected.campaign_id}</span>. Publishing remains blocked until the beneficiary payout and separate creator publication checks are implemented.</p>}
        <section className="space-y-3 border-t border-border pt-4">
          <div><h3 className="font-semibold">Direct-to-provider donation destination</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Available only after the creator has explicitly granted the separate publish scope, approved the final campaign draft, and a canonical campaign is linked. Donations remain on the external provider; IFund does not collect them.</p></div>
          {selected.status === "active" && selected.creator_review_state === "approved" && selected.campaign_id && selected.scopes?.publish === true ? <form onSubmit={createExternalDestination} className="grid gap-2 sm:grid-cols-2">
            <input required minLength={2} maxLength={100} placeholder="Provider name (e.g. PayPal)" value={destinationForm.provider_label} onChange={e=>setDestinationForm({...destinationForm,provider_label:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
            <input required type="url" placeholder="Exact HTTPS donation URL" value={destinationForm.donation_url} onChange={e=>setDestinationForm({...destinationForm,donation_url:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2 text-sm sm:col-span-2"/>
            <input required minLength={2} maxLength={180} placeholder="Destination account owner" value={destinationForm.destination_owner_name} onChange={e=>setDestinationForm({...destinationForm,destination_owner_name:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
            <input required minLength={2} maxLength={500} placeholder="Owner's relationship to beneficiary" value={destinationForm.destination_owner_relationship} onChange={e=>setDestinationForm({...destinationForm,destination_owner_relationship:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2 text-sm"/>
            <button disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2">Request creator approval of exact destination</button>
          </form> : <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">Unavailable until the creator separately authorizes publishing, approves the draft, and the canonical campaign is linked.</p>}
          {destinationApprovalUrl && <div className="rounded-lg border border-border p-3 text-sm"><p className="font-semibold">One-time creator approval link</p><p className="mt-1 break-all">{destinationApprovalUrl}</p><button type="button" onClick={()=>copy(destinationApprovalUrl)} className="mt-2 rounded-lg border border-border px-3 py-2 text-xs">Copy creator approval link</button></div>}
          <button type="button" disabled={busy} onClick={loadDestinations} className="rounded-lg border border-border px-3 py-2 text-sm">Refresh destination checks</button>
          {destinations.map(destination=><div key={destination.id} className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2"><strong>{destination.provider_label}</strong><span className="rounded-full border border-border px-2 py-1 text-xs">{destination.status.replaceAll("_"," ")}</span></div>
            <a href={destination.donation_url} target="_blank" rel="noreferrer" className="break-all text-xs underline">{destination.donation_url}</a>
            <p className="text-xs text-muted-foreground">Creator approved: {destination.creator_approved_at ? "yes" : "no"} · Provider verified: {destination.provider_owner_verified_at ? "yes" : "no"} · Compliance checked: {destination.compliance_checked_at ? "yes" : "no"}</p>
            {["pending_provider_verification","pending_compliance"].includes(destination.status) && <textarea value={destinationEvidence} onChange={e=>setDestinationEvidence(e.target.value)} minLength={30} maxLength={2000} rows={3} placeholder={destination.status==="pending_provider_verification"?"Record how you independently verified control of the provider account (30+ characters)…":"Record the compliance checks and evidence reviewed (30+ characters)…"} className="w-full rounded-lg border border-border bg-background p-2 text-xs"/>}
            {destination.status==="pending_provider_verification" && <button type="button" disabled={busy||destinationEvidence.trim().length<30} onClick={()=>verifyExternalDestination(destination,false)} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50">Record provider ownership verification</button>}
            {destination.status==="pending_compliance" && <button type="button" disabled={busy||destinationEvidence.trim().length<30} onClick={()=>verifyExternalDestination(destination,true)} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50">Complete separate compliance review</button>}
          </div>)}
          <p className="text-xs leading-5 text-muted-foreground">A ready destination is not a publication authorization. The public publication gate remains disabled until its independent implementation and review are complete.</p>
        </section>
        {selected.status==="active" && selected.creator_review_state==="approved" && <div className="border-t border-border pt-4"><button type="button" disabled={busy} onClick={createManagedCampaign} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">{selected.campaign_id?"Apply approved revision to IFund draft":pendingCampaignId?"Retry campaign link":"Create IFund campaign draft"}</button><p className="mt-2 text-xs text-muted-foreground">{selected.campaign_id?"Updates only title, summary, story, category and goal to match the latest creator-approved revision. Cover image and public location remain unchanged until those fields have their own creator-review workflow.":"Creates a canonical IFund draft under the assigned admin account and records the real creator/beneficiary separately."} It does not publish or enable donations.</p></div>}
        {selected.status==="consented_pending_verification" && <div className="space-y-2 border-t border-border pt-4"><h3 className="flex items-center gap-2 font-semibold"><UserRoundCheck size={17}/>Verify creator identity and authority</h3><p className="text-sm text-muted-foreground">Record the real verification evidence you checked (for example, authenticated control of the source fundraiser and matching beneficiary authority). Do not treat the invitation link or a public profile alone as proof.</p><textarea value={evidence} onChange={e=>setEvidence(e.target.value)} minLength={30} maxLength={2000} rows={3} placeholder="Describe the identity and authority checks completed…" className="w-full rounded-lg border border-border bg-background p-3 text-sm"/><button disabled={busy||evidence.trim().length<30} onClick={verifyIdentity} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><ShieldCheck size={16}/>Record verified identity</button></div>}
        {selected.status==="active" && <form onSubmit={saveDraft} className="space-y-3 border-t border-border pt-4"><h3 className="flex items-center gap-2 font-semibold"><FileText size={17}/>Prepare a private draft for creator review</h3><label className="grid gap-1 text-sm">Creator-supplied facts and instructions<textarea required minLength={12} rows={4} value={creatorFacts} maxLength={1200} onChange={e=>setCreatorFacts(e.target.value)} placeholder="Use only facts and details the creator supplied or that have been verified…" className="w-full rounded-lg border border-border bg-background p-3"/></label><button type="button" disabled={busy||!!regeneratingField||creatorFacts.trim().length<12} onClick={()=>generateWithAI("all")} className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary disabled:opacity-50">{regeneratingField==="all"?"Generating…":"Generate titles, descriptions and story"}</button><div className="space-y-2"><label className="grid gap-1 text-sm">Campaign title<input required maxLength={150} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2"/></label>{titleOptions.length>0 && <div className="space-y-1"><p className="text-xs font-medium text-muted-foreground">AI title choices (up to five)</p>{titleOptions.map((option,index)=><button key={index} type="button" aria-pressed={draft.title===option} onClick={()=>setDraft(current=>({...current,title:option}))} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${draft.title===option?"border-primary bg-primary/5":"border-border"}`}>{index+1}. {option}</button>)}</div>}<button type="button" disabled={busy||!!regeneratingField||creatorFacts.trim().length<12} onClick={()=>generateWithAI("title")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">{regeneratingField==="title"?"Regenerating titles…":"Regenerate five titles"}</button></div><div className="space-y-2"><label className="grid gap-1 text-sm">Short description<textarea required maxLength={600} rows={2} value={draft.summary} onChange={e=>setDraft({...draft,summary:e.target.value})} className="rounded-lg border border-border bg-background p-3"/></label>{summaryOptions.length>0 && <div className="space-y-1"><p className="text-xs font-medium text-muted-foreground">AI description choices (up to two)</p>{summaryOptions.map((option,index)=><button key={index} type="button" aria-pressed={draft.summary===option} onClick={()=>setDraft(current=>({...current,summary:option}))} className={`block w-full rounded-lg border px-3 py-2 text-left text-sm ${draft.summary===option?"border-primary bg-primary/5":"border-border"}`}>{index+1}. {option}</button>)}</div>}<button type="button" disabled={busy||!!regeneratingField||creatorFacts.trim().length<12} onClick={()=>generateWithAI("summary")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">{regeneratingField==="summary"?"Regenerating descriptions…":"Regenerate two descriptions"}</button></div><label className="grid gap-1 text-sm">Campaign category<select required value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2"><option value="medical">Medical</option><option value="emergency">Emergency</option><option value="education">Education</option><option value="community">Community</option><option value="animals">Animals</option><option value="business">Business</option><option value="memorial">Memorial</option><option value="disaster_relief">Disaster relief</option><option value="creative">Creative</option><option value="environment">Environment</option><option value="other">Other</option></select></label><label className="grid gap-1 text-sm">Fundraising goal (USD)<input required type="number" min="0.01" step="0.01" value={draft.goal_amount} onChange={e=>setDraft({...draft,goal_amount:e.target.value})} className="rounded-lg border border-border bg-background px-3 py-2"/></label><div className="space-y-2"><label className="grid gap-1 text-sm">Campaign story<textarea required maxLength={15000} rows={8} value={draft.story} onChange={e=>setDraft({...draft,story:e.target.value})} className="rounded-lg border border-border bg-background p-3"/></label><button type="button" disabled={busy||!!regeneratingField||creatorFacts.trim().length<12} onClick={()=>generateWithAI("story")} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50">{regeneratingField==="story"?"Regenerating story…":"Regenerate story"}</button></div><button disabled={busy||!!regeneratingField} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Save draft and create review link</button><p className="text-xs text-muted-foreground">This stores a private review draft for creator approval. After approval, IFund can create an unpublished canonical campaign draft under the assigned admin account; publication and donations remain disabled.</p></form>}
        {selected.status!=="revoked" && selected.status!=="declined" && <div className="border-t border-border pt-4"><button disabled={busy} onClick={revoke} className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 px-3 py-2 text-sm text-red-600 disabled:opacity-50"><Ban size={15}/>Revoke mandate</button></div>}
      </section>}
      <p className="text-xs leading-5 text-muted-foreground">Production safety: the assigned admin account is the management principal. This workspace launches private Story drafting; Strategy, Growth and Communications campaign AI endpoints independently recheck the linked campaign and active mandate, while Connections requires its separate account_connections scope. High-impact actions are not implied by the broad AI permission. This workflow does not create a creator login or impersonate the creator. The canonical campaign draft is owned by the assigned IFund admin under existing RLS, with creator and beneficiary attribution stored separately. It does not bypass RLS, connect external accounts, move money, or publish. High-impact permissions remain individually recorded; final creator approval is required before any publication workflow may be enabled.</p>
    </main>
  );
}
