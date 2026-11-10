import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { UserRound, Target, BookOpen, Rocket, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { authClient } from "@/api/auth";
import { makeDraftRequest, requestCampaignDraft } from "@/api/campaignDraft";
import { uploadCampaignCover } from "@/api/campaignMedia";
import { loadCampaignSetup, saveCampaignSetup } from "@/api/campaignSetup";
import { CAMPAIGN_WRITING_PATHS, guidedCampaignDetails } from "@/lib/campaignWritingPaths";
import { loadOwnerCampaign, saveOwnerCampaign, isCampaignConflict } from "@/api/ownerCampaigns";
import { CAMPAIGN_CATEGORIES, TITLE_MAX, SUMMARY_MAX, STORY_MAX, COVER_URL_MAX, validateCampaignForm, publishReadiness, emptyCampaignForm } from "@/lib/campaignLifecycle";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import MemberAccess from "@/components/auth/MemberAccess";
import { useAuthSession } from "@/hooks/useAuthSession";
import { restoreBrowserCampaign, restoreWritingBrief, emptyWritingBrief, rememberBrowserCampaign, forgetBrowserCampaign } from "@/lib/browserCampaignDraft";
import WritingDraftReview from "@/components/campaigns/WritingDraftReview";

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
  const ownerId = session.user?.id || null;
  // Reset all unsaved form and assistant state on account changes, preserving
  // only the explicit guest-to-first-owner handoff in scoped browser storage.
  return <CampaignComposer key={(draftId || "new") + ":" + (ownerId || "guest")} ownerId={ownerId} memberAccess={Boolean(draftId)} />;
}

function CampaignComposer({ memberAccess = false, ownerId = null }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  const campaignId = useRef(draftId || null);
  const saveLock = useRef(false);
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
        const setup = await loadCampaignSetup(authClient(), draftId);
        if (active) {
          setForm({ ...emptyCampaignForm(), title:data.title||"", summary:data.summary||"", story:data.story||"", category:data.category||"community", goal_amount:Number(data.goal_amount)>0 ? String(data.goal_amount) : "", cover_image_url:data.cover_image_url||"", ...(setup ? { end_date:setup.end_date||"", location:setup.location||"", location_lat:setup.location_lat, location_lng:setup.location_lng, cover_image_is_ai:setup.cover_image_is_ai===true, ai_profile:setup.ai_profile||{tone:"",never_change:""}, story_versions:setup.story_versions||[] } : {}) });
          if (setup && Number.isInteger(setup.draft_step)) setStep(Math.min(3,Math.max(0,setup.draft_step)));
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
    return emptyCampaignForm();
  });
  const [busy, setBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverError, setCoverError] = useState("");
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [restoredBrief] = useState(() => {
    try { return draftId ? emptyWritingBrief() : restoreWritingBrief(sessionStorage, ownerId); }
    catch { return emptyWritingBrief(); }
  });
  const [writingPath, setWritingPath] = useState(restoredBrief.writingPath);
  const [draftDetails, setDraftDetails] = useState(restoredBrief.details);
  const [draftBeneficiary, setDraftBeneficiary] = useState(restoredBrief.beneficiary);
  const [draftNeed, setDraftNeed] = useState(restoredBrief.need);
  const [step, setStep] = useState(restoredBrief.draftStep || 0);
  const steps = [{ label: "Your Details", Icon: UserRound }, { label: "Basics", Icon: Target }, { label: "Your Story", Icon: BookOpen }, { label: "Launch", Icon: Rocket }];
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
        details: ("Rewrite only this section of a campaign story, preserving all supplied facts. Original section: " + original + ". Campaign context: " + draftDetails + ". Preferred tone: " + (form.ai_profile?.tone || "") + ". Organizer-stated never-change text: " + (form.ai_profile?.never_change || "")).slice(0, 1500),
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
        details: (guidedCampaignDetails(writingPath, draftDetails) + "\nPreferred writing tone: " + (form.ai_profile?.tone || "natural") + "\nOrganizer-stated facts and wording to preserve: " + (form.ai_profile?.never_change || "none")).slice(0, 1500),
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
    try { rememberBrowserCampaign(sessionStorage, ownerId, form, { writingPath, details: draftDetails, beneficiary: draftBeneficiary, need: draftNeed, draftStep: step }); }
    catch { /* session storage unavailable */ }
  }, [form, draftId, ownerId, writingPath, draftDetails, draftBeneficiary, draftNeed, step]);
  const disabled = Boolean(busy || coverBusy || handoffBusy || loadingDraft || draftLoadError || (draftId && loadedDraftId !== draftId));
  const readiness = publishReadiness(form);
  function change(key, value) { setSaved(""); setForm(prev => ({ ...prev, [key]: value })); }
  function applyStoryCopy(text) {
    setSaved(""); setForm(prev => ({ ...prev, story: text,
      story_versions: prev.story?.trim() && prev.story !== text
        ? [...(prev.story_versions || []), { text: prev.story, saved_at: new Date().toISOString() }].slice(-20)
        : (prev.story_versions || []),
    }));
  }
  function changeAi(key, value) { setSaved(""); setForm(prev => ({ ...prev, ai_profile: { ...(prev.ai_profile || {}), [key]: value } })); }
  async function uploadCover(file) {
    if (!file || coverBusy || disabled) return;
    setCoverBusy(true); setCoverError("");
    try {
      const url = await uploadCampaignCover(authClient(), file);
      if (!alive.current) return;
      setSaved(""); setForm(prev => ({ ...prev, cover_image_url: url, cover_image_is_ai: false }));
    } catch (error) {
      if (alive.current) setCoverError(error?.message || "The image upload failed.");
    } finally { if (alive.current) setCoverBusy(false); }
  }
  async function save(status) {
    if (saveLock.current || disabled) return;
    const problems = validateCampaignForm(form, { publish: status === "active" });
    if (problems.length) { setError(problems[0]); return; }
    saveLock.current = true;
    setBusy(status); setError(""); setSaved("");
    try {
      const client = authClient();
      const { data: authData, error: authError } = await client.auth.getUser();
        const user = authData?.user;
      if (authError || !user) { navigate("/login?returnTo=" + encodeURIComponent(window.location.pathname + window.location.search), { replace: true }); return; }
      const data = await saveOwnerCampaign(client, form, { id: campaignId.current, status, expectedStatus: "draft" });
      // Set the receipt before routing so another click cannot insert a second
      // campaign while React is committing the new URL.
      campaignId.current = data.id;
      setSaved(data.id);
      await saveCampaignSetup(client, data.id, form, step);
      try { forgetBrowserCampaign(sessionStorage); } catch { /* unavailable */ }
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
    <header><h1 className="font-display text-3xl font-bold">Create a campaign</h1><p className="mt-2 text-muted-foreground">Write your story, save a private draft, or publish it to Discover when you’re ready. You can start writing before signing in.</p><Link to="/campaigns" className="mt-3 inline-block underline">My campaigns</Link></header>
    {loadingDraft && <p role="status">Loading your saved draft…</p>}
    {draftLoadError && <p role="alert" className="text-destructive">{draftLoadError} <Link to="/campaigns" className="underline">My campaigns</Link></p>}
    <nav aria-label="Campaign creation progress" className="grid grid-cols-4 gap-1.5 sm:gap-3">
      {steps.map(({ label, Icon }, index) => <div key={label} aria-current={step === index ? "step" : undefined}
        className={`flex min-w-0 flex-col items-center gap-2 text-center text-xs sm:text-sm ${index <= step ? "text-foreground" : "text-muted-foreground"}`}>
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${index < step ? "border-primary bg-primary text-primary-foreground" : index === step ? "border-primary bg-primary/20 text-primary" : "border-border bg-card"}`}>
          {index < step ? <Check aria-hidden="true" className="h-6 w-6"/> : <Icon aria-hidden="true" className="h-6 w-6"/>}
        </span>
        <span className="break-words font-semibold">{label}</span>
      </div>)}
    </nav>
    <p className="text-sm text-muted-foreground" role="status">Step {step + 1} of 4 — {steps[step].label}</p>
    {step === 0 && <section className="rounded-2xl border border-border bg-card p-5 sm:p-8 space-y-3">
      <h2 className="text-xl font-semibold">Tell us what matters</h2>
      <p className="text-sm text-muted-foreground">Start with what your fundraiser is about. You can explore the entire creator without signing in; saving and publishing require an account.</p>
      <label className="block font-semibold">What is your fundraiser about?
        <textarea rows={6} maxLength={1500} value={draftDetails} onChange={e => setDraftDetails(e.target.value)}
          placeholder="Who are you helping, what happened, and what would donations accomplish?"
          className="mt-2 w-full rounded-xl border border-input bg-background p-4" />
      </label>
      <label className="block font-semibold">Who benefits? (optional)
        <input maxLength={100} value={draftBeneficiary} onChange={e => setDraftBeneficiary(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>
      <label className="block font-semibold">What is needed? (optional)
        <input maxLength={100} value={draftNeed} onChange={e => setDraftNeed(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer font-semibold">Your AI writing instructions (optional)</summary>
        <div className="mt-3 space-y-3">
          <label className="block font-semibold">Preferred writing tone
            <input maxLength={200} value={form.ai_profile?.tone || ""} onChange={e => changeAi("tone",e.target.value)} placeholder="Hopeful, direct, professional…" className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4"/>
          </label>
          <label className="block font-semibold">Facts or wording the AI must preserve
            <textarea maxLength={2000} rows={3} value={form.ai_profile?.never_change || ""} onChange={e => changeAi("never_change",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4"/>
          </label>
          <p className="text-xs text-muted-foreground">These instructions are saved privately with your campaign. Review every AI suggestion before publishing.</p>
        </div>
      </details>
    </section>}
    {step === 2 && <WritingDraftReview onBusyChange={setHandoffBusy} ownerId={ownerId} campaignId={draftId || null} disabled={disabled} onApply={copy => { setForm(previous => ({ ...previous, ...copy })); setSaved(""); setError(""); }} />}
    {step === 2 && <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-8" aria-label="Campaign writing assistant">
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
          onClick={() => { applyStoryCopy(suggestions.story); setStorySections(splitStory(suggestions.story)); }}>Use story</button>
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
          <button type="button" className="rounded-xl border border-border px-4 py-2" onClick={() => applyStoryCopy(storySections.join("\n\n"))}>Use edited story sections</button>
        </div>
        {suggestions.imagePrompt && <details><summary>Suggested illustration concept (no image generated)</summary>
          <p>{suggestions.imagePrompt}</p>
        </details>}
      </div>}
      </fieldset>
    </section>}
    <form id="campaign-editor" onSubmit={event => { event.preventDefault(); save("draft"); }} className={`${step === 1 || step === 2 ? "" : "hidden"} space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8`}>
      <fieldset disabled={disabled} className="space-y-5">
      {step === 2 && <><label className="block font-semibold">Campaign title<input required maxLength={TITLE_MAX} value={form.title} onChange={e=>change("title",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Short description<textarea aria-label="Short description" maxLength={SUMMARY_MAX} rows={3} value={form.summary} onChange={e=>change("summary",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Your story<textarea aria-label="Your story" maxLength={STORY_MAX} rows={8} value={form.story} onChange={e=>change("story",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      {form.story_versions?.length > 0 && <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer font-semibold">Previous story versions ({form.story_versions.length})</summary>
        <div className="mt-3 space-y-3">
          {form.story_versions.slice(-5).reverse().map((revision,index) =>
            <div key={index} className="rounded-lg border border-border p-3">
              <p className="line-clamp-3 whitespace-pre-wrap text-sm">{revision.text}</p>
              <button type="button" onClick={() => applyStoryCopy(revision.text)} className="mt-2 rounded-lg border border-border px-4 py-2">Restore this version</button>
            </div>
          )}
        </div>
      </details>}
      <div className="space-y-3 rounded-xl border border-border p-4" aria-label="Campaign cover artwork">
        <h3 className="font-semibold">Campaign artwork</h3>
        {form.cover_image_url && <img src={form.cover_image_url} alt="Current campaign cover" className="max-h-72 w-full rounded-lg object-contain" />}
        <label className="block font-semibold">Upload your own photo
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={disabled || coverBusy || !ownerId}
            onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; uploadCover(file); }}
            className="mt-2 block w-full rounded-xl border border-input bg-background p-3 text-sm" />
        </label>
        {!ownerId && <p className="text-sm text-muted-foreground">You can design the campaign as a guest. Sign in to upload and store your artwork.</p>}
        <p className="text-xs text-muted-foreground">JPG, PNG, WEBP or GIF, up to 5 MB. Files are hosted by iFund on Cloudflare R2 rather than Base44.</p>
        {form.cover_image_is_ai && <p className="text-xs font-semibold">AI-generated illustration — not a documentary photograph.</p>}
        {coverBusy && <p role="status">Uploading your artwork…</p>}
        {coverError && <p role="alert" className="text-destructive">{coverError}</p>}
        <label className="block font-semibold">Or use an existing image URL
          <input type="url" maxLength={COVER_URL_MAX} value={form.cover_image_url} onChange={e=>{ setSaved(""); setForm(prev=>({ ...prev, cover_image_url:e.target.value, cover_image_is_ai:false })); }} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
        </label>
      </div>
      </>}
      {step === 1 && <><label className="block font-semibold">Category<select value={form.category} onChange={e=>change("category",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4">{CAMPAIGN_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabels[value] || value}</option>)}</select></label>
      <label className="block font-semibold">Fundraising goal (USD)<input inputMode="decimal" value={form.goal_amount} onChange={e=>change("goal_amount",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer font-semibold">Add extras (optional)</summary>
        <div className="mt-3 space-y-4">
          <label className="block font-semibold">Campaign deadline
            <input type="date" value={form.end_date || ""} onChange={e=>change("end_date",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
          </label>
          <label className="block font-semibold">Where is this happening?
            <input maxLength={160} value={form.location || ""} onChange={e=>change("location",e.target.value)} placeholder="City, state or region" className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
          </label>
        </div>
      </details>
      </>}
      </fieldset>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {saved && !loadingDraft && !draftLoadError && <p role="status" className="rounded-xl border border-border p-4">Private draft saved. <Link to="/campaigns" className="underline">Manage your campaigns</Link></p>}
    </form>
    {step === 3 && <section aria-label="Campaign launch preview" className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <h2 className="text-xl font-semibold">Review your campaign</h2>
      {form.cover_image_url && <img src={form.cover_image_url} alt="Campaign cover preview" className="w-full max-h-80 rounded-xl object-contain" />}
      <h3 className="text-2xl font-semibold break-words">{form.title || "Untitled campaign"}</h3>
      <p className="text-muted-foreground whitespace-pre-wrap">{form.summary || "Add a short description in Your Story."}</p>
      <p className="text-sm">Category: {categoryLabels[form.category] || form.category} · Goal: ${Number(form.goal_amount || 0).toLocaleString("en-US")}</p>
      <p className="whitespace-pre-wrap break-words">{form.story || "Add your story before publishing."}</p>
    </section>}
    {step === 3 && <section aria-label="Save or publish campaign" className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <div id="campaign-publish-readiness" aria-live="polite">
        <h2 className="text-xl font-semibold">{readiness.ready ? "Ready to publish" : "Before you publish"}</h2>
        {readiness.ready ? <p className="mt-2 text-sm text-muted-foreground">Publishing makes your campaign visible on Discover and gives you a public link to share.</p>
          : <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{readiness.missing.map(item => <li key={item}>{item}</li>)}</ul>}
      </div>
      <p className="text-sm text-muted-foreground">Campaign donations are currently paused.</p>
      {memberAccess ? actions : <MemberAccess>{actions}</MemberAccess>}
    </section>}
    {step !== 3 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">Your progress stays on this device until you save it to your account.</p>
      <button type="button" onClick={() => save("draft")} disabled={disabled} className="min-h-12 rounded-xl border border-border px-5 font-semibold disabled:opacity-50">{busy === "draft" ? "Saving…" : "Save private draft"}</button>
    </div>}
    {error && step !== 1 && step !== 2 && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
      <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-6 disabled:opacity-40"><ArrowLeft aria-hidden="true" className="h-4 w-4"/>Back</button>
      {step < 3 && <button type="button" onClick={() => setStep(s => Math.min(3, s + 1))}
        disabled={disabled || (step === 1 && !(Number(form.goal_amount) > 0)) || (step === 2 && !form.title.trim())}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-40">Continue<ArrowRight aria-hidden="true" className="h-4 w-4"/></button>}
    </div>
  </main>;
}
