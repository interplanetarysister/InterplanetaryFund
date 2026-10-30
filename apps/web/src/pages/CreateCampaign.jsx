import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "@/api/auth";
import { categoryLabels } from "@/components/campaigns/CampaignCard";
import { persistCampaignContent } from "@/lib/campaignPublication";

const STEPS = [
  { label: "Your Details", title: "Your campaign starts here", description: "Your signed-in account owns this private draft. You can save progress and return at any time." },
  { label: "Basics", title: "Set the campaign basics", description: "Give your campaign a clear title, choose its category, and set a fundraising goal." },
  { label: "Your Story", title: "Tell people why it matters", description: "Write a short introduction and the full story people will see when your campaign is published." },
  { label: "Launch", title: "Review before launch", description: "Check the public details and optional cover image before publishing." },
];
const EMPTY = { title: "", summary: "", story: "", category: "community", goal_amount: "", cover_image_url: "" };

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const draftId = params.get("draft");
  const [step, setStep] = useState(0);
  const [account, setAccount] = useState(null);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(draftId));
  const [draftLoadError, setDraftLoadError] = useState("");
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error } = await authClient().auth.getUser();
        if (error || !data?.user) { navigate("/login", { replace: true }); return; }
        if (active) setAccount({ email: data.user.email || "", name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || "" });
      } catch { if (active) setDraftLoadError("We could not verify your account. Refresh and sign in again."); }
    })();
    return () => { active = false; };
  }, [navigate]);

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
        const { data, error } = await client.from("ifund_campaigns").select("title,summary,story,category,goal_amount,cover_image_url,status").eq("id", draftId).eq("owner_id",user.id).eq("status","draft").single();
        if (error || !data) throw new Error("Draft not found or access denied.");
        if (active) setForm({ title: data.title || "", summary: data.summary || "", story: data.story || "", category: data.category || "community", goal_amount: String(data.goal_amount ?? ""), cover_image_url: data.cover_image_url || "" });
      } catch (err) { if (active) setDraftLoadError(err?.message || "Unable to load draft."); }
      finally { if (active) setLoadingDraft(false); }
    })();
    return () => { active = false; };
  }, [draftId, navigate]);

  const change = (key, value) => setForm(previous => ({ ...previous, [key]: value }));
  const canContinue = step === 1 ? Boolean(form.title.trim()) && Number(form.goal_amount) > 0 : step === 2 ? Boolean(form.story.trim()) : true;

  async function save(e, publish = false) {
    e?.preventDefault?.();
    if (busy || loadingDraft || draftLoadError) return;
    setBusy(true); setError(""); setSaved("");
    try {
      const outcome = await persistCampaignContent(authClient(), form, { id: draftId || null, publish });
      if (publish) navigate("/campaign/" + encodeURIComponent(outcome.id), { replace: true });
      else {
        setSaved(outcome.id);
        if (!draftId) navigate("/create?draft=" + encodeURIComponent(outcome.id), { replace: true });
      }
    } catch (cause) { setError(cause?.message || "The campaign could not be saved."); }
    finally { setBusy(false); }
  }

  const current = STEPS[step];
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header>
      <p className="text-xs font-semibold uppercase tracking-[.2em] text-primary">Interplanetary Fund · Campaign creator</p>
      <h1 className="mt-2 font-display text-3xl font-bold">Create a campaign</h1>
      <p className="mt-2 text-muted-foreground">Build your campaign step by step. Save privately at any point. Publishing makes your story public; donations and withdrawals remain paused until payment and provider accounting are verified.</p>
    </header>
    <nav aria-label={`Campaign setup: step ${step + 1} of 4`} className="grid grid-cols-4 gap-2">
      {STEPS.map((item, index) => <button key={item.label} type="button" onClick={() => index < step && setStep(index)} aria-current={index === step ? "step" : undefined} className={`min-w-0 rounded-xl border p-2 text-center text-xs sm:text-sm ${index === step ? "border-primary bg-primary/10 font-semibold text-foreground" : index < step ? "border-primary/40 text-foreground" : "border-border text-muted-foreground"}`}><span className="block text-[10px] opacity-70">STEP {index + 1}</span>{item.label}</button>)}
    </nav>
    {loadingDraft && <p role="status">Loading your saved draft…</p>}
    {draftLoadError && <p role="alert" className="text-destructive">{draftLoadError}</p>}
    <form onSubmit={e => { e.preventDefault(); if (step < 3) setStep(value => Math.min(3, value + 1)); else save(null, true); }} className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8">
      <section className="space-y-2"><h2 className="font-display text-2xl font-bold">{current.title}</h2><p className="text-muted-foreground">{current.description}</p></section>
      {step === 0 && <section className="space-y-4">
        <div className="rounded-xl border border-border bg-background p-4"><h3 className="font-semibold">Campaign owner</h3>{account?.name && <p className="mt-1">{account.name}</p>}<p className="text-sm text-muted-foreground">{account?.email || "Verifying your signed-in account…"}</p><p className="mt-3 text-sm text-muted-foreground">Your account owns this campaign. Your email is not displayed on its public page by this form.</p></div>
        <p className="text-sm text-muted-foreground">You can create a campaign for a person, community, cause, or project. Only information you add to the campaign title, description, story, and cover is included in its public presentation.</p>
      </section>}
      {step === 1 && <section className="space-y-4">
        <label className="block font-semibold">Campaign title<input required maxLength={120} value={form.title} onChange={e => change("title", e.target.value)} placeholder="What are you making possible?" className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4 font-normal" /></label>
        <label className="block font-semibold">Category<select value={form.category} onChange={e => change("category", e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4 font-normal">{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="block font-semibold">Fundraising goal (USD)<input required min="0.01" step="0.01" type="number" value={form.goal_amount} onChange={e => change("goal_amount", e.target.value)} placeholder="5000" className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4 font-normal" /></label>
      </section>}
      {step === 2 && <section className="space-y-4">
        <label className="block font-semibold">Short description<textarea maxLength={600} rows={3} value={form.summary} onChange={e => change("summary", e.target.value)} placeholder="A few sentences that explain your campaign." className="mt-2 w-full rounded-xl border border-input bg-background p-4 font-normal" /><span className="mt-1 block text-xs font-normal text-muted-foreground">{form.summary.length}/600 characters</span></label>
        <label className="block font-semibold">Your campaign story<textarea required maxLength={15000} rows={10} value={form.story} onChange={e => change("story", e.target.value)} placeholder="Tell people what happened, what you hope to accomplish, and how support will help." className="mt-2 w-full rounded-xl border border-input bg-background p-4 font-normal" /><span className="mt-1 block text-xs font-normal text-muted-foreground">{form.story.length}/15,000 characters</span></label>
        <div className="rounded-xl border border-border p-4"><p className="font-semibold">AI writing assistance</p><p className="mt-1 text-sm text-muted-foreground">AI title, description, and story generation are not connected in this independent build yet. Your writing is saved as entered. Generation controls will appear when the independent AI service passes authentication, quota, and cost-safety checks.</p></div>
      </section>}
      {step === 3 && <section className="space-y-4">
        <div className="space-y-2 rounded-xl border border-border p-4"><p className="text-xs font-semibold uppercase tracking-wider text-primary">{categoryLabels[form.category]}</p><h3 className="font-display text-2xl font-bold break-words">{form.title || "Your campaign title"}</h3>{form.summary && <p className="whitespace-pre-wrap text-muted-foreground">{form.summary}</p>}<p className="font-semibold">Goal: ${Number(form.goal_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p><div className="border-t border-border pt-3"><h4 className="font-semibold">Campaign story</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm">{form.story || "Your story will appear here."}</p></div></div>
        <label className="block font-semibold">Cover image URL (optional)<input type="url" maxLength={2048} value={form.cover_image_url} onChange={e => change("cover_image_url", e.target.value)} placeholder="https://…" className="mt-2 min-h-12 w-full rounded-xl border border-input bg-background px-4 font-normal" /></label>
        {form.cover_image_url && <img src={form.cover_image_url} alt="Campaign cover preview" loading="lazy" className="max-h-72 w-full rounded-xl border border-border object-contain bg-background" />}
        <p className="text-sm text-muted-foreground">AI cover generation and direct media upload are not enabled in this independent build yet. You may add a public image URL or publish without a custom cover.</p>
      </section>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {saved && <p role="status" className="rounded-xl border border-border p-4">Private draft saved. Reference: <code className="break-all">{saved}</code>. <Link to="/dashboard" className="underline">Dashboard</Link></p>}
      <div className="flex flex-wrap gap-3 border-t border-border pt-5">
        <button type="button" onClick={e => save(e, false)} disabled={busy || loadingDraft || Boolean(draftLoadError)} className="min-h-12 rounded-xl border border-primary px-6 font-semibold text-primary disabled:opacity-50">{busy ? "Saving…" : "Save private draft"}</button>
        {step > 0 && <button type="button" onClick={() => setStep(value => Math.max(0, value - 1))} disabled={busy} className="min-h-12 rounded-xl border border-input px-6 font-semibold">Back</button>}
        {step < 3 ? <button type="submit" disabled={busy || loadingDraft || Boolean(draftLoadError) || !canContinue} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">Continue</button> : <button type="submit" disabled={busy || loadingDraft || Boolean(draftLoadError)} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Publishing…" : "Publish campaign"}</button>}
      </div>
      <p className="text-sm text-muted-foreground">Publishing makes your campaign story public. It does not activate checkout, collect money, or authorize automated sharing.</p>
    </form>
  </main>;
}
