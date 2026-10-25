import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { Message } from "../components/UI";
function Community({ user }) {
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [posts, setPosts] = useState([]);
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
    if (!user) return;
    const { error } = await db
      .from("ifund_posts")
      .insert({ author_id: user.id, body: body.trim() });
    if (error) setMessage(error.message);
    else {
      setBody("");
      load();
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
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <button type="submit" disabled={!body.trim()}>
            Post update
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
        </article>
      ))}
    </main>
  );
}
export default Community;
