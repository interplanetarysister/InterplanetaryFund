import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { HELP_CATEGORY_NAMES, helpSlug, helpArticlePath } from "@/lib/helpCenter";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const EMPTY = { question: "", slug: "", category: HELP_CATEGORY_NAMES[0], description: "", answer: "", keywords: [], stage: "draft" };
const fields = (draft) => ({
  question: draft.question.trim(), slug: draft.slug.trim(), category: draft.category,
  description: draft.description.trim(), answer: draft.answer,
  keywords: draft.keywords || [],
});

export default function HelpAdmin() {
  const [drafts, setDrafts] = useState([]);
  const [published, setPublished] = useState([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [draftId, setDraftId] = useState(null);
  const [articleId, setArticleId] = useState(null);
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [working, live] = await Promise.all([
      base44.entities.HelpDraft.list("-created_date", 200),
      base44.entities.HelpArticle.list("-created_date", 200),
    ]);
    setDrafts(Array.isArray(working) ? working : []);
    setPublished(Array.isArray(live) ? live : []);
  };
  useEffect(() => {
    let active = true;
    reload().catch(() => { if (active) setMessage("We couldn't load Help Center records."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const pick = (item, isDraft) => {
    setForm({ ...EMPTY, ...item });
    setDraftId(isDraft ? item.id : null);
    setArticleId(isDraft ? item.article_id || null : item.id);
    setKeywords((item.keywords || []).join(", "));
    setMessage("");
  };
  const reset = () => { setForm({ ...EMPTY }); setDraftId(null); setArticleId(null); setKeywords(""); setMessage(""); };
  const getPayload = () => fields({ ...form, keywords: keywords.split(",").map((x) => x.trim()).filter(Boolean) });
  const valid = () => form.question.trim() && form.slug.trim() && helpSlug(form.slug) === form.slug;
  const save = async () => {
    if (!valid() || busy) { setMessage("Add a title and lowercase URL slug before saving."); return; }
    setBusy(true);
    setMessage("");
    try {
      const payload = { ...getPayload(), article_id: articleId || "", stage: "draft" };
      const result = draftId
        ? await base44.entities.HelpDraft.update(draftId, payload)
        : await base44.entities.HelpDraft.create(payload);
      if (result?.id) setDraftId(result.id);
      await reload();
      setMessage("Private draft saved. It isn't visible to visitors.");
    } catch { setMessage("We couldn't save the draft. No publication occurred."); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    if (busy || !draftId) { setMessage("Save a draft before publishing."); return; }
    if (!valid() || !form.answer.trim()) { setMessage("A valid title, URL and article text are required to publish."); return; }
    if (published.some((item) => item.slug === form.slug && item.id !== articleId)) {
      setMessage("This URL is already used by a published article."); return;
    }
    if (articleId && published.some((item) => item.id === articleId && item.slug !== form.slug)) {
      setMessage("Published article URLs cannot be changed because existing app links must keep working."); return;
    }
    setBusy(true);
    setMessage("");
    try {
      const data = getPayload();
      const result = articleId
        ? await base44.entities.HelpArticle.update(articleId, data)
        : await base44.entities.HelpArticle.create(data);
      const liveId = articleId || result?.id;
      if (liveId) {
        setArticleId(liveId);
        await base44.entities.HelpDraft.update(draftId, { ...data, article_id: liveId });
      }
      await reload();
      setMessage("Published article saved and available to visitors.");
    } catch { setMessage("The publish request could not be confirmed. Check the published list before retrying."); }
    finally { setBusy(false); }
  };

  return <div className="max-w-6xl mx-auto px-4 sm:px-7 py-8 text-foreground">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-7">
      <div><h1 className="font-display text-2xl sm:text-3xl">Help Center Editor</h1>
        <p className="text-sm text-muted-foreground mt-1">Drafts are private. Articles appear publicly only when you select Publish.</p></div>
      <Link to="/help" className="underline text-cyan-700 font-semibold">View public Help Center</Link>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
      <aside className="rounded-2xl border border-border bg-card p-4 h-fit space-y-3">
        <Button variant="outline" className="w-full" onClick={reset}>New blank draft</Button>
        <h2 className="font-semibold">Private drafts ({drafts.length})</h2>
        {loading && <p className="text-sm">Loading…</p>}
        {!loading && drafts.length === 0 && <p className="text-sm text-muted-foreground">No drafts yet.</p>}
        {drafts.map((item) => <button type="button" key={item.id} onClick={() => pick(item, true)}
          className="block w-full text-left rounded-xl border border-border p-3 hover:border-cyan-500">
          <span className="block font-medium text-sm break-words">{item.question}</span>
          <span className="block text-xs text-muted-foreground mt-1">{item.article_id ? "Linked to published article" : "Private draft"}</span>
        </button>)}
        <h2 className="font-semibold pt-3">Published ({published.length})</h2>
        {published.map((item) => <button type="button" key={item.id} onClick={() => pick(item, false)}
          className="block w-full text-left rounded-xl border border-border p-3 hover:border-cyan-500">
          <span className="block text-sm font-medium break-words">{item.question}</span>
          <span className="block text-xs text-muted-foreground mt-1">Edit via a private draft</span>
        </button>)}
      </aside>
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 min-w-0">
        <h2 className="font-semibold text-lg mb-4">{draftId ? "Edit private draft" : articleId ? "Prepare an edit to a live article" : "Prepare a new article"}</h2>
        <div className="space-y-4">
          <div><label htmlFor="help-title" className="block text-sm font-semibold mb-2">Article title</label>
            <Input id="help-title" value={form.question} onChange={(e) => {
              const question = e.target.value;
              setForm((v) => ({ ...v, question, slug: !v.slug || v.slug === helpSlug(v.question) ? helpSlug(question) : v.slug }));
            }} maxLength={160} /></div>
          <div><label htmlFor="help-slug" className="block text-sm font-semibold mb-2">Permanent URL name</label>
            <Input id="help-slug" value={form.slug} disabled={Boolean(articleId)} onChange={(e) => setForm({ ...form, slug: helpSlug(e.target.value) })} />
            <p className="text-xs text-muted-foreground mt-1">/help/{form.slug || "article-name"} — permanent once published</p></div>
          <div><label htmlFor="help-category" className="block text-sm font-semibold mb-2">Category</label>
            <select id="help-category" className="w-full min-h-11 rounded-lg border border-input bg-background px-3 text-foreground"
              value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {HELP_CATEGORY_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
            </select></div>
          <div><label htmlFor="help-summary" className="block text-sm font-semibold mb-2">Short description</label>
            <Input id="help-summary" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} /></div>
          <div><label htmlFor="help-keywords" className="block text-sm font-semibold mb-2">Search keywords (comma-separated)</label>
            <Input id="help-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} /></div>
          <div><label htmlFor="help-answer" className="block text-sm font-semibold mb-2">Article text</label>
            <Textarea id="help-answer" rows={14} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })}
              placeholder="We will write the full article content later." />
            <p className="text-xs text-muted-foreground mt-1">Plain text with line breaks. Never include private account data or passwords.</p></div>
        </div>
        {message && <p className="text-sm mt-4" role="status">{message}</p>}
        <div className="flex flex-wrap gap-3 mt-6">
          <Button type="button" disabled={busy || !valid()} onClick={save}>{busy ? "Working…" : "Save private draft"}</Button>
          <Button type="button" variant="outline" disabled={busy || !draftId || !form.answer.trim()} onClick={publish}>Publish article</Button>
          {articleId && <Link className="self-center text-sm font-semibold text-cyan-700 underline" to={helpArticlePath(form.slug)}>View live article</Link>}
        </div>
      </section>
    </div>
  </div>;
}
