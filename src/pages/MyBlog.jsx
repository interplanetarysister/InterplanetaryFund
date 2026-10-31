import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Plus, Save, Send, LogIn, RefreshCw } from "lucide-react";
import { getReporterWorkspace, saveReporterStory } from "../lib/blogs";

export default function MyBlog({ user }) {
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
    try { setWorkspace(await getReporterWorkspace(user?.id)); }
    catch { setError("The Reporter workspace could not be loaded. Please retry."); }
    finally { setLoading(false); }
  }, [user?.id]);
  useEffect(() => { load(); }, [load]);
  function choose(entry) {
    setSelectedId(entry?.id || ""); setTitle(entry?.title || "");
    setSummary(entry?.summary || ""); setBody(entry?.body || ""); setMessage("");
  }
  async function submit(status) {
    if (!title.trim() || !body.trim() || saving) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const saved = await saveReporterStory({ user, id: selectedId || undefined, title, summary, body, status });
      await load(); setSelectedId(saved.id); setMessage(status === "published" ? "Story published." : "Draft saved.");
    } catch (e) { setError(e?.message || "The story could not be saved."); }
    finally { setSaving(false); }
  }
  if (loading) return <main className="reporter-page">Loading Reporter studio…</main>;
  if (!user) return <main className="reporter-page"><section className="reporter-hero"><BookOpen size={36}/><h1>Reporter studio</h1><p>Sign in with the original Reporter owner account to manage drafts and publish stories.</p><Link className="primary" to="/login"><LogIn size={16}/> Sign in</Link></section></main>;
  if (error && !workspace) return <main className="reporter-page"><p role="alert">{error}</p><button onClick={load}>Retry</button></main>;
  if (!workspace?.blog) return <main className="reporter-page"><h1>Reporter studio</h1><p>This signed-in account does not own the official Reporter publication.</p></main>;
  const active = workspace.entries.find((entry) => entry.id === selectedId);
  return <main className="reporter-page">
    <div className="reporter-heading"><div><p className="eyebrow">OFFICIAL PUBLICATION</p><h1>Reporter studio</h1><p>{workspace.blog.title}</p></div><Link className="secondary" to="/blogs">View publication</Link></div>
    <div className="reporter-editor-layout">
      <aside className="reporter-list card"><div className="reporter-heading"><h2>Your stories</h2><button aria-label="New story" onClick={() => choose(null)}><Plus size={17}/></button></div>
        {workspace.entries.map((entry)=><button key={entry.id} onClick={()=>choose(entry)} className={`reporter-story-choice ${selectedId===entry.id?"selected":""}`}><strong>{entry.title}</strong><small>{entry.status === "published" ? "Published" : "Draft"}</small></button>)}
      </aside>
      <section className="card reporter-editor"><h2>{selectedId ? "Edit story" : "New story"}</h2>{active && <span className="pill">{active.status}</span>}
        <form className="form" onSubmit={(e)=>{e.preventDefault();submit("draft");}}>
          <label>Title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} /></label>
          <label>Short description<textarea rows={2} maxLength={500} value={summary} onChange={e=>setSummary(e.target.value)} /></label>
          <label>Story<textarea required rows={14} value={body} onChange={e=>setBody(e.target.value)} /></label>
          {error && <p className="notice error" role="alert">{error}</p>}{message && <p className="notice" role="status">{message}</p>}
          <div className="actions"><button type="submit" disabled={saving || !title.trim() || !body.trim()}><Save size={15}/>{saving?"Saving…":"Save draft"}</button><button className="primary" type="button" onClick={()=>submit("published")} disabled={saving || !title.trim() || !body.trim()}><Send size={15}/>{saving?"Saving…":"Publish story"}</button><button className="secondary" type="button" onClick={load} disabled={saving}><RefreshCw size={15}/> Refresh</button></div>
        </form>
      </section>
    </div>
  </main>;
}
