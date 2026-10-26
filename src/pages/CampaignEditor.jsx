import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../lib/supabase";
import {
  saveCampaignThroughWorker,
  workerCampaignApiEnabled,
} from "../lib/campaignApi";
import { validateCampaign, canSaveCampaign } from "../lib/validation";
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
function Editor({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
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
      .select("*")
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
  const wizardSteps = ["Your Details", "Basics", "Your Story", "Launch"];
  return (
    <main className="editor ifund-campaign-wizard">
      <header>
        <p className="eyebrow">Your fundraiser, your way</p>
        <h1>{id ? "Edit campaign" : "Create a campaign"}</h1>
        <p>Save an incomplete draft at any stage. Review all details before publishing.</p>
      </header>
      <nav aria-label="Campaign creation progress" className="ifund-wizard-progress">
        {wizardSteps.map((name, i) => (
          <button key={name} type="button" className={step === i ? "ifund-wizard-active" : ""}
            aria-current={step === i ? "step" : undefined}
            onClick={() => setStep(i)} disabled={editorDisabled || (id && loadState !== "ready")}>
            <span>{i + 1}</span>{name}
          </button>
        ))}
      </nav>
      <div className="form ifund-wizard-panel">
        {step === 0 && <section aria-labelledby="ifund-details-heading">
          <h2 id="ifund-details-heading">Your Details</h2>
          <p>Every fundraiser is associated with its verified creator. Your saved screen name and details can be managed in your profile.</p>
          <div className="card">
            <strong>Campaign creator</strong>
            <p>{user?.email || "Sign in required"}</p>
            <p><a href="/profile">Review your profile</a></p>
          </div>
          <p>Use the next steps to describe the purpose of your fundraiser. You can revise it before sharing.</p>
        </section>}
        {step === 1 && <section aria-labelledby="ifund-basics-heading">
          <h2 id="ifund-basics-heading">Basics</h2>
          <label>Title
            <input name="title" value={form.title || ""} onChange={change} disabled={editorDisabled} maxLength={180} />
          </label>
          <div className="ifund-ai-inline">
            <button type="button" disabled aria-describedby="ifund-ai-title-notice">Show five AI title options</button>
            <p id="ifund-ai-title-notice">AI choices require a verified independent generation service. Your title remains editable.</p>
          </div>
          <label>Category
            <select name="category" value={form.category} onChange={change} disabled={editorDisabled}>
              <option value="community">Community</option><option value="medical">Medical</option>
              <option value="emergency">Emergency</option><option value="education">Education</option>
              <option value="animals">Animals</option><option value="business">Business</option>
              <option value="creative">Creative</option><option value="other">Other</option>
            </select>
          </label>
          <label>Short description
            <textarea name="summary" disabled={editorDisabled} rows={3} value={form.summary || ""} onChange={change} />
          </label>
          <div className="ifund-ai-inline">
            <button type="button" disabled aria-describedby="ifund-ai-summary-notice">Show five AI description options</button>
            <p id="ifund-ai-summary-notice">AI generation is paused until secure provider credentials and quotas are configured.</p>
          </div>
          <label>Funding goal (USD)
            <input name="goal_amount" disabled={editorDisabled} inputMode="decimal" type="number" min="0"
              value={form.goal_amount ?? ""} onChange={change} />
          </label>
        </section>}
        {step === 2 && <section aria-labelledby="ifund-story-heading">
          <h2 id="ifund-story-heading">Your Story</h2>
          <label>Your campaign story
            <textarea name="story" disabled={editorDisabled} rows={10} value={form.story || ""} onChange={change} />
          </label>
          <div className="ifund-ai-inline">
            <h3>Story Forge</h3>
            <p>Tell the story in your own words. AI-assisted tone changes and revisions will be available after an independent, permission-controlled model is connected.</p>
            <button type="button" disabled>Forge my story</button>
          </div>
          <label>Campaign cover image URL (optional)
            <input type="url" name="cover_image_url" disabled={editorDisabled} value={form.cover_image_url || ""} onChange={change} />
          </label>
          {form.cover_image_url ? <div className="ifund-cover-preview"><img src={form.cover_image_url} alt="Campaign cover preview" onError={(event) => { event.currentTarget.hidden = true; }} /><p>Check that your image loads before publishing.</p></div> : null}
          <p className="ifund-route-notice">Image generation, direct uploads and paid watermark removal are not enabled until independently verified media storage and watermarking are in place.</p>
        </section>}
        {step === 3 && <section aria-labelledby="ifund-launch-heading">
          <h2 id="ifund-launch-heading">Review &amp; launch</h2>
          <div className="card ifund-review-card">
            <h3>{form.title || "Untitled campaign"}</h3>
            <p>{form.summary || "Add a short description."}</p>
            <p><strong>Category:</strong> {form.category}</p>
            <p><strong>Goal:</strong> {Number(form.goal_amount || 0).toLocaleString("en-US", { style: "currency", currency: "USD" })}</p>
            <p><strong>Story:</strong> {form.story || "Your story has not yet been added."}</p>
          </div>
          <p className="ifund-route-notice">Publishing your campaign makes its description public. Donations are unavailable until verified PayPal payment and ledger services are activated.</p>
        </section>}
        <div className="ifund-wizard-controls">
          <button type="button" className="secondary" disabled={step === 0 || busy} onClick={() => setStep((n) => Math.max(0, n - 1))}>Back</button>
          <button type="button" disabled={!canSaveCampaign({ id, loadedId, loadState, busy })} onClick={() => save("draft")}>{busy ? "Saving…" : "Save draft"}</button>
          {step < 3 ? <button className="primary" type="button" disabled={busy || (id && loadState !== "ready")} onClick={() => setStep((n) => Math.min(3, n + 1))}>Next: {wizardSteps[step + 1]}</button>
            : <button type="button" className="primary" disabled={!canSaveCampaign({ id, loadedId, loadState, busy })} onClick={() => save("active")}>Publish campaign</button>}
        </div>
        <Message error={error}>{message}</Message>
      </div>
    </main>
  );
}
export default Editor;
