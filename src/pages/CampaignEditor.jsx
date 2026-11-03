import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../lib/supabase";
import {
  saveCampaignThroughWorker,
  workerCampaignApiEnabled,
} from "../lib/campaignApi";
import { validateCampaign, canSaveCampaign } from "../lib/validation";
import { generateCampaignDraft } from "../lib/campaignDraft";
import { Message } from "../components/UI";
const empty = {
  title: "",
  summary: "",
  story: "",
  category: "community",
  goal_amount: "",
  cover_image_url: "",
  status: "draft",
};
const OWNER_CAMPAIGN_COLUMNS =
  "id,title,summary,story,category,goal_amount,cover_image_url,status";
function Editor({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [draftBeneficiary, setDraftBeneficiary] = useState("");
  const [draftNeed, setDraftNeed] = useState("");
  const [draftResult, setDraftResult] = useState(null);
  const [storyParts, setStoryParts] = useState([]);
  const [replacement, setReplacement] = useState(null);
  const [sectionBusy, setSectionBusy] = useState(-1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [loadState, setLoadState] = useState(id ? "loading" : "ready");
  const [loadedId, setLoadedId] = useState(null);
  const accountId = user?.id;
  useEffect(() => {
    if (!id) {
      setLoadedId(null);
      setForm(empty);
      setLoadState("ready");
      return;
    }
    setLoadState("loading");
    setLoadedId(null);
    setMessage("");
    if (!accountId || !db) {
      setLoadState("error");
      setError(true);
      setMessage("Sign in and configure the database before editing.");
      return;
    }
    let cancelled = false;
    db.from("ifund_campaigns")
      .select(OWNER_CAMPAIGN_COLUMNS)
      .eq("id", id)
      .eq("owner_id", accountId)
      .single()
      .then(({ data, error: e }) => {
        if (cancelled) return;
        if (e || !data) {
          setLoadState("error");
          setError(true);
          setMessage(e?.message || "Campaign not found");
          return;
        }
        setForm(data);
        setLoadedId(id);
        setError(false);
        setLoadState("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadedId(null);
        setLoadState("error");
        setError(true);
        setMessage(e?.message || "Campaign could not load");
      });
    return () => {
      cancelled = true;
    };
  }, [id, accountId]);
  const editorDisabled = Boolean(busy || (id && loadState !== "ready"));
  const change = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  async function prepareDraft() {
    if (!user || !db || editorDisabled || draftBusy) return;
    setDraftBusy(true);
    setError(false);
    setMessage("");
    setDraftResult(null);
    try {
      const suggestion = await generateCampaignDraft(db, {
        details: draftDescription,
        beneficiary: draftBeneficiary,
        need: draftNeed,
        cause: form.category,
        goal: form.goal_amount,
      });
      setDraftResult(suggestion);
      setStoryParts(String(suggestion.story || "").split(/\n\s*\n/).filter(Boolean));
      setReplacement(null);
      setMessage("Draft ready. Choose which suggestions to use; nothing has been saved.");
    } catch (e) {
      setError(true);
      setMessage(e.message || "Unable to prepare draft.");
    } finally {
      setDraftBusy(false);
    }
  }
  async function regenerateSection(index) {
    if (!db || !user || sectionBusy !== -1 || editorDisabled || draftBusy) return;
    setSectionBusy(index);
    setReplacement(null);
    setMessage("");
    try {
      const suggestion = await generateCampaignDraft(db, {
        details: ("Rewrite only this section, preserving the supplied facts: " +
          storyParts[index] + ". Campaign context: " + draftDescription).slice(0, 1500),
        beneficiary: draftBeneficiary,
        need: draftNeed,
        cause: form.category,
        goal: form.goal_amount,
      });
      const proposed = String(suggestion.story || "").split(/\n\s*\n/).find(Boolean);
      if (!proposed) throw new Error("No replacement was returned.");
      setReplacement({ index, text: proposed });
    } catch (e) {
      setError(true);
      setMessage(e.message || "Unable to regenerate section.");
    } finally {
      setSectionBusy(-1);
    }
  }
  async function save(status) {
    if (!canSaveCampaign({ id, loadedId, loadState, busy })) {
      setError(true);
      setMessage("Cannot save until campaign data loads successfully.");
      return;
    }
    if (!user) {
      navigate("/login");
      return;
    }
    const missing = validateCampaign(form, status === "active");
    if (missing.length) {
      setError(true);
      setMessage("Required to publish: " + missing.join(", "));
      return;
    }
    if (!db) {
      setError(true);
      setMessage(
        "Account services are not configured. Your changes remain in the editor.",
      );
      return;
    }
    setBusy(true);
    setError(false);
    setMessage("");
    const payload = {
      title: form.title,
      summary: form.summary,
      story: form.story,
      category: form.category,
      goal_amount: Number(form.goal_amount) || 0,
      cover_image_url: form.cover_image_url,
      status,
    };
    try {
      let savedId;
      if (workerCampaignApiEnabled) {
        savedId = await saveCampaignThroughWorker(db, payload, id);
      } else {
        const query = id
          ? db
              .from("ifund_campaigns")
              .update(payload)
              .eq("id", id)
              .eq("owner_id", user.id)
          : db
              .from("ifund_campaigns")
              .insert({ ...payload, owner_id: user.id });
        const { data, error: saveError } = await query.select("id").single();
        if (saveError) throw saveError;
        if (!data?.id) throw new Error("No saved campaign was returned.");
        savedId = data.id;
      }
      setMessage(status === "active" ? "Campaign published." : "Draft saved.");
      navigate("/edit/" + savedId, { replace: true });
    } catch (saveError) {
      setError(true);
      setMessage(
        "Could not save: " +
          (saveError?.message ||
            "Please try again. Your changes remain in the editor."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="editor">
      <h1>{id ? "Edit campaign" : "Create campaign"}</h1>
      <p>
        Save an incomplete draft at any time. Publishing validates the required
        fields.
      </p>
      <section className="card" aria-label="Campaign writing assistant">
        <h2>Campaign writing assistant</h2>
        <p>Describe your fundraiser and get editable story ideas. This uses the existing Supabase drafting service, not paid AI. Suggestions are never published automatically.</p>
        <label>
          What is happening, and why is support needed?
          <textarea rows="4" value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            disabled={editorDisabled || draftBusy} maxLength={1500}
            placeholder="Share specific details in your own words (at least 12 characters)." />
        </label>
        <label>
          Who benefits? (optional)
          <input value={draftBeneficiary} maxLength={100}
            disabled={editorDisabled || draftBusy}
            onChange={(e) => setDraftBeneficiary(e.target.value)} />
        </label>
        <label>
          What is needed? (optional)
          <input value={draftNeed} maxLength={100}
            disabled={editorDisabled || draftBusy}
            onChange={(e) => setDraftNeed(e.target.value)} />
        </label>
        <div className="actions">
          <button type="button" onClick={prepareDraft}
            disabled={editorDisabled || draftBusy || draftDescription.trim().length < 12}>
            {draftBusy ? "Preparing suggestions…" : "Generate draft"}
          </button>
        </div>
        {draftResult && (
          <div aria-label="Generated campaign suggestions" aria-live="polite">
            <h3>Choose a title</h3>
            {draftResult.titles.map((title, index) => (
              <div key={index} className="actions">
                <span>{title}</span>
                <button type="button" disabled={editorDisabled}
                  onClick={() => setForm((f) => ({ ...f, title }))}>Use title</button>
              </div>
            ))}
            <h3>Choose a summary</h3>
            {draftResult.summaries.map((summary, index) => (
              <div key={index} className="actions">
                <span>{summary}</span>
                <button type="button" disabled={editorDisabled}
                  onClick={() => setForm((f) => ({ ...f, summary }))}>Use summary</button>
              </div>
            ))}
            <h3>Suggested story</h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{draftResult.story}</p>
            <button type="button" disabled={editorDisabled}
              onClick={() => setForm((f) => ({ ...f, story: draftResult.story }))}>Use story</button>
            {storyParts.length > 0 && (
              <div aria-label="Story section editor">
                <h3>Refine your story, one section at a time</h3>
                {storyParts.map((part, index) => (
                  <div className="card" key={index}>
                    <label>Section {index + 1}
                      <textarea rows="5" value={part} disabled={editorDisabled || sectionBusy !== -1}
                        onChange={(e) => {
                          setStoryParts((previous) => previous.map((value, i) => i === index ? e.target.value : value));
                          setReplacement(null);
                        }} />
                    </label>
                    <button type="button" disabled={editorDisabled || sectionBusy !== -1 || draftBusy}
                      onClick={() => regenerateSection(index)}>
                      {sectionBusy === index ? "Regenerating…" : "Regenerate this section"}
                    </button>
                    {replacement?.index === index && (
                      <div aria-live="polite">
                        <p style={{ whiteSpace: "pre-wrap" }}>{replacement.text}</p>
                        <button type="button" onClick={() => {
                          setStoryParts((previous) => previous.map((value, i) => i === index ? replacement.text : value));
                          setReplacement(null);
                        }}>Accept replacement</button>
                        <button type="button" onClick={() => setReplacement(null)}>Discard</button>
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" disabled={editorDisabled || sectionBusy !== -1}
                  onClick={() => setForm((f) => ({ ...f, story: storyParts.join("\n\n") }))}>
                  Use edited story
                </button>
              </div>
            )}
            {draftResult.imagePrompt && (
              <details><summary>Illustration idea (no image generated)</summary>
                <p>{draftResult.imagePrompt}</p>
              </details>
            )}
          </div>
        )}
      </section>
      <div className="form">
        <label>
          Title
          <input
            name="title"
            value={form.title || ""}
            onChange={change}
            disabled={editorDisabled}
          />
        </label>
        <label>
          Category
          <select
            name="category"
            value={form.category}
            onChange={change}
            disabled={editorDisabled}
          >
            <option value="community">Community</option>
            <option value="medical">Medical</option>
            <option value="emergency">Emergency</option>
            <option value="education">Education</option>
            <option value="animals">Animals</option>
            <option value="business">Business</option>
            <option value="creative">Creative</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Summary
          <textarea
            name="summary"
            disabled={editorDisabled}
            rows="3"
            value={form.summary || ""}
            onChange={change}
          />
        </label>
        <label>
          Story
          <textarea
            name="story"
            disabled={editorDisabled}
            rows="8"
            value={form.story || ""}
            onChange={change}
          />
        </label>
        <label>
          Funding goal (USD)
          <input
            name="goal_amount"
            disabled={editorDisabled}
            inputMode="decimal"
            type="number"
            min="0"
            value={form.goal_amount ?? ""}
            onChange={change}
          />
        </label>
        <label>
          Cover image URL (optional)
          <input
            type="url"
            name="cover_image_url"
            disabled={editorDisabled}
            value={form.cover_image_url || ""}
            onChange={change}
          />
        </label>
        <div className="actions">
          <button
            type="button"
            disabled={!canSaveCampaign({ id, loadedId, loadState, busy })}
            onClick={() => save("draft")}
          >
            Save draft
          </button>
          <button
            type="button"
            className="primary"
            disabled={!canSaveCampaign({ id, loadedId, loadState, busy })}
            onClick={() => save("active")}
          >
            Publish campaign
          </button>
        </div>
        <Message error={error}>{message}</Message>
      </div>
    </main>
  );
}
export default Editor;
