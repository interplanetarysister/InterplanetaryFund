import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { db } from "../lib/supabase";
import { validateCampaign, canSaveCampaign } from "../lib/validation";
import { Loading, Message } from "../components/UI";

const steps = ["Your Details", "Basics", "Your Story", "Launch"];
const categories = {
  medical: "Medical", emergency: "Emergency", education: "Education",
  community: "Community", animals: "Animals", business: "Business",
  memorial: "Memorial", disaster_relief: "Disaster Relief",
  creative: "Creative", environment: "Planet & Environment", other: "Other",
};
const blankProfile = {
  primary_goal: "", who_helping: "", tone: "", donor_discovery_notes: "",
  never_change: "", always_emphasize: "", avoid_words: "", long_term_outcome: "",
  platforms: [],
};
const blank = {
  title: "", summary: "", story: "", category: "other", goal_amount: "",
  cover_image_url: "", cover_image_is_ai: false, status: "draft",
  end_date: "", location: "", accept_crypto_donations: false,
  draft_step: 0, ai_profile: blankProfile, story_versions: [],
};
const channels = ["Facebook", "Instagram", "TikTok", "LinkedIn", "Twitter/X", "Email", "Other"];

export default function CampaignEditor({ user }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const campaignId = id || params.get("draft");
  const navigate = useNavigate();
  const [form, setForm] = useState(blank);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadState, setLoadState] = useState(campaignId ? "loading" : "ready");
  const [loadedId, setLoadedId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [suggestions, setSuggestions] = useState({ title: [], summary: [] });
  const [aiBusy, setAiBusy] = useState("");
  const savingRef = useRef(false);
  const accountId = user?.id;
  const enabledAI = import.meta.env.VITE_CAMPAIGN_ASSISTANT_ENABLED === "true";
  const canSave = Boolean(db && accountId && canSaveCampaign({
    id: campaignId, loadedId, loadState, busy: busy || uploading,
  }));
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setAI = (key, value) => setForm((f) => ({
    ...f, ai_profile: { ...f.ai_profile, [key]: value },
  }));
  useEffect(() => {
    if (!campaignId) {
      setForm(blank); setStep(0); setLoadedId(null); setLoadState("ready");
      return;
    }
    if (!db || !accountId) {
      setLoadState("error"); setError(true);
      setMessage("Sign in and configure the campaign database before editing.");
      return;
    }
    let cancelled = false;
    setLoadedId(null); setLoadState("loading"); setMessage("");
    db.from("ifund_campaigns").select("*").eq("id", campaignId).eq("owner_id", accountId)
      .maybeSingle().then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError || !data) {
          setLoadState("error"); setError(true);
          setMessage(loadError?.message || "Campaign not found for this account.");
          return;
        }
        setForm({
          ...blank, ...data,
          goal_amount: data.goal_amount > 0 ? String(data.goal_amount) : "",
          end_date: data.end_date ? String(data.end_date).slice(0, 10) : "",
          ai_profile: { ...blankProfile, ...(data.ai_profile || {}) },
          story_versions: Array.isArray(data.story_versions) ? data.story_versions : [],
        });
        setStep(Math.min(3, Math.max(0, Number(data.draft_step) || 0)));
        setLoadedId(campaignId); setLoadState("ready"); setError(false);
      }).catch((cause) => {
        if (cancelled) return;
        setLoadState("error"); setError(true);
        setMessage(cause?.message || "Could not load this campaign.");
      });
    return () => { cancelled = true; };
  }, [campaignId, accountId]);

  async function save(publish = false) {
    if (savingRef.current || !canSave) return;
    if (!user) { navigate("/login"); return; }
    const status = publish || form.status === "active" ? "active" : "draft";
    const missing = validateCampaign(form, status === "active");
    if (missing.length) {
      setError(true); setMessage("Required to publish: " + missing.join(", "));
      return;
    }
    savingRef.current = true; setBusy(true); setError(false); setMessage("");
    const story = String(form.story || "").trim();
    const payload = {
      title: String(form.title || "").trim(),
      summary: String(form.summary || "").trim() || story.replace(/\s+/g, " ").slice(0, 220),
      story, category: form.category,
      goal_amount: form.goal_amount === "" ? 0 : Number(form.goal_amount),
      cover_image_url: String(form.cover_image_url || "").trim(),
      end_date: form.end_date || null, location: String(form.location || "").trim(),
      ai_profile: form.ai_profile, story_versions: form.story_versions,
      draft_step: step, cover_image_is_ai: Boolean(form.cover_image_is_ai),
      accept_crypto_donations: Boolean(form.accept_crypto_donations), status,
    };
    try {
      if (!Number.isFinite(payload.goal_amount) || payload.goal_amount < 0)
        throw new Error("Enter a valid funding goal.");
      const request = campaignId
        ? db.from("ifund_campaigns").update(payload).eq("id", campaignId).eq("owner_id", accountId)
        : db.from("ifund_campaigns").insert({ ...payload, owner_id: accountId });
      const { data, error: saveError } = await request.select("id").single();
      if (saveError || !data?.id) throw new Error(saveError?.message || "Save rejected");
      set("status", status);
      setMessage(status === "active" ? "Campaign published." : "Private draft saved.");
      if (publish) navigate("/campaign/" + data.id);
      else if (!campaignId) navigate("/create?draft=" + encodeURIComponent(data.id), { replace: true });
    } catch (cause) {
      setError(true); setMessage("Campaign not saved: " + (cause?.message || "Please retry."));
    } finally {
      savingRef.current = false; setBusy(false);
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !db || !user || uploading) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024) {
      setError(true); setMessage("Choose a JPG, PNG or WebP photo under 8 MB."); return;
    }
    setUploading(true); setMessage("");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = user.id + "/" + crypto.randomUUID() + "." + ext;
    try {
      const { error: uploadError } = await db.storage.from("ifund-campaign-covers")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data } = db.storage.from("ifund-campaign-covers").getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Cover URL unavailable");
      setForm((f) => ({ ...f, cover_image_url: data.publicUrl, cover_image_is_ai: false }));
      setError(false); setMessage("Photo uploaded. Save to attach it to your draft.");
    } catch (cause) {
      setError(true); setMessage("Photo upload failed: " + (cause?.message || "Unknown error."));
    } finally { setUploading(false); }
  }

  async function suggest(field) {
    if (!enabledAI || aiBusy || !canSave) return;
    setAiBusy(field); setMessage("");
    try {
      const { data, error: requestError } = await db.functions.invoke("campaign-copy", {
        body: { field, title: form.title, summary: form.summary, story: form.story,
          category: form.category, ai_profile: form.ai_profile },
      });
      if (requestError) throw requestError;
      const options = Array.isArray(data?.options)
        ? [...new Set(data.options.filter((s) => typeof s === "string").map((s) => s.trim()).filter(Boolean))] : [];
      if (options.length !== 5) throw new Error("The assistant did not return five distinct options.");
      setSuggestions((s) => ({ ...s, [field]: options }));
    } catch (cause) {
      setError(true); setMessage("AI suggestions unavailable: " + (cause?.message || "Unknown error."));
    } finally { setAiBusy(""); }
  }

  if (loadState === "loading") return <main className="editor"><Loading /></main>;
  if (loadState === "error") return <main className="editor"><h1>Unable to open campaign</h1>
    <Message error>{message}</Message><Link to="/mine">My campaigns</Link></main>;

  return (
    <main className="editor campaign-quest">
      <Link to="/mine" className="text-button">← My campaigns</Link>
      <ol className="quest-steps" aria-label={"Campaign setup: step " + (step + 1) + " of 4"}>
        {steps.map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined}
          className={index === step ? "current" : index < step ? "complete" : ""}>
          <span className="quest-step-icon">{index < step ? "✓" : index + 1}</span><span>{label}</span>
        </li>)}
      </ol>
      <h1>{["Tell us what matters", "Set the campaign basics", "Choose your words and story", "Review & launch"][step]}</h1>
      <p className="quest-intro">{[
        "Give your campaign a spark. Everything here is optional.",
        "Just the essentials. You can fine-tune the rest later.",
        "Pick a title, a description, then create your story.",
        "One last look before your campaign enters orbit.",
      ][step]}</p>
      <section className="quest-panel">
        {step === 0 && <div className="form">
          <h2>Give AI the signal</h2>
          <p>A couple clues help. Your instructions are stored with your campaign.</p>
          {[
            ["primary_goal", "What are we making possible?"],
            ["who_helping", "Who or what is this for?"],
            ["donor_discovery_notes", "Who might want to support this campaign?"],
          ].map(([key, label]) => <label key={key}>{label}
            <textarea rows="2" value={form.ai_profile[key] || ""}
              onChange={(e) => setAI(key, e.target.value)} /></label>)}
          <label>What vibe feels right?
            <select value={form.ai_profile.tone || ""} onChange={(e) => setAI("tone", e.target.value)}>
              <option value="">Let AI choose</option>
              {["Warm", "Emotional", "Hopeful", "Professional", "Urgent", "Factual", "Conversational"]
                .map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <details className="quest-extras"><summary>More AI controls (optional)</summary>
            {[
              ["never_change", "What facts must stay exact?"],
              ["always_emphasize", "What should always be emphasized?"],
              ["avoid_words", "Words or topics to avoid"],
              ["long_term_outcome", "What long-term outcome are you hoping for?"],
            ].map(([key, label]) => <label key={key}>{label}
              <textarea rows="2" value={form.ai_profile[key] || ""}
                onChange={(e) => setAI(key, e.target.value)} /></label>)}
            <fieldset className="quest-platforms"><legend>Where might you share it?</legend>
              {channels.map((p) => <label key={p}><input type="checkbox"
                checked={(form.ai_profile.platforms || []).includes(p)}
                onChange={(e) => setAI("platforms", e.target.checked
                  ? [...(form.ai_profile.platforms || []), p]
                  : (form.ai_profile.platforms || []).filter((v) => v !== p))} />{p}</label>)}
            </fieldset>
          </details>
        </div>}
        {step === 1 && <div className="form">
          <h2>Launch basics</h2>
          <div className="quest-columns"><label>What kind?
            <select name="category" value={form.category} onChange={change}>
              {Object.entries(categories).map(([key, label]) =>
                <option key={key} value={key}>{label}</option>)}
            </select></label><label>Goal (USD)
              <input type="number" name="goal_amount" min="0" inputMode="decimal"
                value={form.goal_amount} onChange={change} placeholder="5000" />
            </label></div>
          <label className="quest-toggle"><input type="checkbox"
            checked={Boolean(form.accept_crypto_donations)}
            onChange={(e) => set("accept_crypto_donations", e.target.checked)} />
            <span>Allow cryptocurrency donations
              <small>Only after verified settlement setup. This does not activate coin acceptance.</small>
            </span></label>
          <details className="quest-extras"><summary>Add extras (optional)</summary>
            <label>Deadline<input type="date" name="end_date" value={form.end_date || ""} onChange={change} /></label>
            <label>Where is this happening?<input name="location"
              placeholder="City, state" value={form.location || ""} onChange={change} /></label>
          </details>
        </div>}
        {step === 2 && <div className="form">
          {[
            ["title", "1. Pick a title", "My campaign title"],
            ["summary", "2. Pick a short description", "One sentence about your campaign"],
          ].map(([key, heading, placeholder]) => <section key={key} className="quest-copy">
            <h2>{heading}</h2><label>Your {key === "title" ? "title" : "description"}
              <input name={key} value={form[key] || ""} onChange={change} placeholder={placeholder}
                maxLength={key === "title" ? 160 : 500} /></label>
            <button type="button" className="secondary" disabled={!enabledAI || !!aiBusy || !canSave}
              onClick={() => suggest(key)}>
              {aiBusy === key ? "Generating…" : "Show five AI options"}
            </button>
            {!enabledAI && <small>AI suggestions require a verified independent assistant connection.</small>}
            {suggestions[key].map((value, index) =>
              <button key={value} type="button" className="quest-choice"
                onClick={() => { set(key, value); if (key === "title") setSuggestions((s) => ({ ...s, summary: [] })); }}>
                {index + 1}. {value}</button>)}
          </section>)}
          <section className="quest-copy"><h2>3. Make your story</h2>
            <label>Your campaign story<textarea name="story" rows="9" value={form.story || ""}
              onChange={change} placeholder="Write your story in your own words." /></label>
            <button type="button" className="secondary" disabled={!form.story?.trim()}
              onClick={() => {
                set("story_versions", [...(form.story_versions || []), { text: form.story,
                  saved_at: new Date().toISOString() }].slice(-20));
                setError(false); setMessage("Story version kept in this draft. Save to preserve it.");
              }}>Keep this version</button>
            {!!form.story_versions?.length && <details className="quest-extras">
              <summary>Previous story versions ({form.story_versions.length})</summary>
              {form.story_versions.map((v, index) =>
                <button type="button" key={index} className="quest-choice"
                  onClick={() => set("story", v.text)}>Restore version {index + 1}</button>)}
            </details>}
          </section>
          <section className="quest-copy"><h2>Campaign art</h2>
            {form.cover_image_url && <img src={form.cover_image_url} className="quest-cover" alt="Campaign cover preview" />}
            <label>Cover image URL (optional)<input type="url" name="cover_image_url"
              value={form.cover_image_url || ""} onChange={change} /></label>
            <label>Upload your own photo<input type="file" accept="image/jpeg,image/png,image/webp"
              disabled={busy || uploading} onChange={upload} /></label>
            <small>Cover art is optional; uploaded photos use secure campaign storage.</small>
          </section>
        </div>}
        {step === 3 && <div className="quest-preview">
          {form.cover_image_url && <img src={form.cover_image_url} className="quest-cover" alt="Campaign cover" />}
          <small>{categories[form.category] || "Other"}</small>
          <h2>{form.title || "Untitled campaign"}</h2>
          <p>{form.summary || "A summary will be taken from your story if left blank."}</p>
          <strong>{"Goal: $" + Number(form.goal_amount || 0).toLocaleString()}</strong>
          {form.end_date && <p>Ends {form.end_date}</p>}
          {form.location && <p>Location: {form.location}</p>}
          <h3>Campaign story</h3><p className="quest-story">{form.story}</p>
        </div>}
      </section>
      <div className="quest-save">
        <button type="button" className="secondary" disabled={!canSave} onClick={() => save(false)}>
          {busy ? "Saving…" : form.status === "active" ? "Save changes" : "Save draft"}
        </button>
        <small>Save at any step. Drafts stay private until published.</small>
      </div>
      <Message error={error}>{message}</Message>
      <div className="quest-nav">
        <button type="button" className="secondary" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>← Back</button>
        {step === 3 ? <button type="button" className="primary" disabled={!canSave}
          onClick={() => save(true)}>{busy ? "Publishing…" : form.status === "active" ? "Update campaign" : "Launch campaign"}</button>
          : <button type="button" className="primary" disabled={busy || uploading ||
              (step === 1 && !(Number(form.goal_amount) > 0)) ||
              (step === 2 && !form.title?.trim())}
              onClick={() => setStep((s) => s + 1)}>Continue →</button>}
      </div>
    </main>
  );
}
