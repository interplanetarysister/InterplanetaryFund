import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";

const empty = { id: "", title: "", summary: "", body: "", kind: "blog", status: "draft" };

export default function MyBlog({ user }) {
  const [blog, setBlog] = useState(null);
  const [entries, setEntries] = useState(null);
  const [article, setArticle] = useState(empty);
  const [blogTitle, setBlogTitle] = useState("");
  const [blogDescription, setBlogDescription] = useState("");
  const [publishAllowed, setPublishAllowed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const saving = useRef(false);
  const memberId = user?.id;
  const admin = ["admin", "super_admin"].includes(user?.app_metadata?.role);
  useEffect(() => {
    let cancelled = false;
    setBlog(null); setEntries(null); setPublishAllowed(false);
    setError(""); setNotice("");
    if (!db || !memberId) { setEntries([]); return; }
    Promise.all([
      db.from("ifund_blogs").select("id,title,description").eq("owner_id", memberId).maybeSingle(),
      db.from("ifund_blog_entries").select("id,blog_id,title,summary,body,kind,status,published_at")
        .eq("owner_id", memberId).order("created_at", { ascending: false }).limit(100),
      db.from("ifund_creator_access").select("can_publish,expires_at")
        .eq("member_id", memberId).maybeSingle(),
    ]).then(([b,e,a]) => {
      if (cancelled) return;
      const firstError = b.error || e.error || a.error;
      if (firstError) setError(firstError.message);
      setBlog(b.data || null);
      setBlogTitle(b.data?.title || ""); setBlogDescription(b.data?.description || "");
      setEntries(e.data || []);
      const valid = a.data?.can_publish &&
        (!a.data.expires_at || new Date(a.data.expires_at).getTime() > Date.now());
      setPublishAllowed(Boolean(valid) || admin);
    }).catch((cause) => {
      if (cancelled) return;
      setEntries([]); setError(cause?.message || "Blog Studio could not load.");
    });
    return () => { cancelled = true; };
  }, [memberId, admin, revision]);

  async function saveBlog(event) {
    event.preventDefault();
    if (!db || !memberId || saving.current || !blogTitle.trim()) return;
    saving.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const payload = { title: blogTitle.trim(), description: blogDescription.trim() };
      const query = blog ? db.from("ifund_blogs").update(payload)
        .eq("id", blog.id).eq("owner_id", memberId)
        : db.from("ifund_blogs").insert({ ...payload, owner_id: memberId });
      const { data, error: saveError } = await query.select("id,title,description").single();
      if (saveError || !data) throw new Error(saveError?.message || "Blog save could not be verified.");
      setBlog(data); setNotice(blog ? "Blog updated." : "Blog created. Add your first story.");
    } catch (cause) { setError(cause?.message || "Blog could not be saved."); }
    finally { saving.current = false; setBusy(false); }
  }

  async function saveEntry(publish = false) {
    if (!db || !blog || !memberId || saving.current) return;
    if (publish && !publishAllowed) {
      setError("Publishing needs a verified creator permission. Your draft can still be saved.");
      return;
    }
    if (publish && (!article.title.trim() || !article.body.trim())) {
      setError("Provide a title and body before publishing.");
      return;
    }
    saving.current = true; setBusy(true); setError(""); setNotice("");
    const payload = {
      title: article.title.trim(), summary: article.summary.trim(),
      body: article.body, kind: article.kind, status: publish ? "published" : article.status,
      published_at: publish
        ? (article.status === "published" && article.published_at ? article.published_at : new Date().toISOString())
        : (article.published_at || null),
    };
    try {
      const query = article.id
        ? db.from("ifund_blog_entries").update(payload).eq("id", article.id)
          .eq("owner_id", memberId).eq("blog_id", blog.id)
        : db.from("ifund_blog_entries").insert({ ...payload, owner_id: memberId, blog_id: blog.id });
      const { data, error: saveError } = await query
        .select("id,blog_id,title,summary,body,kind,status,published_at").single();
      if (saveError || !data) throw new Error(saveError?.message || "Story could not be verified.");
      setArticle(data);
      setEntries((all) => [data, ...(all || []).filter((e) => e.id !== data.id)]);
      setNotice(publish ? "Story published." : "Story saved.");
    } catch (cause) { setError(cause?.message || "Story could not be saved."); }
    finally { saving.current = false; setBusy(false); }
  }

  if (!user) return <main><h1>My Blog Studio</h1>
    <p>Sign in to write and manage your stories.</p>
    <Link className="primary" to="/login?returnTo=%2Fmy-blog">Sign in</Link></main>;
  return <main className="blog-studio">
    <h1>My Blog Studio</h1>
    <p>Create one blog, save stories as drafts, and publish when your creator permissions are verified.</p>
    <div className="actions"><Link to="/blogs" className="secondary">Read community blogs</Link>
      <button type="button" className="secondary" onClick={() => setRevision((n) => n + 1)}>Refresh</button></div>
    <Message error={Boolean(error)}>{error || notice}</Message>
    {entries === null && !error ? <Loading /> : <>
      <section className="card">
        <h2>{blog ? "My blog" : "Start your blog"}</h2>
        <form className="form" onSubmit={saveBlog}>
          <label>Blog title
            <input value={blogTitle} maxLength={140} required
              onChange={(e) => setBlogTitle(e.target.value)} /></label>
          <label>About your blog
            <textarea value={blogDescription} maxLength={600} rows={3}
              onChange={(e) => setBlogDescription(e.target.value)} /></label>
          <button type="submit" className="primary" disabled={busy || !blogTitle.trim()}>
            {busy ? "Saving…" : blog ? "Save blog details" : "Create blog"}</button>
        </form>
      </section>
      {blog && <section className="card">
        <h2>{article.id ? "Edit story" : "Write a story"}</h2>
        <div className="form">
          <label>Title
            <input maxLength={160} value={article.title}
              onChange={(e) => setArticle((a) => ({ ...a, title: e.target.value }))} /></label>
          <label>Description
            <textarea maxLength={500} rows={2} value={article.summary}
              onChange={(e) => setArticle((a) => ({ ...a, summary: e.target.value }))} /></label>
          {admin && <label>Type<select value={article.kind}
              onChange={(e) => setArticle((a) => ({ ...a, kind: e.target.value }))}>
              <option value="blog">Community blog</option>
              <option value="newsletter">Official newsletter</option>
            </select></label>}
          <label>Story
            <textarea rows={14} maxLength={30000} value={article.body}
              onChange={(e) => setArticle((a) => ({ ...a, body: e.target.value }))} /></label>
          <div className="actions">
            <button type="button" className="secondary" disabled={busy} onClick={() => saveEntry(false)}>
              {busy ? "Saving…" : "Save draft or changes"}</button>
            <button type="button" className="primary" disabled={busy || !publishAllowed}
              onClick={() => saveEntry(true)}>{article.status === "published" ? "Update published story" : "Publish story"}</button>
            <button type="button" className="secondary" disabled={busy}
              onClick={() => setArticle(empty)}>New story</button>
          </div>
          {!publishAllowed && <small>Publishing requires creator access approved by the independent account service. Draft writing is available.</small>}
        </div>
      </section>}
      <section><h2>My stories</h2>
        {entries?.length ? <div className="cards">{entries.map((item) =>
          <article className="card" key={item.id}>
            <small>{item.status === "published" ? "Published" : "Private draft"}</small>
            <h3>{item.title || "Untitled draft"}</h3>
            <div className="actions">
              <button type="button" className="secondary"
                onClick={() => setArticle(item)}>Edit story</button>
              {item.status === "published" && <Link to={"/blogs/" + item.id}>View public story</Link>}
            </div>
          </article>)}</div> : !error ? <p>No stories yet. Start with a private draft.</p> : null}
      </section>
    </>}
  </main>;
}
