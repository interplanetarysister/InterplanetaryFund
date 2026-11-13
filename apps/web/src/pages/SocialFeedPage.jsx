import "@/styles-sacred-social.css";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";
import { useAuthSession } from "@/hooks/useAuthSession";
import { canMemberPost, publishPost, MAX_POST_LENGTH } from "@/lib/socialPosts.js";
import { FEED_PAGE_SIZE, listPublicPosts } from "@/lib/publicSocialFeed";
import SocialPostList from "@/components/SocialPostList";

export default function SocialFeedPage({ community = false }) {
  const [posts, setPosts] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const { user, status } = useAuthSession();
  const [canPost, setCanPost] = useState(false);
  const [body, setBody] = useState("");
  const draftKey = user?.id ? `ifund-social-draft:${user.id}` : null;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [publishError, setPublishError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (before) => {
    setLoading(true);
    setFeedError("");
    try {
      const data = await listPublicPosts({ before });
      setPosts(previous => before ? [...previous, ...data] : data);
      setHasMore(data.length === FEED_PAGE_SIZE);
    } catch {
      setFeedError("Posts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setCanPost(false);
    if (user) Promise.resolve().then(() => canMemberPost(authClient(), user))
      .then(gate => { if (active) setCanPost(gate.ok); })
      .catch(() => { if (active) setCanPost(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!draftKey) { setBody(""); return; }
    try { setBody(localStorage.getItem(draftKey) || ""); } catch { setBody(""); }
  }, [draftKey]);

  function saveDraft() {
    if (!draftKey) return;
    try { localStorage.setItem(draftKey, body); setNotice("Draft saved on this device. It has not been published or shared."); }
    catch { setNotice("Draft could not be saved on this device."); }
  }

  async function publish(event) {
    event.preventDefault();
    if (busy || !canPost || !body.trim()) return;
    setBusy(true);
    setPublishError("");
    setNotice("");
    try {
      await publishPost(authClient(), user, body);
      setBody("");
      try { if (draftKey) localStorage.removeItem(draftKey); } catch { /* local storage unavailable */ }
      setNotice("Post published to IFund. External accounts have not been posted to.");
      await load();
    } catch (cause) {
      setPublishError(cause?.message || "Your post was not published. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="ifund-sacred-social mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header>
      <h1 className="font-display text-3xl font-bold">{community ? "IFund Community" : "IFund Social Feed"}</h1>
      <p className="mt-2 text-muted-foreground">Share updates and discover community conversations.</p>
    </header>
    <nav aria-label="Community pages" className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border pb-3 text-primary underline">
      <Link to="/social" aria-current={community ? undefined : "page"}>Social Feed</Link>
      <Link to="/community" aria-current={community ? "page" : undefined}>Community</Link>
      <Link to="/blogs">Stories &amp; Blogs</Link>
      <Link to="/news">IFund Newscaster</Link>
    </nav>
    {canPost ? <form onSubmit={publish} className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <label htmlFor="ifund-post" className="font-semibold">Share an update</label>
      <textarea id="ifund-post" required maxLength={MAX_POST_LENGTH} rows={4} value={body}
        onChange={e => setBody(e.target.value)} className="w-full rounded-xl border border-input bg-background p-3" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{body.length}/{MAX_POST_LENGTH}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy || !body.trim()} onClick={saveDraft} className="min-h-11 rounded-xl border border-border px-4 disabled:opacity-50">Save draft</button>
          <button disabled={busy || !body.trim()} className="min-h-11 rounded-xl bg-primary px-5 text-primary-foreground disabled:opacity-50">{busy ? "Publishing…" : "Publish to IFund"}</button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Drafts are stored only in this browser. Manage external accounts under <Link className="underline" to="/connections">Connections</Link>; publishing here does not automatically post elsewhere.</p>
    </form> : status !== "loading" && <p className="rounded-xl border border-border p-4">
      {user ? "Posting requires a verified, active account." : <><Link className="text-primary underline" to="/login?returnTo=%2Fsocial">Sign in</Link> to share a post.</>}
    </p>}
    {publishError && <p role="alert" className="rounded-xl border border-destructive p-4">{publishError}</p>}
    {notice && <p role="status">{notice}</p>}
    <section aria-labelledby="recent-posts" className="space-y-4">
      <h2 id="recent-posts" className="text-xl font-semibold">Recent updates</h2>
      <SocialPostList posts={posts} onHidden={postId => setPosts(current => current.filter(post => post.id !== postId))} />
      {loading && <p role="status">Loading updates…</p>}
      {feedError && <p role="alert">{feedError} <button type="button" onClick={() => load(posts.at(-1))} className="min-h-11 text-primary underline">Retry</button></p>}
      {!loading && !feedError && posts.length === 0 && <p className="rounded-xl border border-border p-5 text-muted-foreground">No public updates yet.</p>}
      {!loading && !feedError && hasMore && <button type="button" className="min-h-11 rounded-xl border border-border px-4" onClick={() => load(posts.at(-1))}>Load older posts</button>}
    </section>
  </div>;
}
