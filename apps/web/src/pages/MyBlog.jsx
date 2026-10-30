import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { getOwnerBlogWorkspace, saveOwnerBlogEntry } from "@/api/blogs";
import { BookOpen, Plus, Save, Send, LogIn, RefreshCw } from "lucide-react";

export default function MyBlog() {
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await getOwnerBlogWorkspace(); setWorkspace(result); }
    catch { setError("The Reporter workspace could not be loaded. Please retry."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  function choose(entry) { setSelectedId(entry?.id || ""); setTitle(entry?.title || ""); setSummary(entry?.summary || ""); setBody(entry?.body || ""); setMessage(""); }
  async function submit(status) {
    if (!title.trim() || !body.trim() || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const saved = await saveOwnerBlogEntry({ id: selectedId || undefined, title, summary, body, status });
      await load(); choose(saved); setMessage(status === "published" ? "Story published." : "Draft saved.");
    } catch (e) { setError(e?.message || "The story could not be saved."); }
    finally { setSaving(false); }
  }
  if (loading) return <main className="mx-auto max-w-6xl px-4 py-12 text-slate-500">Loading Reporter studio…</main>;
  if (error && !workspace) return <main className="mx-auto max-w-3xl px-4 py-12"><p role="alert">{error}</p><button onClick={load} className="mt-4 underline">Retry</button></main>;
  if (!workspace?.user) return <main className="mx-auto max-w-2xl px-4 py-12"><section className="rounded-3xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-900"><BookOpen className="h-9 w-9 text-cyan-600" /><h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">Reporter studio</h1><p className="mt-2 text-slate-600 dark:text-slate-300">Sign in with the original Reporter owner account to manage drafts and publish stories.</p><Link to="/login?returnTo=%2Fmy-blog" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-500 px-4 font-semibold text-slate-950"><LogIn className="h-4 w-4" /> Sign in</Link></section></main>;
  if (!workspace.blog) return <main className="mx-auto max-w-3xl px-4 py-12"><h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Reporter studio</h1><p className="mt-3 text-slate-600 dark:text-slate-300">This signed-in account does not own the official Reporter publication.</p><button onClick={async()=>{await authClient().auth.signOut();navigate("/login?returnTo=%2Fmy-blog");}} className="mt-5 underline">Switch account</button></main>;
  const active = workspace.entries.find((entry) => entry.id === selectedId);
  return <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">Official publication</p><h1 className="mt-1 text-3xl font-semibold text-slate-900 dark:text-white">Reporter studio</h1><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{workspace.blog.title}</p></div><Link to="/blogs" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-cyan-700 hover:underline">View publication</Link></div>
    <div className="mt-7 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900 dark:text-white">Your stories</h2><button onClick={()=>choose(null)} aria-label="New story" className="rounded-lg p-2 text-cyan-700 hover:bg-cyan-50"><Plus className="h-5 w-5" /></button></div><div className="mt-3 space-y-2">{workspace.entries.map((entry)=><button key={entry.id} onClick={()=>choose(entry)} className={`w-full rounded-xl p-3 text-left ${selectedId===entry.id?"bg-cyan-50 ring-1 ring-cyan-300 dark:bg-cyan-950/40":"hover:bg-slate-50 dark:hover:bg-slate-800"}`}><span className="block line-clamp-2 text-sm font-medium text-slate-800 dark:text-slate-100">{entry.title}</span><span className="mt-1 block text-xs text-slate-500">{entry.status === "published" ? "Published" : "Draft"}</span></button>)}</div></aside>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-7"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-slate-900 dark:text-white">{selectedId ? "Edit story" : "New story"}</h2>{active && <span className="text-xs text-slate-500">{active.status}</span>}</div>
        <form className="mt-5 space-y-4" onSubmit={(e)=>{e.preventDefault();submit("draft");}}>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-950 dark:border-slate-600" /></label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Short description<textarea rows={2} maxLength={500} value={summary} onChange={e=>setSummary(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950 dark:border-slate-600" /></label>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Story<textarea required rows={14} value={body} onChange={e=>setBody(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-950 dark:border-slate-600" /></label>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}{message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
          <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving || !title.trim() || !body.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100"><Save className="h-4 w-4" />{saving?"Saving…":"Save draft"}</button><button type="button" onClick={()=>submit("published")} disabled={saving || !title.trim() || !body.trim()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-500 px-4 font-semibold text-slate-950 disabled:opacity-50"><Send className="h-4 w-4" />{saving?"Saving…":"Publish story"}</button><button type="button" onClick={load} disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300"><RefreshCw className="h-4 w-4" /> Refresh</button></div>
        </form>
      </section>
    </div>
  </main>;
}
