import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Newspaper, BookOpen, FileText, Presentation, ClipboardList, FlaskConical, Megaphone, Loader2, Upload } from "lucide-react";

const CATEGORIES = [
  ["all", "All"],
  ["newsletter", "Newsletter"],
  ["blog", "Blogs"],
  ["report", "Reports"],
  ["status_report", "Status"],
  ["presentation", "Slides"],
  ["research", "Research"],
  ["announcement", "Updates"],
];
const LABELS = Object.fromEntries(CATEGORIES);
const ICONS = {
  newsletter: Newspaper, blog: BookOpen, report: FileText,
  status_report: ClipboardList, presentation: Presentation,
  research: FlaskConical, announcement: Megaphone,
};
const blank = { kind: "report", title: "", summary: "", body: "", file_label: "" };

export default function OfficialPublications({ isAdmin = false }) {
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState(blank);
  const [pdf, setPdf] = useState(null);
  const [finalApproved, setFinalApproved] = useState(false);
  const [publicApproved, setPublicApproved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [blogResult, pubResult] = await Promise.allSettled([
      base44.functions.invoke("manageBlog", { mode: "feed" }),
      base44.functions.invoke("manageOfficialPublications", { mode: "feed" }),
    ]);
    const stories = blogResult.status === "fulfilled" && blogResult.value?.data?.ok
      ? blogResult.value.data.entries || [] : [];
    const reports = pubResult.status === "fulfilled" && pubResult.value?.data?.ok
      ? pubResult.value.data.items || [] : [];
    if (blogResult.status === "rejected" && pubResult.status === "rejected") {
      setError("Publications could not be loaded. Please try again.");
    } else if (pubResult.status === "rejected" || !pubResult.value?.data?.ok) {
      setError("Official reports are temporarily unavailable; existing newsletters and blogs are shown.");
    } else if (blogResult.status === "rejected" || !blogResult.value?.data?.ok) {
      setError("Newsletters and blogs are temporarily unavailable; official reports are shown.");
    }
    const combined = [
      ...stories.map((s) => ({
        id: s.id, category: s.type === "newsletter" ? "newsletter" : "blog",
        title: s.title, summary: s.summary, date: s.published_at || s.created_at,
        byline: s.author_name || "IFund community", href: `/blogs/${s.id}`,
      })),
      ...reports.map((r) => ({
        id: r.id, category: r.kind, title: r.title, summary: r.summary,
        date: r.published_at, byline: "Interplanetary Fund",
        href: `/publications/${r.id}`, hasPdf: !!r.pdf_url,
      })),
    ];
    combined.sort((a, b) => (Date.parse(b.date || "") || 0) - (Date.parse(a.date || "") || 0));
    setItems(combined);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const publish = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!finalApproved || !publicApproved) {
      setNotice("Confirm the document is final and approved for public viewing.");
      return;
    }
    setSubmitting(true);
    setNotice("");
    try {
      let pdfUrl = "";
      if (pdf) {
        if (pdf.type !== "application/pdf" || pdf.size > 15 * 1024 * 1024) {
          throw new Error("Choose a PDF no larger than 15 MB.");
        }
        const upload = await base44.integrations.Core.UploadPublicFile({ file: pdf });
        pdfUrl = upload?.file_url || "";
        if (!/^https:\/\//i.test(pdfUrl)) throw new Error("Secure PDF upload failed.");
      }
      const result = await base44.functions.invoke("manageOfficialPublications", {
        mode: "publish", ...editor, pdf_url: pdfUrl,
        file_label: editor.file_label || pdf?.name || "",
        final_approved: true, public_visibility_confirmed: true,
      });
      if (!result.data?.ok) throw new Error(result.data?.error || "Publication was not saved.");
      setEditor(blank); setPdf(null); setFinalApproved(false); setPublicApproved(false);
      const picker = document.getElementById("ifund-official-publication-pdf");
      if (picker) picker.value = "";
      setNotice("Final publication is live in the IFund publications section.");
      await load();
    } catch (err) {
      setNotice(err?.message || "Unable to publish. No post was created.");
    } finally {
      setSubmitting(false);
    }
  };

  const shown = items.filter((item) => category === "all" || item.category === category);
  return (
    <section className="space-y-5" aria-label="IFund official publications">
      <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-slate-900 to-indigo-950 p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <Newspaper className="h-7 w-7 text-cyan-300 shrink-0" />
          <div>
            <h2 className="font-display text-2xl font-semibold text-white">IFund Publications</h2>
            <p className="text-sm text-slate-200 mt-1">Newsletters, blogs, finalized reports, status updates and slide presentations—all in one place.</p>
          </div>
        </div>
        <p className="text-sm text-slate-300 mt-4">Only published material appears here. Working notes, unfinished reports and private investor documents are not automatically shared.</p>
        <Link to="/blogs" className="inline-flex items-center min-h-11 mt-4 text-cyan-200 font-semibold underline underline-offset-2">Browse the newsletter and blogs</Link>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Filter publications">
        {CATEGORIES.map(([id, label]) => <button key={id} type="button" onClick={() => setCategory(id)}
          aria-pressed={category === id}
          className={`min-h-10 px-3 rounded-full border text-sm font-medium transition-colors ${category === id ? "bg-cyan-300 border-cyan-300 text-slate-950" : "bg-slate-900 border-slate-600 text-white hover:border-cyan-300"}`}>
          {label}
        </button>)}
      </div>

      {error && <p role="alert" className="rounded-lg bg-amber-950/60 border border-amber-400/30 text-amber-100 p-3 text-sm">{error}</p>}
      {loading ? <div role="status" className="flex items-center gap-2 text-slate-200"><Loader2 className="animate-spin h-5 w-5" /> Loading publications…</div>
        : shown.length === 0 ? <div className="rounded-2xl border border-slate-600 bg-slate-900/70 p-6 text-slate-200">No published items in this category yet.</div>
        : <div className="grid sm:grid-cols-2 gap-4">
          {shown.map((item) => {
            const Icon = ICONS[item.category] || FileText;
            return <Link key={`${item.category}-${item.id}`} to={item.href}
              className="block rounded-2xl border border-white/15 bg-slate-900/90 hover:border-cyan-300 p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
              <div className="flex items-center gap-2 text-cyan-200 text-xs font-semibold uppercase">
                <Icon className="w-4 h-4" /><span>{LABELS[item.category] || "Publication"}</span>
                {item.hasPdf && <span className="ml-auto rounded bg-violet-500/20 px-2 py-1 text-violet-100">PDF</span>}
              </div>
              <h3 className="text-white text-lg font-semibold mt-3">{item.title}</h3>
              <p className="text-sm text-slate-200 mt-2 line-clamp-3">{item.summary || "Read more"}</p>
              <p className="text-xs text-slate-300 mt-4">{item.byline}{item.date ? " · " + new Date(item.date).toLocaleDateString() : ""}</p>
            </Link>;
          })}
        </div>}

      {isAdmin && <details className="rounded-2xl border border-violet-400/30 bg-slate-900/90 p-5">
        <summary className="cursor-pointer font-semibold text-white">Admin: Publish a finalized report or presentation</summary>
        <p className="text-sm text-slate-200 mt-3">This is a one-step public publishing action, not a draft storage area. Do not upload confidential deal-room decks, private financial reports or unfinished material.</p>
        <form onSubmit={publish} className="mt-4 space-y-3">
          <label className="block text-sm text-white">Category
            <select value={editor.kind} onChange={(e) => setEditor((v) => ({ ...v, kind: e.target.value }))}
              className="block w-full mt-1 min-h-11 rounded-lg bg-slate-800 border border-slate-500 px-3 text-white">
              {CATEGORIES.slice(3).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="block text-sm text-white">Title
            <input required minLength={5} maxLength={140} value={editor.title} onChange={(e) => setEditor((v) => ({ ...v, title: e.target.value }))}
              className="block w-full mt-1 min-h-11 rounded-lg bg-slate-800 border border-slate-500 px-3 text-white" placeholder="Final report title" />
          </label>
          <label className="block text-sm text-white">Public summary
            <textarea required minLength={20} maxLength={500} rows={2} value={editor.summary} onChange={(e) => setEditor((v) => ({ ...v, summary: e.target.value }))}
              className="block w-full mt-1 rounded-lg bg-slate-800 border border-slate-500 p-3 text-white" placeholder="Explain what readers will learn" />
          </label>
          <label className="block text-sm text-white">Final report text (optional when a PDF is attached)
            <textarea maxLength={24000} rows={6} value={editor.body} onChange={(e) => setEditor((v) => ({ ...v, body: e.target.value }))}
              className="block w-full mt-1 rounded-lg bg-slate-800 border border-slate-500 p-3 text-white" placeholder="Approved final text only" />
          </label>
          <label className="block text-sm text-white">Public PDF (optional, maximum 15 MB)
            <input id="ifund-official-publication-pdf" type="file" accept="application/pdf,.pdf" onChange={(e) => setPdf(e.target.files?.[0] || null)}
              className="block w-full mt-1 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-300 file:text-slate-950 file:px-3 file:py-2" />
          </label>
          <label className="flex gap-2 text-sm text-white items-start">
            <input type="checkbox" checked={finalApproved} onChange={(e) => setFinalApproved(e.target.checked)} className="mt-1" />
            I have verified this is the final version, with no unfinished work or placeholders.
          </label>
          <label className="flex gap-2 text-sm text-white items-start">
            <input type="checkbox" checked={publicApproved} onChange={(e) => setPublicApproved(e.target.checked)} className="mt-1" />
            I approve this document for public viewing and confirm it contains no private investor, user, account or security information.
          </label>
          <button type="submit" disabled={submitting || !finalApproved || !publicApproved}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50 min-h-11">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {submitting ? "Publishing…" : "Publish final version"}
          </button>
          {notice && <p role="status" className="text-sm text-cyan-100">{notice}</p>}
        </form>
      </details>}
    </section>
  );
}
