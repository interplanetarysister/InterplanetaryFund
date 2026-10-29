import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";

export default function Community({ user }) {
  const [body, setBody] = useState("");
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [posting, setPosting] = useState(false);
  const [removing, setRemoving] = useState("");
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  const load = useCallback(async () => {
    if (!db) {
      setPosts([]);
      setError("The community database is not configured.");
      return;
    }
    const { data, error: loadError } = await db.from("ifund_posts")
      .select("id,author_id,body,created_at").order("created_at", { ascending: false }).limit(50);
    if (loadError) throw loadError;
    setPosts(data || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPosts(null);
    setError("");
    if (!db) { setPosts([]); setError("Community is not connected to the database."); return; }
    db.from("ifund_posts").select("id,author_id,body,created_at")
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        setPosts(data || []); setError(loadError?.message || "");
      }).catch((cause) => {
        if (cancelled) return;
        setPosts([]); setError(cause?.message || "Community feed could not load.");
      });
    return () => { cancelled = true; };
  }, [revision]);

  async function submit(event) {
    event.preventDefault();
    if (!db || !user?.id || lock.current) return;
    const text = body.trim();
    if (!text || text.length > 2000) return;
    lock.current = true; setPosting(true); setNotice(""); setError("");
    try {
      const { error: saveError } = await db.from("ifund_posts")
        .insert({ author_id: user.id, body: text });
      if (saveError) throw saveError;
      setBody("");
      await load();
      setNotice("Update published.");
    } catch (cause) {
      setError(cause?.message || "Couldn't publish this update.");
    } finally {
      lock.current = false; setPosting(false);
    }
  }

  async function remove(post) {
    if (!db || post.author_id !== user?.id || removing) return;
    if (!window.confirm("Delete this update? This cannot be undone.")) return;
    setRemoving(post.id); setError(""); setNotice("");
    try {
      const { data, error: deleteError } = await db.from("ifund_posts")
        .delete().eq("id", post.id).eq("author_id", user.id).select("id");
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error("No update was removed. Refresh and try again.");
      setPosts((previous) => (previous || []).filter((p) => p.id !== post.id));
      setNotice("Update deleted.");
    } catch (cause) {
      setError(cause?.message || "Update could not be removed.");
    } finally { setRemoving(""); }
  }

  return <main className="social-hub">
    <header className="social-heading">
      <div><h1>Interplanetary Social</h1>
        <p>The Interplanetary Fund community universe.</p></div>
      <button type="button" className="secondary" onClick={() => setRevision((n) => n + 1)}
        disabled={!db || posting}>Refresh feed</button>
    </header>
    <nav className="social-tabs" aria-label="Social sections">
      <Link className="active" to="/social">Social & Community</Link>
      <Link to="/discover">Campaigns</Link>
    </nav>
    <div className="social-layout">
      <section className="social-main">
        {user ? <form className="form card social-composer" onSubmit={submit}>
          <h2>Share an update</h2>
          <label htmlFor="community-body">What would you like to share?
            <textarea id="community-body" rows={4} maxLength={2000} required
              placeholder="Share an update with the IFund community…"
              value={body} onChange={(event) => setBody(event.target.value)} /></label>
          <div className="actions">
            <small>{body.length} / 2000</small>
            <button type="submit" className="primary" disabled={!body.trim() || posting}>
              {posting ? "Publishing…" : "Post update"}</button>
          </div>
        </form> : <div className="card">
          <p>Browse community updates below. <Link to="/login?returnTo=%2Fsocial">Sign in to post.</Link></p>
        </div>}
        <Message error={!!error}>{error || notice}</Message>
        <h2>Recent community updates</h2>
        {posts === null ? <Loading /> : posts.length ? posts.map((post) =>
          <article key={post.id} className="card social-post">
            <div className="social-post-head"><strong>{post.author_id === user?.id ? "You" : "Community member"}</strong>
              <small>{new Date(post.created_at).toLocaleString()}</small></div>
            <p className="social-post-body">{post.body}</p>
            {post.author_id === user?.id &&
              <button type="button" className="text-button" disabled={!!removing}
                onClick={() => remove(post)}>
                {removing === post.id ? "Deleting…" : "Delete my update"}</button>}
          </article>) : !error ? <p>No updates have been posted yet.</p> : null}
      </section>
      <aside className="social-sidebar">
        <div className="card"><h3>Your community</h3>
          <p>Share what matters, follow the fundraisers that inspire you, and stay connected.</p>
          <Link className="secondary" to="/discover">Explore fundraisers</Link></div>
        <div className="card"><h3>Account</h3>
          <Link className="secondary" to={user ? "/profile" : "/login"}>{user ? "My profile" : "Sign in"}</Link>
        </div>
      </aside>
    </div>
  </main>;
}
