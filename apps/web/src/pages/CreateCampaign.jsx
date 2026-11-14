import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { uploadCampaignCover, validateCoverFile } from "@/api/campaignCovers";
import { makeDraftRequest, requestCampaignDraft } from "@/api/campaignDraft";
import { CAMPAIGN_WRITING_PATHS, guidedCampaignDetails } from "@/lib/campaignWritingPaths";
import { loadOwnerCampaign, saveOwnerCampaign, isCampaignConflict } from "@/api/ownerCampaigns";
import { CAMPAIGN_CATEGORIES, TITLE_MAX, SUMMARY_MAX, STORY_MAX, COVER_URL_MAX, validateCampaignForm, publishReadiness } from "@/lib/campaignLifecycle";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import MemberAccess from "@/components/auth/MemberAccess";
import { useAuthSession } from "@/hooks/useAuthSession";
import { restoreBrowserCampaign, restoreWritingBrief, emptyWritingBrief, rememberBrowserCampaign, forgetBrowserCampaign } from "@/lib/browserCampaignDraft";
import WritingDraftReview from "@/components/campaigns/WritingDraftReview";
import PrepublicationGate from "@/components/campaigns/PrepublicationGate";
import CampaignReadinessScore from "@/components/campaigns/CampaignReadinessScore";
import CampaignLocationFields from "@/components/atlas/CampaignLocationFields";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";

export default function CreateCampaign() {
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  // The member gate clears private saved text when the account changes.
  return draftId
    ? <MemberAccess><NewCampaign draftId={draftId} /></MemberAccess>
    : <NewCampaign />;
}

function NewCampaign({ draftId = null }) {
  const session = useAuthSession();
  if (session.status === "loading") return <main className="mx-auto max-w-3xl px-4 py-8" role="status">Opening your campaign editor…</main>;
  // Anonymous Supabase sessions are guests, not durable draft owners.
  // Keep their browser draft eligible for handoff after email verification.
  const ownerId = session.user?.is_anonymous === true ? null : (session.user?.id || null);
  // Reset all unsaved form and assistant state on account changes, preserving
  // only the explicit guest-to-first-owner handoff in scoped browser storage.
  return <CampaignComposer key={(draftId || "new") + ":" + (ownerId || "guest")} ownerId={ownerId} memberAccess={Boolean(draftId)} />;
}

function CampaignComposer({ memberAccess = false, ownerId = null }) {
  const donationsEnabled = usePublicCampaignFundraising();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  const campaignId = useRef(draftId || null);
  const saveLock = useRef(false);
  const coverUploadLock = useRef(false);
  const writingLock = useRef(false);
  const writingRequests = useRef(new Map());
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [loadedDraftId, setLoadedDraftId] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(draftId));
  const [draftLoadError, setDraftLoadError] = useState("");
  useEffect(() => {
    if (!draftId) { setLoadingDraft(false); setDraftLoadError(""); return; }
    setLoadingDraft(true); setDraftLoadError("");
    let active = true;
    (async () => {
      try {
        const data = await loadOwnerCampaign(authClient(), draftId);
        if (data.status !== "draft") throw new Error("This campaign is no longer a draft. Open My campaigns to view its current status.");
        if (active) {
          setForm({ title:data.title||"", summary:data.summary||"", story:data.story||"", category:data.category||"community", goal_amount:Number(data.goal_amount)>0 ? String(data.goal_amount) : "", cover_image_url:data.cover_image_url||"", map_opt_in:data.map_opt_in===true, public_location_label:data.public_location_label||"", map_latitude:data.map_latitude===null ? "" : String(data.map_latitude), map_longitude:data.map_longitude===null ? "" : String(data.map_longitude) });
          setLoadedDraftId(draftId);
          setSaved(data.id);
        }
      } catch (err) { if (active) setDraftLoadError(err?.message || "Unable to load draft."); }
      finally { if (active) setLoadingDraft(false); }
    })();
    return () => { active = false; };
  }, [draftId,navigate]);
  const [form, setForm] = useState(() => {
    try {
      if (!draftId) return restoreBrowserCampaign(sessionStorage, ownerId);
    } catch { /* session storage unavailable */ }
    return { title: "", summary: "", story: "", category: "community", goal_amount: "", cover_image_url: "", map_opt_in: false, public_location_label: "", map_latitude: "", map_longitude: "" };
  });
  const [busy, setBusy] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverUploadMessage, setCoverUploadMessage] = useState("");
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [browserSaved, setBrowserSaved] = useState(false);
  const [restoredBrief] = useState(() => {
    try { return draftId ? emptyWritingBrief() : restoreWritingBrief(sessionStorage, ownerId); }
    catch { return emptyWritingBrief(); }
  });
  const [writingPath, setWritingPath] = useState(restoredBrief.writingPath);
  const [draftDetails, setDraftDetails] = useState(restoredBrief.details);
  const [draftBeneficiary, setDraftBeneficiary] = useState(restoredBrief.beneficiary);
  const [draftNeed, setDraftNeed] = useState(restoredBrief.need);
  const [suggestions, setSuggestions] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionError, setSuggestionError] = useState("");
  const [writingQueued, setWritingQueued] = useState(false);
  const [storySections, setStorySections] = useState([]);
  const [sectionProposals, setSectionProposals] = useState({});
  const [regeneratingSection, setRegeneratingSection] = useState(-1);
  const [sectionError, setSectionError] = useState("");
  function splitStory(story) {
    return String(story || "").split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  }
  function editSection(index, value) {
    setStorySections(previous => previous.map((part, i) => i === index ? value : part));
  }
  async function writingSuggestion(input) {
    const key = JSON.stringify({ ...makeDraftRequest(input), section: input.section || null });
    let id = writingRequests.current.get(key);
    if (!id) {
      if (writingRequests.current.size >= 32) writingRequests.current.delete(writingRequests.current.keys().next().value);
      id = crypto.randomUUID(); writingRequests.current.set(key, id);
    }
    try {
      const result = await requestCampaignDraft(authClient(), input, { requestId: id });
      writingRequests.current.delete(key);
      return result;
    } catch (error) {
      if (error?.code === "new_request_required") writingRequests.current.delete(key);
      throw error;
    }
  }
  async function regenerateSection(index) {
    if (writingLock.current || regeneratingSection !== -1 || suggesting || busy) return;
    writingLock.current = true;
    setRegeneratingSection(index);
    setSectionError("");
    try {
      const original = storySections[index];
      const result = await writingSuggestion({
        details: ("Rewrite only this section of a campaign story, preserving all supplied facts. Original section: " + original + ". Campaign context: " + draftDetails).slice(0, 1500),
        beneficiary: draftBeneficiary,
        need: draftNeed,
        cause: form.category,
        goal: form.goal_amount,
        section: original,
      });
      if (!alive.current) return;
      const proposed = result.story.trim();
      if (!proposed) throw new Error("No replacement section returned.");
      setSectionProposals(previous => ({ ...previous, [index]: proposed }));
    } catch (err) {
      if (alive.current) { setSectionError(err?.message || "Unable to regenerate section."); setWritingQueued(err?.code === "queued"); }
    } finally {
      writingLock.current = false;
      if (alive.current) setRegeneratingSection(-1);
    }
  }

  async function suggestDraft() {
    if (writingLock.current || busy || suggesting || loadingDraft || draftLoadError) return;
    writingLock.current = true;
    setSuggesting(true); setSuggestionError(""); setWritingQueued(false);
    try {
      const result = await writingSuggestion({
        details: guidedCampaignDetails(writingPath, draftDetails),
        beneficiary: draftBeneficiary,
        need: draftNeed,
        cause: form.category,
        goal: form.goal_amount,
      });
      if (!alive.current) return;
      setSuggestions(result);
      setStorySections(splitStory(result.story));
      setSectionProposals({});
    } catch (error) {
      if (alive.current) { setSuggestionError(error?.message || "Could not prepare your draft."); setWritingQueued(error?.code === "queued"); }
    } finally {
      writingLock.current = false;
      if (alive.current) setSuggesting(false);
    }
  }
  useEffect(() => {
    if (draftId) return;
    try { rememberBrowserCampaign(sessionStorage, ownerId, form, { writingPath, details: draftDetails, beneficiary: draftBeneficiary, need: draftNeed }); }
    catch { /* session storage unavailable */ }
  }, [form, draftId, ownerId, writingPath, draftDetails, draftBeneficiary, draftNeed]);
  const disabled = Boolean(busy || coverUploading || handoffBusy || loadingDraft || draftLoadError || (draftId && loadedDraftId !== draftId));
  const readiness = publishReadiness(form);
  function change(key, value) { setSaved(""); setBrowserSaved(false); setForm(prev => ({ ...prev, [key]: value })); }
  async function handleCoverUpload(file) {
    if (coverUploadLock.current || !file) return;
    const problem = validateCoverFile(file);
    if (problem) { setError(problem); return; }
    coverUploadLock.current = true;
    setCoverUploading(true);
    setCoverUploadMessage("");
    setError("");
    try {
      const url = await uploadCampaignCover(authClient(), file);
      if (!alive.current) return;
      change("cover_image_url", url);
      setCoverUploadMessage("Your cover image uploaded. Save this draft or publish to attach it to your campaign.");
    } catch (cause) {
      if (alive.current) setError(cause?.message || "The cover image could not be uploaded. Try a smaller JPG or PNG.");
    } finally {
      coverUploadLock.current = false;
      if (alive.current) setCoverUploading(false);
    }
  }
  async function save(status) {
    if (saveLock.current || disabled) return;
    saveLock.current = true;
    setBusy(status); setError(""); setSaved("");
    try {
      let client; let user;
      try {
        client = authClient();
        const result = await client.auth.getUser();
        if (!result.error) user = result.data?.user;
      } catch { /* Guest editor remains available without an account. */ }
      if (!user?.id || user.is_anonymous === true || !user.email_confirmed_at) {
        if (status === "active") {
          setError("Publishing requires a secure account with a verified owner ID. Your draft remains in this browser; you can continue without verifying your identity, but public publishing is not available in browser-only mode.");
          return;
        }
        try {
          rememberBrowserCampaign(sessionStorage, null, form, { writingPath, details: draftDetails, beneficiary: draftBeneficiary, need: draftNeed });
          setBrowserSaved(true);
        } catch { throw new Error("Browser storage is unavailable. Copy your draft before leaving."); }
        return;
      }
      const problems = validateCampaignForm(form, { publish: status === "active" });
      if (problems.length) { setError(problems[0]); return; }
      const data = await saveOwnerCampaign(client, form, { id: campaignId.current, status, expectedStatus: "draft" });
      // Set the receipt before routing so another click cannot insert a second
      // campaign while React is committing the new URL.
      campaignId.current = data.id;
      setSaved(data.id);
      try { forgetBrowserCampaign(sessionStorage); } catch { /* unavailable */ }
      setBrowserSaved(false);
      if (status === "active") navigate(`/campaign/${encodeURIComponent(data.id)}`);
      else if (!draftId) navigate(`/create?draft=${encodeURIComponent(data.id)}`, { replace: true });
    } catch (err) {
      setError(err?.message || "Your campaign could not be saved.");
      if (isCampaignConflict(err)) setDraftLoadError("This campaign changed in another session. Open My campaigns before making further changes.");
    }
    finally { saveLock.current = false; setBusy(false); }
  }
  const actions = <div className="flex flex-wrap gap-3">
    <button form="campaign-editor" type="submit" disabled={disabled} className="min-h-12 rounded-xl border border-border px-6 font-semibold disabled:opacity-50">{busy === "draft" ? "Saving…" : "Save private draft"}</button>
    <button type="button" onClick={() => save("active")} disabled={disabled || !readiness.ready} aria-describedby="campaign-publish-readiness" className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">{busy === "active" ? "Publishing…" : "Publish campaign"}</button>
  </div>;
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header><h1 className="font-display text-3xl font-bold">Create a campaign</h1><p className="mt-2 text-muted-foreground">Explore the campaign creator without identity verification. Guest drafts stay in this browser. Sign in with a verified email account to save a campaign to your account or publish it.</p><Link to="/campaigns" className="mt-3 inline-block underline">My campaigns</Link></header>
    {loadingDraft && <p role="status">Loading your saved draft…</p>}
    {draftLoadError && <p role="alert" className="text-destructive">{draftLoadError} <Link to="/campaigns" className="underline">My campaigns</Link></p>}
    <WritingDraftReview onBusyChange={setHandoffBusy} ownerId={ownerId} campaignId={draftId || null} disabled={disabled} onApply={copy => { setForm(previous => ({ ...previous, ...copy })); setSaved(""); setError(""); }} />
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-8" aria-label="Campaign writing assistant">
      <fieldset disabled={disabled} className="space-y-4">
      <h2 className="text-xl font-semibold">Campaign writing assistant</h2>
      <fieldset className="space-y-3">
        <legend className="font-semibold">What kind of campaign are you creating?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CAMPAIGN_WRITING_PATHS.map(path => <label key={path.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 ${writingPath === path.id ? "border-primary bg-primary/10" : "border-border"}`}>
            <input type="radio" name="writingPath" value={path.id} checked={writingPath === path.id} onChange={() => setWritingPath(path.id)} disabled={suggesting || busy || loadingDraft} />
            <span>{path.title}</span>
          </label>)}
        </div>
        <p className="text-sm text-muted-foreground">Choose a starting direction. Generate five title ideas, two short descriptions and one editable story.</p>
      </fieldset>
      <p className="text-sm text-muted-foreground">Get writing suggestions, check the facts, and choose what to include in your campaign.</p>
      <label className="block font-semibold">What is your fundraiser about?
        <textarea rows={4} maxLength={1500} value={draftDetails} disabled={suggesting || busy || loadingDraft || Boolean(draftLoadError)}
          onChange={e => setDraftDetails(e.target.value)} placeholder="Describe the situation and how funds would help."
          className="mt-2 w-full rounded-xl border border-input bg-background p-4" />
      </label>
      <label className="block font-semibold">Who benefits? (optional)
        <input maxLength={100} value={draftBeneficiary} disabled={suggesting || busy}
          onChange={e => setDraftBeneficiary(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>
      <label className="block font-semibold">What is needed? (optional)
        <input maxLength={100} value={draftNeed} disabled={suggesting || busy}
          onChange={e => setDraftNeed(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>
      <button type="button" onClick={suggestDraft}
        disabled={suggesting || busy || loadingDraft || Boolean(draftLoadError) || draftDetails.trim().length < 12}
        className="min-h-12 rounded-xl border border-border px-6 font-semibold disabled:opacity-50">
        {suggesting ? "Preparing ideas…" : "Generate campaign ideas"}
      </button>
      {suggestionError && <p role="alert" className="text-destructive">{suggestionError}</p>}
      {writingQueued && <p className="text-sm"><Link to="/agents" className="underline">View saved writing requests</Link></p>}
      {suggestions && <div aria-label="Campaign ideas" className="space-y-4" role="region">
        <p role="status" className="text-sm">{suggesting || suggestionError ? (suggestions.assistance === "outline" ? "Your previous basic outline remains available below for review." : "Your previous writing suggestions remain available below for review.") : suggestions.assistance === "outline" ? "A basic outline is ready, using only the facts you supplied. Edit it and choose what to include." : "Writing suggestions are ready. Check the facts and choose which ideas to apply below."}</p>
        <h3 className="font-semibold">Title ideas</h3>
        {suggestions.titles.map((v, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1">{v}</p>
          <button type="button" className="rounded-xl border border-border px-4 py-2"
            onClick={() => change("title",v)}>Use title</button>
        </div>)}
        <h3 className="font-semibold">Short descriptions</h3>
        {suggestions.summaries.map((v, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1">{v}</p>
          <button type="button" className="rounded-xl border border-border px-4 py-2"
            onClick={() => change("summary",v)}>Use description</button>
        </div>)}
        <h3 className="font-semibold">Story idea</h3>
        <p className="whitespace-pre-wrap">{suggestions.story}</p>
        <button type="button" className="rounded-xl border border-border px-4 py-2"
          onClick={() => { change("story",suggestions.story); setStorySections(splitStory(suggestions.story)); }}>Use story</button>
        <div className="space-y-4" aria-label="Story section editor">
          <p className="text-sm text-muted-foreground">{suggestions.assistance === "outline" ? "Edit this basic outline section by section, then apply your edited story below." : "Edit each section separately. Rewriting produces a suggestion for your review and never overwrites other sections."}</p>
          {storySections.map((part, index) => <div key={index} className="space-y-2 rounded-xl border border-border p-4">
            <label className="block font-semibold">Section {index + 1}
              <textarea rows={5} value={part} onChange={e => editSection(index,e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-3" />
            </label>
            <button type="button" disabled={suggestions.assistance === "outline" || regeneratingSection !== -1 || suggesting || busy} onClick={() => regenerateSection(index)} className="rounded-xl border border-border px-4 py-2 disabled:opacity-50">
              {regeneratingSection === index ? "Generating…" : "Regenerate this section"}
            </button>
            {sectionProposals[index] && <div className="space-y-2 rounded-xl border border-primary/30 p-3">
              <p className="font-semibold">Suggested replacement</p>
              <p className="whitespace-pre-wrap">{sectionProposals[index]}</p>
              <button type="button" className="rounded-xl border border-border px-4 py-2" onClick={() => { editSection(index,sectionProposals[index]); setSectionProposals(previous => { const next = {...previous}; delete next[index]; return next; }); }}>Accept</button>
              <button type="button" className="ml-2 rounded-xl border border-border px-4 py-2" onClick={() => setSectionProposals(previous => { const next = {...previous}; delete next[index]; return next; })}>Discard</button>
            </div>}
          </div>)}
          {sectionError && <p role="alert">{sectionError}</p>}
          <button type="button" className="rounded-xl border border-border px-4 py-2" onClick={() => change("story",storySections.join("\n\n"))}>Use edited story sections</button>
        </div>
        {suggestions.imagePrompt && <details><summary>Suggested illustration concept (no image generated)</summary>
          <p>{suggestions.imagePrompt}</p>
        </details>}
      </div>}
      </fieldset>
    </section>
    <form id="campaign-editor" onSubmit={event => { event.preventDefault(); save("draft"); }} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <fieldset disabled={disabled} className="space-y-5">
      <label className="block font-semibold">Campaign title<input id="campaign-title" maxLength={TITLE_MAX} value={form.title} onChange={e=>change("title",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Short description<textarea id="campaign-summary" aria-label="Short description" maxLength={SUMMARY_MAX} rows={3} value={form.summary} onChange={e=>change("summary",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <p className="text-sm text-muted-foreground">Full story format: 2–3 paragraphs separated by a blank line, each containing 3–5 complete sentences.</p>
      <label className="block font-semibold">Your story<textarea id="campaign-story" aria-label="Your story" maxLength={STORY_MAX} rows={8} value={form.story} onChange={e=>change("story",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Category<select id="campaign-category" value={form.category} onChange={e=>change("category",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4">{CAMPAIGN_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabels[value] || value}</option>)}</select></label>
      <label className="block font-semibold">Fundraising goal (USD)<input id="campaign-goal" inputMode="decimal" value={form.goal_amount} onChange={e=>change("goal_amount",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <div id="campaign-cover" className="space-y-3 rounded-2xl border border-border p-4" aria-label="Campaign cover image">
        <div>
          <h3 className="font-semibold">Campaign cover image (optional)</h3>
          <p className="mt-1 text-sm text-muted-foreground">Upload a JPG, PNG, WebP or AVIF image up to 5 MB. Uploaded covers are publicly viewable when someone has their link; do not upload private documents or images without permission.</p>
        </div>
        <label className="block text-sm font-semibold">Upload your cover
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={disabled}
            onChange={event => { const file=event.currentTarget.files?.[0]; event.currentTarget.value=""; if(file) void handleCoverUpload(file); }}
            className="mt-2 block w-full rounded-xl border border-input bg-background p-3 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground" />
        </label>
        {coverUploading && <p role="status" className="text-sm text-blue-700">Uploading cover image securely… Saving and publishing are temporarily disabled.</p>}
        {coverUploadMessage && <p role="status" className="text-sm text-emerald-700">{coverUploadMessage}</p>}
        <label className="block text-sm font-semibold">Or paste an image URL
          <input type="url" maxLength={COVER_URL_MAX} value={form.cover_image_url}
            onChange={event => { change("cover_image_url",event.target.value); setCoverUploadMessage(""); }}
            className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
        </label>
        {form.cover_image_url && <div className="rounded-xl border border-border p-3">
          <p className="mb-2 text-xs text-muted-foreground">Cover preview — confirm the image displays before publishing</p>
          <img src={form.cover_image_url} alt="Campaign cover preview" loading="lazy" className="max-h-56 w-full rounded-lg object-contain" />
        </div>}
      </div>
      <CampaignLocationFields form={form} change={change} disabled={disabled} />
      </fieldset>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {browserSaved && <p role="status" className="rounded-xl border border-cyan-500/40 p-4">Draft saved in this browser tab only. It has not been uploaded or published. Keep this tab open until your account is linked.</p>}
      {saved && !loadingDraft && !draftLoadError && <p role="status" className="rounded-xl border border-border p-4">Private draft saved. <Link to="/campaigns" className="underline">Manage your campaigns</Link></p>}
    </form>
    <CampaignReadinessScore form={form} />
    <PrepublicationGate form={form} campaignId={draftId || saved || null} disabled={disabled} onApply={value=>change("story", value)} onApplyFields={fields=>{setForm(previous=>({...previous,...fields}));setSaved("");setBrowserSaved(false);}} />
    <section aria-label="Save or publish campaign" className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <div id="campaign-publish-readiness" aria-live="polite">
        <h2 className="text-xl font-semibold">{readiness.ready ? "Ready to publish" : "Before you publish"}</h2>
        {readiness.ready ? <p className="mt-2 text-sm text-muted-foreground">Publishing makes your campaign visible on Discover and gives you a public link to share.</p>
          : <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{readiness.missing.map(item => <li key={item}>{item}</li>)}</ul>}
      </div>
      <p className="text-sm text-muted-foreground">{donationsEnabled ? "Publishing makes this active campaign eligible for verified PayPal donations." : "Campaign checkout is temporarily unavailable; you can still save and publish."}</p>
      {actions}
    </section>
  </main>;
}
