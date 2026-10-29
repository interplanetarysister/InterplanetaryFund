import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";

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
        const { data, error: authError } = await client.auth.getUser();
        const user = data?.user;
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
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  function change(key, value) { setForm(prev => ({ ...prev, [key]: value })); }
  async function save(e) {
    e.preventDefault();
    if (busy || loadingDraft || draftLoadError) return;
    setBusy(true); setError(""); setSaved("");
    try {
      const client = authClient();
      const { data, error: authError } = await client.auth.getUser();
        const user = data?.user;
      if (authError || !user) { navigate("/login", { replace: true }); return; }
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
      if (!draftId) navigate(`/create?draft=${encodeURIComponent(data.id)}`, { replace: true });
    } catch (err) { setError(err?.message || "Your draft could not be saved."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header><h1 className="font-display text-3xl font-bold">Create a campaign</h1><p className="mt-2 text-muted-foreground">Save your campaign story as a private draft. Publishing and donations remain unavailable until independently verified.</p></header>
    {loadingDraft && <p role="status">Loading your saved draft…</p>}
    {draftLoadError && <p role="alert" className="text-destructive">{draftLoadError}</p>}
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <label className="block font-semibold">Campaign title<input required maxLength={150} value={form.title} onChange={e=>change("title",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Short description<textarea required maxLength={1000} rows={3} value={form.summary} onChange={e=>change("summary",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Your story<textarea rows={8} value={form.story} onChange={e=>change("story",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Category<select value={form.category} onChange={e=>change("category",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4"><option value="community">Community</option><option value="medical">Medical</option><option value="education">Education</option><option value="environment">Environment</option><option value="creative">Creative</option><option value="other">Other</option></select></label>
      <label className="block font-semibold">Fundraising goal (USD)<input required min="0" step="0.01" type="number" value={form.goal_amount} onChange={e=>change("goal_amount",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Cover image URL (optional)<input type="url" maxLength={2000} value={form.cover_image_url} onChange={e=>change("cover_image_url",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {saved && <p role="status" className="rounded-xl border border-border p-4">Private draft saved. Reference: <code className="break-all">{saved}</code>. <Link to="/dashboard" className="underline">Dashboard</Link></p>}
      <button type="submit" disabled={busy || loadingDraft || Boolean(draftLoadError)} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save private draft"}</button>
    </form>
  </main>;
}
