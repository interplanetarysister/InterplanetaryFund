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
    ? <MemberAccess><CampaignComposer key={draftId} memberAccess /></MemberAccess>
    : <NewCampaign />;
}

function NewCampaign() {
  const session = useAuthSession();
  if (session.status === "loading") return <main className="mx-auto max-w-3xl px-4 py-8" role="status">Opening your campaign editor…</main>;
  const ownerId = session.user?.id || null;
  // Reset all unsaved form and assistant state on account changes, preserving
  // only the explicit guest-to-first-owner handoff in scoped browser storage.
  return <CampaignComposer key={ownerId || "guest"} ownerId={ownerId} />;
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
      campaignId.current = data.id;
      setSaved(data.id);
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
      <label className="block font-semibold">Campaign title<input required maxLength={TITLE_MAX} value={form.title} onChange={e=>change("title",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Short description<textarea maxLength={SUMMARY_MAX} rows={3} value={form.summary} onChange={e=>change("summary",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Your story<textarea maxLength={STORY_MAX} rows={8} value={form.story} onChange={e=>change("story",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Category<select value={form.category} onChange={e=>change("category",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4">{CAMPAIGN_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabels[value] || value}</option>)}</select></label>
      <label className="block font-semibold">Fundraising goal (USD)<input inputMode="decimal" value={form.goal_amount} onChange={e=>change("goal_amount",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Cover image URL (optional)<input type="url" maxLength={COVER_URL_MAX} value={form.cover_image_url} onChange={e=>change("cover_image_url",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      </fieldset>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {saved && !loadingDraft && !draftLoadError && <p role="status" className="rounded-xl border border-border p-4">Private draft saved. <Link to="/campaigns" className="underline">Manage your campaigns</Link></p>}
    </form>
    <section aria-label="Save or publish campaign" className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <div id="campaign-publish-readiness" aria-live="polite">
        <h2 className="text-xl font-semibold">{readiness.ready ? "Ready to publish" : "Before you publish"}</h2>
        {readiness.ready ? <p className="mt-2 text-sm text-muted-foreground">Publishing makes your campaign visible on Discover and gives you a public link to share.</p>
          : <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{readiness.missing.map(item => <li key={item}>{item}</li>)}</ul>}
      </div>
      <p className="text-sm text-muted-foreground">Campaign donations are currently paused.</p>
      {memberAccess ? actions : <MemberAccess>{actions}</MemberAccess>}
    </section>
  </main>;
}
