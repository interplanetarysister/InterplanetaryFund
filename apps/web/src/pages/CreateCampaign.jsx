import { ArrowLeft, ArrowRight, BookOpen, Check, Rocket, Target, UserRound } from "lucide-react";
import { Image } from "@/components/ui/image";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { restoreCampaignWizard, rememberCampaignWizard } from "@/lib/browserCampaignDraft";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { makeDraftRequest, requestCampaignDraft } from "@/api/campaignDraft";
import { CAMPAIGN_WRITING_PATHS, guidedCampaignDetails } from "@/lib/campaignWritingPaths";
import { loadOwnerCampaign, saveOwnerCampaign, isCampaignConflict } from "@/api/ownerCampaigns";
import { CAMPAIGN_CATEGORIES, TITLE_MAX, SUMMARY_MAX, STORY_MAX, COVER_URL_MAX, validateCampaignForm, publishReadiness } from "@/lib/campaignLifecycle";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import MemberAccess from "@/components/auth/MemberAccess";
import { useAuthSession } from "@/hooks/useAuthSession";
import { restoreBrowserCampaign, restoreWritingBrief, emptyWritingBrief, rememberBrowserCampaign, forgetBrowserCampaign } from "@/lib/browserCampaignDraft";

export default function CreateCampaign() {
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  // The member gate clears private saved text when the account changes.
  return draftId
    ? <MemberAccess><NewCampaign memberAccess /></MemberAccess>
    : <NewCampaign />;
}

function NewCampaign({ memberAccess = false }) {
  const [params] = useSearchParams();
  const session = useAuthSession();
  if (session.status === "loading") return <main className="mx-auto max-w-3xl px-4 py-8" role="status">Opening your campaign editor…</main>;
  const ownerId = session.user?.id || null;
  // Reset all unsaved form and assistant state on account changes, preserving
  // only the explicit guest-to-first-owner handoff in scoped browser storage.
  return <CampaignComposer key={`${ownerId || "guest"}:${params.get("draft") || "new"}`} ownerId={ownerId} memberAccess={memberAccess} />;
}

function CampaignComposer({ memberAccess = false, ownerId = null }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  const campaignId = useRef(draftId || null);
  const [wizard] = useState(() => {
    try { return restoreCampaignWizard(sessionStorage, ownerId, draftId); }
    catch { return { step: 0, brief: emptyWritingBrief() }; }
  });
  const [step, setStep] = useState(wizard.step);
  const heading = useRef(null);
  const steps = [
    { label: "Your Details", title: "Tell us what matters", help: "Give your campaign a spark. Start with a few details, or skip ahead and write it yourself.", icon: UserRound },
    { label: "Basics", title: "Set the campaign basics", help: "Just the essentials. You can fine-tune the rest later.", icon: Target },
    { label: "Your Story", title: "Choose your words and story", help: "Pick a title, pick a description, then create your story—all on this page.", icon: BookOpen },
    { label: "Launch", title: "Review & launch", help: "One last look before your campaign enters orbit.", icon: Rocket },
  ];
  function goToStep(next) {
    setStep(next);
    requestAnimationFrame(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: "start", behavior: "instant" }); });
  }
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
        if (active) {
          setForm({ title:data.title||"", summary:data.summary||"", story:data.story||"", category:data.category||"community", goal_amount:Number(data.goal_amount)>0 ? String(data.goal_amount) : "", cover_image_url:data.cover_image_url||"" });
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
    return { title: "", summary: "", story: "", category: "community", goal_amount: "", cover_image_url: "" };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [restoredBrief] = useState(() => {
    try { return draftId ? wizard.brief : restoreWritingBrief(sessionStorage, ownerId); }
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
  useEffect(() => {
    // Saved-campaign context is browser-only, scoped to the verified identity
    // and exact campaign. It is never restored for another owner or draft.
    if (draftId && loadedDraftId !== draftId) return;
    try { rememberCampaignWizard(sessionStorage, ownerId, draftId, step, { writingPath, details: draftDetails, beneficiary: draftBeneficiary, need: draftNeed }); }
    catch { /* session storage unavailable */ }
  }, [step, ownerId, draftId, loadedDraftId, writingPath, draftDetails, draftBeneficiary, draftNeed]);
  const disabled = Boolean(busy || loadingDraft || draftLoadError || (draftId && loadedDraftId !== draftId));
  const readiness = publishReadiness(form);
  function change(key, value) { setSaved(""); setForm(prev => ({ ...prev, [key]: value })); }
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
      if (!alive.current) return;
      campaignId.current = data.id;
      try { rememberCampaignWizard(sessionStorage, user.id, status === "active" ? null : data.id, status === "active" ? 0 : step, status === "active" ? emptyWritingBrief() : { writingPath, details: draftDetails, beneficiary: draftBeneficiary, need: draftNeed }); } catch { /* unavailable */ }
      setSaved(data.id);
      try { forgetBrowserCampaign(sessionStorage); } catch { /* unavailable */ }
      if (status === "active") navigate(`/campaign/${encodeURIComponent(data.id)}`);
      else if (!draftId) navigate(`/create?draft=${encodeURIComponent(data.id)}`, { replace: true });
    } catch (err) {
      if (!alive.current) return;
      setError(err?.message || "Your campaign could not be saved.");
      if (isCampaignConflict(err)) setDraftLoadError("This campaign changed in another session. Open My campaigns before making further changes.");
    }
    finally { saveLock.current = false; setBusy(false); }
  }
  const actions = <div className="flex flex-wrap gap-3">
    <button form="campaign-editor" type="submit" disabled={disabled} className="quest-button min-h-12 rounded-2xl border px-6 font-semibold disabled:opacity-50">{busy === "draft" ? "Saving…" : "Save private draft"}</button>
    {step === 3 && <button type="button" onClick={() => save("active")} disabled={disabled || !readiness.ready} aria-describedby="campaign-publish-readiness" className="min-h-12 rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 px-6 font-bold text-slate-950 disabled:opacity-50">{busy === "active" ? "Publishing…" : "Publish campaign"}</button>}
  </div>;
  const basicsProblems = validateCampaignForm({ ...form, title: form.title || "Draft" }).filter(message => /goal|category/i.test(message));
  const canContinue = step === 0 || (step === 1 ? basicsProblems.length === 0 && Number(form.goal_amount) > 0 : Boolean(form.title.trim()));
  return <main className="campaign-quest deep-space mx-auto my-6 w-full min-w-0 max-w-3xl space-y-6 overflow-x-hidden rounded-[2rem] px-4 py-8 sm:px-6 sm:py-12">
    <Link to="/campaigns" className="inline-block text-sm text-cyan-200 underline">My campaigns</Link>
    <ol className="grid grid-cols-4 gap-1.5 sm:gap-3" aria-label={`Campaign setup: step ${step + 1} of 4`}>
      {steps.map(({ label, icon: Icon }, index) => <li key={label} aria-current={index === step ? "step" : undefined} className={`flex min-w-0 flex-col items-center gap-2 text-center ${index <= step ? "text-cyan-100" : "text-slate-400"}`}>
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl border sm:h-12 sm:w-12 ${index < step ? "border-cyan-200 bg-cyan-400 text-slate-950" : index === step ? "border-violet-300 bg-violet-500 text-white shadow-[0_0_18px_rgba(139,92,246,.4)]" : "border-slate-700 bg-slate-900 text-slate-400"}`}>
          {index < step ? <Check aria-hidden="true" className="h-6 w-6" /> : <Icon aria-hidden="true" className="h-6 w-6" />}
        </span><span className="break-words text-[11px] font-semibold leading-tight sm:text-sm">{label}</span>
      </li>)}
    </ol>
    <header><h1 ref={heading} tabIndex={-1} className="brand-gradient-text scroll-mt-6 break-words font-display text-3xl sm:text-4xl">{steps[step].title}</h1><p className="mt-2 text-sm text-slate-300">{steps[step].help}</p></header>
    {loadingDraft && <p role="status">Loading your saved draft…</p>}
    {draftLoadError && <p role="alert" className="text-destructive">{draftLoadError} <Link to="/campaigns" className="underline">My campaigns</Link></p>}
    <form id="campaign-editor" noValidate onSubmit={event => { event.preventDefault(); save("draft"); }} className="space-y-5">
    <section hidden={step !== 0} className="glass-panel space-y-4 rounded-[1.75rem] p-4 sm:p-6" aria-label="Your Details">
      <fieldset disabled={disabled} className="space-y-4">
      <h2 className="text-xl font-bold text-white">Give AI the signal</h2><p className="text-sm text-slate-300">A couple clues help. Everything here is optional.</p>
      <fieldset className="space-y-3">
        <legend className="font-semibold">What kind of campaign are you creating?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CAMPAIGN_WRITING_PATHS.map(path => <label key={path.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 ${writingPath === path.id ? "border-primary bg-primary/10" : "border-border"}`}>
            <input type="radio" name="writingPath" value={path.id} checked={writingPath === path.id} onChange={() => setWritingPath(path.id)} disabled={suggesting || busy || loadingDraft} />
            <span>{path.title}</span>
          </label>)}
        </div>
        <p className="text-sm text-slate-300">Choose a starting direction. Generate five title ideas, two short descriptions and one editable story.</p>
      </fieldset>
      <p className="text-sm text-slate-300">Get writing suggestions, check the facts, and choose what to include in your campaign.</p>
      <label className="block font-semibold">What is your fundraiser about?
        <textarea rows={4} maxLength={1500} value={draftDetails} disabled={suggesting || busy || loadingDraft || Boolean(draftLoadError)}
          onChange={e => setDraftDetails(e.target.value)} placeholder="Describe the situation and how funds would help."
          className="quest-input mt-2 w-full rounded-2xl border p-4" />
      </label>
      <label className="block font-semibold">Who benefits? (optional)
        <input maxLength={100} value={draftBeneficiary} disabled={suggesting || busy}
          onChange={e => setDraftBeneficiary(e.target.value)} className="quest-input mt-2 min-h-12 w-full rounded-2xl border px-4" />
      </label>
      <label className="block font-semibold">What is needed? (optional)
        <input maxLength={100} value={draftNeed} disabled={suggesting || busy}
          onChange={e => setDraftNeed(e.target.value)} className="quest-input mt-2 min-h-12 w-full rounded-2xl border px-4" />
      </label>
      <p className="text-xs text-slate-400">Your writing brief stays in this browser session. It is not yet a permanent campaign AI profile.</p>
      </fieldset>
    </section>

    <section hidden={step !== 1} aria-label="Basics" className="glass-panel space-y-5 rounded-[1.75rem] p-4 sm:p-6">
      <h2 className="text-xl font-bold text-white">Launch basics</h2><p className="text-sm text-slate-300">Choose your kind of campaign and your goal.</p>
      <fieldset disabled={disabled} className="grid min-w-0 gap-4 sm:grid-cols-2">
      <label className="block font-semibold">Category<select value={form.category} onChange={e=>change("category",e.target.value)} className="quest-input mt-2 min-h-12 w-full rounded-2xl border px-4">{CAMPAIGN_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabels[value] || value}</option>)}</select></label>
      <label className="block font-semibold">Fundraising goal (USD)<input inputMode="decimal" value={form.goal_amount} onChange={e=>change("goal_amount",e.target.value)} className="quest-input mt-2 min-h-12 w-full rounded-2xl border px-4" /></label>
      </fieldset>
      {basicsProblems.length > 0 && <p role="alert" className="text-sm text-rose-300">{basicsProblems[0]}</p>}
      {!form.goal_amount && <p className="text-sm text-slate-300">Set a positive goal to continue. You can still save an existing titled draft.</p>}
      {loadedDraftId && <button type="button" disabled={disabled} className="quest-button rounded-2xl border px-4 py-2" onClick={() => goToStep(2)}>Edit saved campaign text</button>}
      <p className="text-xs text-slate-400">Deadline, city lookup and cryptocurrency preferences are not available in this builder yet. Publishing does not enable donations.</p>
    </section>
    <section hidden={step !== 2} aria-label="Campaign story editor" className="glass-panel space-y-5 rounded-[1.75rem] p-4 sm:p-6">
      <fieldset disabled={disabled} className="space-y-5">
      <label className="block font-semibold">Campaign title<input required maxLength={TITLE_MAX} value={form.title} onChange={e=>change("title",e.target.value)} className="quest-input mt-2 min-h-12 w-full rounded-2xl border px-4" /></label>
      <label className="block font-semibold">Short description<textarea maxLength={SUMMARY_MAX} rows={3} value={form.summary} onChange={e=>change("summary",e.target.value)} className="quest-input mt-2 w-full rounded-2xl border p-4" /></label>
      <div className="space-y-4 rounded-2xl border border-violet-300/25 bg-violet-500/10 p-4">
      <h2 className="text-lg font-bold text-white">Make your story</h2>
      <p className="text-sm text-slate-300">Generate five title ideas, two descriptions and one story from Your Details. Review suggestions before applying them. Your final text stays editable.</p>
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
          <p className="text-sm text-slate-300">{suggestions.assistance === "outline" ? "Edit this basic outline section by section, then apply your edited story below." : "Edit each section separately. Rewriting produces a suggestion for your review and never overwrites other sections."}</p>
          {storySections.map((part, index) => <div key={index} className="space-y-2 rounded-xl border border-border p-4">
            <label className="block font-semibold">Section {index + 1}
              <textarea rows={5} value={part} onChange={e => editSection(index,e.target.value)} className="quest-input mt-2 w-full rounded-2xl border p-3" />
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

      </div>
      <label className="block font-semibold">Your story<textarea maxLength={STORY_MAX} rows={8} value={form.story} onChange={e=>change("story",e.target.value)} className="quest-input mt-2 w-full rounded-2xl border p-4" /></label>
      <label className="block font-semibold">Cover image URL (optional)<input type="url" maxLength={COVER_URL_MAX} value={form.cover_image_url} onChange={e=>change("cover_image_url",e.target.value)} className="quest-input mt-2 min-h-12 w-full rounded-2xl border px-4" /></label>
      <Image src={form.cover_image_url || FALLBACK_IMAGE} alt={form.cover_image_url ? "Campaign cover preview" : "Default campaign cover"} className="max-h-[32rem] w-full rounded-xl bg-slate-950 object-contain" />
      <p className="text-xs text-slate-400">Cover art is optional. Use an image link or the default cover. Uploading and generating images are not available here yet.</p>
      </fieldset>
    </section>
    <section hidden={step !== 3} aria-label="Launch review" className="glass-panel min-w-0 space-y-4 rounded-[1.75rem] p-4 sm:p-6">
      <Image src={form.cover_image_url || FALLBACK_IMAGE} alt="Campaign cover" className="max-h-[32rem] w-full rounded-xl bg-slate-950 object-contain" />
      <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">{categoryLabels[form.category]}</p>
      <h2 className="break-words font-display text-2xl text-white">{form.title || "Untitled campaign"}</h2>
      {form.summary && <p className="whitespace-pre-wrap break-words text-slate-300">{form.summary}</p>}
      <p>Goal: <span className="font-semibold text-cyan-200">${Number(form.goal_amount || 0).toLocaleString("en-US")}</span></p>
      {form.story && <details open className="rounded-2xl border border-white/10 bg-slate-950/35 p-4"><summary className="cursor-pointer font-semibold text-cyan-200">Campaign story</summary><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">{form.story}</p></details>}
      <button type="button" className="quest-button rounded-2xl border px-4 py-2" onClick={() => goToStep(2)}>Edit your story</button>
      <div id="campaign-publish-readiness" aria-live="polite">
        <h2 className="text-xl font-semibold">{readiness.ready ? "Ready to publish" : "Before you publish"}</h2>
        {readiness.ready ? <p className="mt-2 text-sm text-slate-300">Publishing makes your campaign visible on Discover and gives you a public link to share.</p>
          : <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{readiness.missing.map(item => <li key={item}>{item}</li>)}</ul>}
      </div>
      <p className="text-sm text-slate-300">Campaign donations are currently paused.</p>
    </section>
    {error && <div role="alert" className="text-destructive"><p>{error}</p>{!form.title.trim() && step !== 2 && <button type="button" className="underline" onClick={() => goToStep(2)}>Add your campaign title</button>}</div>}
    {saved && !loadingDraft && !draftLoadError && <p role="status" className="rounded-xl border border-cyan-300/30 p-4">Private draft saved. <Link to="/campaigns" className="underline">Manage your campaigns</Link></p>}
    </form>
    <section aria-label="Save or publish campaign" className="space-y-3">
      {memberAccess ? actions : <MemberAccess>{actions}</MemberAccess>}
      <p className="text-xs text-slate-300">Your draft stays private until you explicitly publish. A title is required to save to your account. Other progress is kept in this browser session.</p>
    </section>
    <div className="flex flex-col-reverse justify-between gap-3 sm:flex-row">
      <button type="button" disabled={step === 0 || disabled} onClick={() => goToStep(step - 1)} className="quest-button flex min-h-12 items-center justify-center rounded-2xl border px-6 disabled:opacity-50"><ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />Back</button>
      {step < 3 && <button type="button" disabled={disabled || !canContinue} onClick={() => goToStep(step + 1)} className="flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-violet-500 px-6 font-bold text-slate-950 disabled:opacity-50">Continue<ArrowRight aria-hidden="true" className="ml-2 h-4 w-4" /></button>}
    </div>
    <details className="rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4 text-sm text-slate-300"><summary className="cursor-pointer font-semibold">Additional campaign tools</summary><p className="mt-3">Permanent AI profiles, saved story versions across devices, five description choices, voice creation, connected fundraiser import, deadline and location, cover uploads and generation, and cryptocurrency preferences are not yet available here. Your Details and the current step are remembered only in this browser session.</p></details>
  </main>;
}
