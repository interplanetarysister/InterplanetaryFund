import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { requestCampaignDraft } from "@/api/campaignDraft";

// Keep an unsigned visitor's unfinished campaign on this device across sign-in.
// This is not a server-side save and is cleared only after a confirmed draft write.
const LOCAL_DRAFT_KEY = "ifund:guest-campaign-draft:v1";
function readGuestDraft() {
  try {
    const raw = sessionStorage.getItem(LOCAL_DRAFT_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch { return {}; }
}

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  const [loadingDraft, setLoadingDraft] = useState(Boolean(draftId));
  const [draftLoadError, setDraftLoadError] = useState("");
  useEffect(() => {
    if (!draftId) { setLoadingDraft(false); setDraftLoadError(""); return; }
    setLoadingDraft(true); setDraftLoadError("");
    let active = true;
    (async () => {
      try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draftId)) throw new Error("Invalid draft reference.");
        const client = authClient();
        const { data: authData, error: authError } = await client.auth.getUser();
        const user = authData?.user;
        if (authError || !user) { navigate(`/login?next=${encodeURIComponent(`/create?draft=${encodeURIComponent(draftId)}`)}`, { replace: true }); return; }
        const { data, error: fetchError } = await client.from("ifund_campaigns").select("title,summary,story,category,goal_amount,cover_image_url,status").eq("id",draftId).eq("owner_id",user.id).eq("status","draft").single();
        if (fetchError || !data) throw new Error("Draft not found or access denied.");
        if (active) setForm({ title:data.title||"", summary:data.summary||"", story:data.story||"", category:data.category||"community", goal_amount:String(data.goal_amount??""), cover_image_url:data.cover_image_url||"" });
      } catch (err) { if (active) setDraftLoadError(err?.message || "Unable to load draft."); }
      finally { if (active) setLoadingDraft(false); }
    })();
    return () => { active = false; };
  }, [draftId,navigate]);
  const [form, setForm] = useState(() => ({ title: "", summary: "", story: "", category: "community", goal_amount: "", cover_image_url: "", ...(!draftId ? readGuestDraft().form : {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [draftDetails, setDraftDetails] = useState(() => !draftId ? (readGuestDraft().details || "") : "");
  const [draftBeneficiary, setDraftBeneficiary] = useState(() => !draftId ? (readGuestDraft().beneficiary || "") : "");
  const [draftNeed, setDraftNeed] = useState(() => !draftId ? (readGuestDraft().need || "") : "");
  const [suggestions, setSuggestions] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  // Invalidate in-flight AI suggestions when their campaign context changes.
  const suggestionRevision = useRef(0);
  const sectionRevision = useRef(0);
  const regenerationRequest = useRef(0);
  const [suggestionError, setSuggestionError] = useState("");
  const [storySections, setStorySections] = useState([]);
  const storySectionsRef = useRef([]);
  const [sectionProposals, setSectionProposals] = useState({});
  const [regeneratingSection, setRegeneratingSection] = useState(-1);
  const [sectionError, setSectionError] = useState("");
  useEffect(() => {
    if (draftId) return;
    try { sessionStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ form, details: draftDetails, beneficiary: draftBeneficiary, need: draftNeed })); }
    catch { /* Private browsing or storage restrictions must not block composing. */ }
  }, [draftId, form, draftDetails, draftBeneficiary, draftNeed]);
  function splitStory(story) {
    return String(story || "").split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
  }
  function editSection(index, value) {
    const updated = storySectionsRef.current.map((part, i) => i === index ? value : part);
    sectionRevision.current += 1;
    // Editing the source invalidates its in-flight rewrite immediately.
    // Unlock the section controls without waiting for a stale request to settle.
    regenerationRequest.current += 1;
    setRegeneratingSection(-1);
    setSectionError("");
    storySectionsRef.current = updated;
    setStorySections(updated);
    // Persist section edits immediately; saving must never use an older story.
    setForm(previous => ({ ...previous, story: updated.join("\n\n") }));
    // A proposal was generated against the previous text; never offer a stale
    // replacement after the organizer edits that section.
    setSectionProposals(previous => {
      if (!Object.prototype.hasOwnProperty.call(previous, index)) return previous;
      const next = { ...previous };
      delete next[index];
      return next;
    });
  }
  async function regenerateSection(index) {
    if (regeneratingSection !== -1 || suggesting || busy) return;
    const requestId = ++regenerationRequest.current;
    setRegeneratingSection(index);
    setSectionError("");
    // Capture the request context outside try so rejected requests can be
    // checked safely in catch without throwing a ReferenceError.
    const original = storySectionsRef.current[index];
    const revision = sectionRevision.current;
    const contextRevision = suggestionRevision.current;
    try {
      const result = await requestCampaignDraft(authClient(), {
        details: ("Rewrite only this section of a campaign story, preserving all supplied facts. Original section: " + original + ". Campaign context: " + draftDetails).slice(0, 1500),
        beneficiary: draftBeneficiary,
        need: draftNeed,
        cause: form.category,
        goal: form.goal_amount,
      });
      // Discard an asynchronous response if the organizer edited its source
      // while generation was in flight; never surface an obsolete proposal.
      if (sectionRevision.current !== revision || suggestionRevision.current !== contextRevision || storySectionsRef.current[index] !== original) return;
      const proposed = splitStory(result.story)[0];
      if (!proposed) throw new Error("No replacement section returned.");
      setSectionProposals(previous => ({ ...previous, [index]: proposed }));
    } catch (err) {
      // An obsolete request can also fail after its source changed. Do not
      // present that failure as an error with the organizer’s current draft.
      if (sectionRevision.current === revision && suggestionRevision.current === contextRevision && storySectionsRef.current[index] === original) {
        setSectionError(err?.message || "Unable to regenerate section.");
      }
    } finally {
      if (requestId === regenerationRequest.current) setRegeneratingSection(-1);
    }
  }

  async function suggestDraft() {
    if (busy || suggesting || loadingDraft || draftLoadError) return;
    const revision = ++suggestionRevision.current;
    setSuggesting(true); setSuggestionError(""); setSuggestions(null);
    try {
      const result = await requestCampaignDraft(authClient(), {
        details: draftDetails,
        beneficiary: draftBeneficiary,
        need: draftNeed,
        cause: form.category,
        goal: form.goal_amount,
      });
      if (revision !== suggestionRevision.current) return;
      setSuggestions(result);
      sectionRevision.current += 1;
      storySectionsRef.current = splitStory(result.story);
      setStorySections(storySectionsRef.current);
      setSectionProposals({});
    } catch (error) {
      if (revision === suggestionRevision.current) setSuggestionError(error?.message || "Could not prepare your draft.");
    } finally {
      // An older request must not clear the busy state of a newer AI request.
      if (revision === suggestionRevision.current) setSuggesting(false);
    }
  }
  function invalidateCampaignIdeas() {
    suggestionRevision.current += 1;
    // Context edits invalidate the active request; unlock generation immediately.
    // Its guarded finally block must not clear a subsequent request.
    setSuggesting(false);
    sectionRevision.current += 1;
    // A context change makes any in-flight section rewrite obsolete.
    regenerationRequest.current += 1;
    setRegeneratingSection(-1);
    setSuggestions(null);
    setSuggestionError("");
    setSectionProposals({});
    setSectionError("");
  }
  function change(key, value) {
    if (key === "category" || key === "goal_amount") {
      invalidateCampaignIdeas();
      // A proposed rewrite is tied to the previous fundraising context.
      // Never let it be accepted after the goal or cause has changed.
      sectionRevision.current += 1;
      setSectionProposals({});
      setSectionError("");
    }
    setForm(prev => ({ ...prev, [key]: value }));
    if (key === "story") {
      // The full-story textarea and section editor must share one source of
      // truth. Otherwise an old section edit can overwrite newer story text.
      const sections = splitStory(value);
      sectionRevision.current += 1;
      // Full-story edits invalidate any pending section rewrite immediately.
      // Do not leave the regeneration button locked while obsolete AI work settles.
      regenerationRequest.current += 1;
      setRegeneratingSection(-1);
      setSectionError("");
      storySectionsRef.current = sections;
      setStorySections(sections);
      setSectionProposals({});
    }
  }
  async function save(e) {
    e.preventDefault();
    if (busy || loadingDraft || draftLoadError) return;
    setBusy(true); setError(""); setSaved("");
    try {
      const client = authClient();
      const { data: authData, error: authError } = await client.auth.getUser();
        const user = authData?.user;
      if (authError || !user) { navigate(`/login?next=${encodeURIComponent(draftId ? `/create?draft=${encodeURIComponent(draftId)}` : "/create")}`, { replace: true }); return; }
      const goalText = form.goal_amount.trim();
      const amount = Number(goalText);
      if (!goalText || !Number.isFinite(amount) || amount <= 0 || !/^\d+(?:\.\d{1,2})?$/.test(goalText)) throw new Error("Enter a positive fundraising goal in USD with no more than two decimal places.");
      const values = { title: form.title.trim(), summary: form.summary.trim(),
        story: form.story.trim(), category: form.category, goal_amount: amount,
        cover_image_url: form.cover_image_url.trim(), status: "draft" };
      const query = draftId
        ? client.from("ifund_campaigns").update(values).eq("id", draftId).eq("owner_id", user.id).eq("status", "draft")
        : client.from("ifund_campaigns").insert({ ...values, owner_id: user.id });
      const { data, error: insertError } = await query.select("id").single();
      if (insertError) throw insertError;
      setSaved(data.id);
      try { sessionStorage.removeItem(LOCAL_DRAFT_KEY); } catch { /* Saved remotely; storage cleanup is best-effort. */ }
      if (!draftId) navigate(`/create?draft=${encodeURIComponent(data.id)}`, { replace: true });
    } catch (err) { setError(err?.message || "Your draft could not be saved."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header><h1 className="font-display text-3xl font-bold">Create a campaign</h1><p className="mt-2 text-muted-foreground">Save your campaign story as a private draft. Publishing and donations remain unavailable until independently verified.</p></header>
    {loadingDraft && <p role="status">Loading your saved draft…</p>}
    {draftLoadError && <p role="alert" className="text-destructive">{draftLoadError}</p>}
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-8" aria-label="Campaign writing assistant">
      <h2 className="text-xl font-semibold">Campaign writing assistant</h2>
      <p className="text-sm text-muted-foreground">Get editable wording suggestions using the existing Supabase service. No paid AI, automatic saving, or publishing.</p>
      <label className="block font-semibold">What is your fundraiser about?
        <textarea rows={4} maxLength={1500} value={draftDetails} disabled={busy || loadingDraft || Boolean(draftLoadError)}
          onChange={e => { invalidateCampaignIdeas(); setDraftDetails(e.target.value); }} placeholder="Describe the situation and how funds would help."
          className="mt-2 w-full rounded-xl border border-input bg-background p-4" />
      </label>
      <label className="block font-semibold">Who benefits? (optional)
        <input maxLength={100} value={draftBeneficiary} disabled={busy || loadingDraft || Boolean(draftLoadError)}
          onChange={e => { invalidateCampaignIdeas(); setDraftBeneficiary(e.target.value); }} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>
      <label className="block font-semibold">What is needed? (optional)
        <input maxLength={100} value={draftNeed} disabled={busy || loadingDraft || Boolean(draftLoadError)}
          onChange={e => { invalidateCampaignIdeas(); setDraftNeed(e.target.value); }} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" />
      </label>
      <button type="button" onClick={suggestDraft}
        disabled={suggesting || busy || loadingDraft || Boolean(draftLoadError) || draftDetails.trim().length < 12}
        className="min-h-12 rounded-xl border border-border px-6 font-semibold disabled:opacity-50">
        {suggesting ? "Preparing ideas…" : "Generate campaign ideas"}
      </button>
      {suggestionError && <p role="alert" className="text-destructive">{suggestionError}</p>}
      {suggestions && <div aria-label="Campaign ideas" className="space-y-4" role="region">
        <p role="status" className="text-sm">Suggestions are ready. Choose which ideas to apply to the form below.</p>
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
          onClick={() => { change("story",suggestions.story); storySectionsRef.current = splitStory(suggestions.story); setStorySections(storySectionsRef.current); }}>Use story</button>
        <div className="space-y-4" aria-label="Story section editor">
          <p className="text-sm text-muted-foreground">Edit each section separately. Regeneration produces a suggestion for your review and never overwrites other sections.</p>
          {storySections.map((part, index) => <div key={index} className="space-y-2 rounded-xl border border-border p-4">
            <label className="block font-semibold">Section {index + 1}
              <textarea rows={5} value={part} onChange={e => editSection(index,e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-3" />
            </label>
            <button type="button" disabled={regeneratingSection !== -1 || suggesting || busy} onClick={() => regenerateSection(index)} className="rounded-xl border border-border px-4 py-2 disabled:opacity-50">
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
    </section>
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <label className="block font-semibold">Campaign title<input required maxLength={150} value={form.title} onChange={e=>change("title",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Short description<textarea required maxLength={1000} rows={3} value={form.summary} onChange={e=>change("summary",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Your story<textarea rows={8} value={form.story} onChange={e=>change("story",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Category<select value={form.category} onChange={e=>change("category",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4"><option value="community">Community</option><option value="medical">Medical</option><option value="education">Education</option><option value="environment">Environment</option><option value="creative">Creative</option><option value="other">Other</option></select></label>
      <label className="block font-semibold">Fundraising goal (USD)<input required min="0" step="0.01" type="number" value={form.goal_amount} onChange={e=>change("goal_amount",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Cover image URL (optional)<input type="url" maxLength={2000} value={form.cover_image_url} onChange={e=>change("cover_image_url",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {saved && <p role="status" className="rounded-xl border border-border p-4">Private draft saved. Reference: <code className="break-all">{saved}</code>. <Link to="/campaigns" className="underline">Manage and publish your campaigns</Link></p>}
      <button type="submit" disabled={busy || loadingDraft || Boolean(draftLoadError)} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save private draft"}</button>
    </form>
  </main>;
}
