import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../lib/supabase";
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
  // Avoid replacing user-entered data with a late response for an existing record.
  const editorDisabled = Boolean(id && loadState !== "ready");
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
    const query = id
      ? db
          .from("ifund_campaigns")
          .update(payload)
          .eq("id", id)
          .eq("owner_id", user.id)
      : db.from("ifund_campaigns").insert({ ...payload, owner_id: user.id });
    const { data, error: e } = await query.select("id").single();
    setBusy(false);
    if (e) {
      setError(true);
      setMessage("Could not save: " + e.message);
      return;
    }
    setMessage(status === "active" ? "Campaign published." : "Draft saved.");
    navigate("/edit/" + data.id, { replace: true });
  }
  return (
    <main className="editor">
      <h1>{id ? "Edit campaign" : "Create campaign"}</h1>
      <p>
        Save an incomplete draft at any time. Publishing validates the required
        fields.
      </p>
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
