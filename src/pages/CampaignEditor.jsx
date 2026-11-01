import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Sparkles, PenLine, Target, Image as ImageIcon, Save, Rocket } from "lucide-react";
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
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [draftBeneficiary, setDraftBeneficiary] = useState("");
  const [draftNeed, setDraftNeed] = useState("");
  const [draftResult, setDraftResult] = useState(null);
  const [imageTheme, setImageTheme] = useState(() => searchParams.get("imageTheme") || "Hopeful and warm");
  const [imageBrief, setImageBrief] = useState(() => (searchParams.get("imageBrief") || "").slice(0,1800));
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
      setMessage("Draft ready. Choose which suggestions to use; nothing has been saved.");
    } catch (e) {
      setError(true);
      setMessage(e.message || "Unable to prepare draft.");
    } finally {
      setDraftBusy(false);
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
      <div className="ifund-editor-hero"><p className="eyebrow">YOUR FUNDRAISING MISSION</p><h1>{id ? "Edit Your Mission" : "Launch a Mission"}</h1><p>Tell your story. Choose your goal. Share your cause.</p></div>
      <p>
        Save an incomplete draft at any time. Publishing validates the required
        fields.
      </p>
      <section className="card ifund-editor-section" aria-label="Campaign writing assistant">
        <h2><Sparkles size={22}/> 1. Tell us about your cause</h2>
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
            {draftResult.imagePrompt && (
              <details><summary>Illustration idea (no image generated)</summary>
                <p>{draftResult.imagePrompt}</p>
                <p>Suggested artwork theme: {imageTheme}</p>
              </details>
            )}
          </div>
        )}
      </section>
      <div className="form ifund-editor-form">
        <h2><PenLine size={22}/> 2. Describe your campaign</h2>
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
        <h2><Target size={22}/> 3. Set your goal</h2>
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
        <h2><ImageIcon size={22}/> 4. Add a picture</h2>
        <label>Artwork theme
          <select value={imageTheme} onChange={e => setImageTheme(e.target.value)} disabled={editorDisabled}>
            {["Hopeful and warm","Futuristic and cosmic","Community focused","Clean and professional","Playful and colorful"].map(t => <option key={t}>{t}</option>)}
          </select>
        </label>
        <p>Need an illustration idea? <Link to={"/ai-images?theme="+encodeURIComponent(imageTheme)+"&cause="+encodeURIComponent(form.summary || form.title || "")}>Open Cosmic Image Studio</Link> to prepare an image brief. Images are not generated automatically.</p>
        <label>Image brief (planning only; not included in the published campaign)
          <textarea rows="4" value={imageBrief} onChange={e => setImageBrief(e.target.value)} maxLength={1800} disabled={editorDisabled} placeholder="Your creative brief will appear here when you return from Cosmic Image Studio."/>
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
        <h2><Rocket size={22}/> 5. Save or publish</h2>
        <div className="actions ifund-editor-save">
          <button
            type="button"
            disabled={!canSaveCampaign({ id, loadedId, loadState, busy })}
            onClick={() => save("draft")}
          >
            <Save size={18}/> Save draft
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
