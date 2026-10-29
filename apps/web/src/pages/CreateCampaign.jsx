import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  const [loadingDraft, setLoadingDraft] = useState(Boolean(draftId));
  const [draftLoadError, setDraftLoadError] = useState("");
  useEffect(() => {
    if (!draftId) { setLoadingDraft(false); setDraftLoadError(""); setError(""); setSaved(""); setForm({ title: "", summary: "", story: "", category: "community", goal_amount: "", cover_image_url: "" }); return; }
    setLoadingDraft(true); setDraftLoadError(""); setSaved(""); setError("");
    let active = true;
    (async () => {
      try {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(draftId)) throw new Error("Invalid draft reference.");
        const client = authClient();
        const { data: authData, error: authError } = await client.auth.getUser();
        const user = authData?.user;
        if (authError || !user) { navigate("/login", { replace: true }); return; }
        const { data, error: fetchError } = await client.from("ifund_campaigns").select("title,summary,story,category,goal_amount,cover_image_url,status").eq("id",draftId).eq("owner_id",user.id).eq("status","draft").single();
        if (fetchError || !data) throw new Error("Draft not found or access denied.");
        if (active) setForm({ title:data.title||"", summary:data.summary||"", story:data.story||"", category:data.category||"community", goal_amount:String(data.goal_amount??""), cover_image_url:data.cover_image_url||"" });
      } catch (err) { if (active) setDraftLoadError(err?.message || "Unable to load draft."); }
      finally { if (active) setLoadingDraft(false); }
    })();
    return () => { active = false; };
  }, [draftId,navigate]);
  const [form, setForm] = useState({ title: "", summary: "", story: "", category: "community", goal_amount: "", cover_image_url: "" });
  const [busy, setBusy] = useState(false);
  const draftRevision = useRef(0);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  function change(key, value) { if (savingRef.current) return; draftRevision.current += 1; setSaved(""); setError(""); setForm(prev => ({ ...prev, [key]: value })); }
  async function save(e) {
    e.preventDefault();
    if (savingRef.current || loadingDraft || draftLoadError) return;
    savingRef.current = true;
    setBusy(true); setError(""); setSaved("");
    try {
      const revisionAtStart = draftRevision.current;
      const client = authClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      const user = authData?.user;
      if (authError || !user) { navigate("/login", { replace: true }); return; }
      const goalText = form.goal_amount.trim();
      const amount = Number(goalText);
      if (!goalText || !Number.isFinite(amount) || amount < 0.01 || amount > 100000000 || !/^\d+(?:\.\d{1,2})?$/.test(goalText)) throw new Error("Enter a positive fundraising goal in USD with no more than two decimal places.");
      const title = form.title.trim();
      const summary = form.summary.trim();
      if (!title || title.length > 150) throw new Error("Enter a campaign title (up to 150 characters).");
      if (!summary || summary.length > 1000) throw new Error("Enter a short description (up to 1,000 characters).");
      const coverUrl = form.cover_image_url.trim();
      if (coverUrl) {
        let parsed;
        try { parsed = new URL(coverUrl); } catch { throw new Error("Enter a valid cover image URL."); }
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || coverUrl.length > 2000) throw new Error("Cover image must use a secure HTTPS URL without embedded credentials.");
      }
      if (form.story.length > 20000) throw new Error("Campaign story must be 20,000 characters or fewer.");
      if (!["community", "medical", "emergency", "education", "environment", "creative", "other", "animals", "business", "memorial", "disaster_relief"].includes(form.category)) throw new Error("Select a valid campaign category.");
      const values = { title, summary,
        story: form.story.trim(), category: form.category, goal_amount: amount,
        cover_image_url: coverUrl, status: "draft" };
      const query = draftId
        ? client.from("ifund_campaigns").update(values).eq("id", draftId).eq("owner_id", user.id).eq("status", "draft")
        : client.from("ifund_campaigns").insert({ ...values, owner_id: user.id });
      const { data, error: insertError } = await query.select("id").single();
      if (insertError) throw new Error("Unable to save the campaign draft. Please retry.");
      if (!data?.id) throw new Error("Draft save did not return a campaign reference.");
      setSaved(data.id);
      if (!draftId) navigate(`/create?draft=${encodeURIComponent(data.id)}`, { replace: true });
    } catch (err) { setError(err?.message || "Your draft could not be saved."); }
    finally { savingRef.current = false; setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header><h1 className="font-display text-3xl font-bold">Create a campaign</h1><p className="mt-2 text-muted-foreground">Save your campaign story as a private draft. Publishing and donations remain unavailable until independently verified.</p></header>
    {loadingDraft && <p role="status" aria-live="polite">Loading your saved draft…</p>}
    {draftLoadError && <p role="alert" className="text-destructive">{draftLoadError}</p>}
    <form onSubmit={save} aria-busy={busy || loadingDraft} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <fieldset disabled={busy || loadingDraft || Boolean(draftLoadError)} className="space-y-5">
      <label className="block font-semibold">Campaign title<input required maxLength={150} value={form.title} onChange={e=>change("title",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Short description<textarea required maxLength={1000} rows={3} value={form.summary} onChange={e=>change("summary",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Your story<textarea rows={8} maxLength={20000} value={form.story} onChange={e=>change("story",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Category<select value={form.category} onChange={e=>change("category",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4"><option value="community">Community</option><option value="medical">Medical</option><option value="emergency">Emergency</option><option value="education">Education</option><option value="animals">Animals</option><option value="environment">Environment</option><option value="business">Business</option><option value="creative">Creative</option><option value="memorial">Memorial</option><option value="disaster_relief">Disaster Relief</option><option value="other">Other</option></select></label>
      <label className="block font-semibold">Fundraising goal (USD)<input required min="0.01" max="100000000" step="0.01" type="number" value={form.goal_amount} onChange={e=>change("goal_amount",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Cover image URL (optional)<input type="url" inputMode="url" maxLength={2000} value={form.cover_image_url} onChange={e=>change("cover_image_url",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      </fieldset>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {saved && <p role="status" className="rounded-xl border border-border p-4">Private draft saved. Reference: <code className="break-all">{saved}</code>. <Link to="/dashboard" className="underline">Dashboard</Link></p>}
      <button type="submit" disabled={busy || loadingDraft || Boolean(draftLoadError)} aria-disabled={busy || loadingDraft || Boolean(draftLoadError)} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save private draft"}</button>
    </form>
  </main>;
}
