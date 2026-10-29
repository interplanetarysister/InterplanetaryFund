import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import { persistCampaignContent } from "@/lib/campaignPublication";

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
  async function save(e, publish = false) {
    e?.preventDefault?.();
    if (busy || loadingDraft || draftLoadError) return;
    setBusy(true); setError(""); setSaved("");
    try {
      const outcome = await persistCampaignContent(authClient(), form, { id: draftId || null, publish });
      if (publish) {
        navigate("/campaign/" + encodeURIComponent(outcome.id), { replace: true });
      } else {
        setSaved(outcome.id);
        if (!draftId) navigate("/create?draft=" + encodeURIComponent(outcome.id), { replace: true });
      }
    } catch (cause) {
      setError(cause?.message || "The campaign could not be saved.");
    } finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header><h1 className="font-display text-3xl font-bold">Create a campaign</h1><p className="mt-2 text-muted-foreground">Save your campaign story as a private draft. Save privately at any step, or publish a complete campaign for public discovery. Campaign donations and withdrawal processing remain paused until provider accounting is verified.</p></header>
    {loadingDraft && <p role="status">Loading your saved draft…</p>}
    {draftLoadError && <p role="alert" className="text-destructive">{draftLoadError}</p>}
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <label className="block font-semibold">Campaign title<input maxLength={120} value={form.title} onChange={e=>change("title",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Short description<textarea maxLength={600} rows={3} value={form.summary} onChange={e=>change("summary",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Your story<textarea maxLength={15000} rows={8} value={form.story} onChange={e=>change("story",e.target.value)} className="mt-2 w-full rounded-xl border border-input bg-background p-4" /></label>
      <label className="block font-semibold">Category<select value={form.category} onChange={e=>change("category",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4">{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block font-semibold">Fundraising goal (USD)<input min="0" step="0.01" type="number" value={form.goal_amount} onChange={e=>change("goal_amount",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      <label className="block font-semibold">Cover image URL (optional)<input type="url" maxLength={2000} value={form.cover_image_url} onChange={e=>change("cover_image_url",e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4" /></label>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {saved && <p role="status" className="rounded-xl border border-border p-4">Private draft saved. Reference: <code className="break-all">{saved}</code>. <Link to="/dashboard" className="underline">Dashboard</Link></p>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy || loadingDraft || Boolean(draftLoadError)} className="min-h-12 rounded-xl border border-primary px-6 font-semibold text-primary disabled:opacity-50">{busy ? "Saving…" : "Save private draft"}</button><button type="button" onClick={() => save(null, true)} disabled={busy || loadingDraft || Boolean(draftLoadError)} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">Publish campaign</button></div><p className="text-sm text-muted-foreground">Publishing makes your campaign story public. It does not activate campaign checkout, collect money, or authorize automated sharing.</p>
    </form>
  </main>;
}
