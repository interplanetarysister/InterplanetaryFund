import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import {
  createCommunityPost,
  deleteCommunityPost,
  workerCommunityApiEnabled,
} from "../lib/communityApi";
import { Message } from "../components/UI";
function Community({ user }) {
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [posts, setPosts] = useState([]);
  const [posting, setPosting] = useState(false);
  const [removingPostId, setRemovingPostId] = useState(null);
  const postingRef = useRef(false);
  const load = () =>
    db
      ?.from("ifund_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        setPosts(data || []);
        if (error) setMessage(error.message);
      });
  useEffect(() => {
    load();
  }, []);
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
    if (!user || !db || removingPostId) return;
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
          .eq("author_id", user.id)
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
      <h1>Community</h1>
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
      {posts.map((p) => (
        <article key={p.id} className="card">
          <small>{new Date(p.created_at).toLocaleDateString()}</small>
          <p>{p.body}</p>
          {user?.id === p.author_id && (
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
