import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Radio, Users, RefreshCw } from "lucide-react";
import { db } from "../lib/supabase";
import {
  createCommunityPost,
  deleteCommunityPost,
  workerCommunityApiEnabled,
} from "../lib/communityApi";
import { Message } from "../components/UI";

const PUBLIC_POST_COLUMNS = "id,body,created_at";

function Community({ user }) {
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ownPostIds, setOwnPostIds] = useState(new Set());
  const [posting, setPosting] = useState(false);
  const [removingPostId, setRemovingPostId] = useState(null);
  const postingRef = useRef(false);

  const load = async () => {
    if (!db) { setLoading(false); setMessage("Community updates are not connected yet."); return; }
    setLoading(true);
    const { data, error } = await db
      .from("ifund_posts")
      .select(PUBLIC_POST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setPosts([]);
      setOwnPostIds(new Set());
      setMessage("Community updates could not be loaded. Please try refreshing.");
      setLoading(false);
      return;
    }
    setLoading(false);
    setPosts(data || []);
    setMessage("");
    if (!user) {
      setOwnPostIds(new Set());
      return;
    }
    const { data: owned, error: ownershipError } = await db.rpc(
      "ifund_my_post_ids",
    );
    if (ownershipError) {
      setOwnPostIds(new Set());
      setMessage(
        "Community posts loaded, but ownership controls are temporarily unavailable.",
      );
      return;
    }
    setOwnPostIds(new Set((owned || []).map((item) => item.post_id)));
    setMessage("");
  };

  useEffect(() => {
    load().catch(() => { setPosts([]); setOwnPostIds(new Set()); setLoading(false); setMessage("Community updates could not be loaded."); });
  }, [user?.id]);

  async function post(e) {
    e.preventDefault();
    if (!user || !db || postingRef.current || !body.trim()) return;
    postingRef.current = true;
    setPosting(true);
    setMessage("");
    try {
      if (workerCommunityApiEnabled) {
        await createCommunityPost(db, body);
      } else {
        const { error } = await db
          .from("ifund_posts")
          .insert({ author_id: user.id, body: body.trim() });
        if (error) throw error;
      }
      setBody("");
      await load();
    } catch (error) {
      setMessage(error?.message || "Couldn't post the update.");
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  }

  async function remove(postId) {
    if (!user || !db || removingPostId || !ownPostIds.has(postId)) return;
    if (!window.confirm("Delete your community post?")) return;
    setRemovingPostId(postId);
    setMessage("");
    try {
      if (workerCommunityApiEnabled) {
        await deleteCommunityPost(db, postId);
      } else {
        const { data, error } = await db
          .from("ifund_posts")
          .delete()
          .eq("id", postId)
          .select("id");
        if (error) throw error;
        if (!data?.some((item) => item.id === postId)) {
          throw new Error("Post not found or cannot be deleted.");
        }
      }
      await load();
    } catch (error) {
      setMessage(error?.message || "Could not delete the post.");
    } finally {
      setRemovingPostId(null);
    }
  }

  return (
    <main>
      <section className="ifund-community-hero"><Radio size={28} aria-hidden="true"/><p className="eyebrow">YOUR COMMUNITY UNIVERSE</p><h1>Community Hub</h1><p>Share updates, discover stories, and connect with people supporting meaningful causes.</p><div className="actions"><Link to="/discover">Explore campaigns</Link><Link to="/globe">Planetary Atlas</Link></div></section>
      {user ? (
        <form className="form" onSubmit={post}>
          <label>
            Share an update
            <textarea
              required
              maxLength={2000}
              disabled={posting}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button type="submit" disabled={posting || !body.trim()}>
            {posting ? "Posting…" : "Post update"}
          </button>
        </form>
      ) : (
        <Link to="/login">Sign in to post</Link>
      )}
      <Message error>{message}</Message>
      <div className="ifund-community-feed-heading"><h2><Users size={21} aria-hidden="true"/> Community updates</h2><button type="button" onClick={() => load().catch(() => {setPosts([]);setOwnPostIds(new Set());setLoading(false);setMessage("Could not refresh updates.");})} disabled={loading}><RefreshCw size={17} aria-hidden="true"/> Refresh</button></div>
      {loading && <p role="status">Loading community updates…</p>}
      {!loading && posts.length === 0 && <section className="card"><h3>No updates yet</h3><p>Community posts will appear here when members share them.</p></section>}
      {posts.map((p) => (
        <article key={p.id} className="card">
          <small>{new Date(p.created_at).toLocaleDateString()}</small>
          <p>{p.body}</p>
          {ownPostIds.has(p.id) && (
            <button
              type="button"
              disabled={Boolean(removingPostId)}
              onClick={() => remove(p.id)}
            >
              {removingPostId === p.id ? "Deleting…" : "Delete my post"}
            </button>
          )}
        </article>
      ))}
    </main>
  );
}
export default Community;
