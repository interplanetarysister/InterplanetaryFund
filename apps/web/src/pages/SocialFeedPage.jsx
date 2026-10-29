import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authClient } from "@/api/auth";

export default function SocialFeedPage({ community = false }) {
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const client = authClient();
      const { data, error: queryError } = await client.from("ifund_posts")
        .select("id,author_id,body,created_at")
        .order("created_at", { ascending: false }).limit(50);
      if (queryError) throw queryError;
      setPosts(data || []); setError("");
    } catch { setError("Posts could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    try {
      authClient().auth.getUser().then(({ data }) => { if (active) setUser(data?.user || null); });
    } catch { /* show configuration error through load */ }
    load();
    return () => { active = false; };
  }, [load]);
  async function publish(e) {
    e.preventDefault();
    if (busy || !user || !body.trim()) return;
    setBusy(true); setError("");
    try {
      const { error: insertError } = await authClient().from("ifund_posts").insert({ author_id: user.id, body: body.trim() });
      if (insertError) throw insertError;
      setBody(""); await load();
    } catch { setError("Your post was not published. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header><h1 className="font-display text-3xl font-bold">{community ? "IFund Community" : "IFund Social"}</h1>
      <p className="mt-2 text-muted-foreground">{community ? "Connect with the Interplanetary Fund community." : "Share updates and discover community conversations."}</p></header>
    <nav className="flex gap-4 border-b border-border pb-3"><Link className="text-primary underline" to="/social">Social</Link><Link className="text-primary underline" to="/community">Community</Link></nav>
    {user ? <form onSubmit={publish} className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <label htmlFor="ifund-post" className="font-semibold">Share an update</label>
      <textarea id="ifund-post" required maxLength={2000} rows={4} value={body} onChange={e=>setBody(e.target.value)} className="w-full rounded-xl border border-input bg-background p-3" placeholder="What would you like to share?" />
      <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{body.length}/2000</span><button disabled={busy || !body.trim()} className="min-h-11 rounded-xl bg-primary px-5 text-primary-foreground disabled:opacity-50">{busy ? "Publishing…" : "Publish"}</button></div>
    </form> : <p className="rounded-xl border border-border p-4"><Link className="text-primary underline" to="/login">Sign in</Link> to share a post.</p>}
    {error && <p role="alert" className="rounded-xl border border-destructive p-4">{error}</p>}
    <section aria-label="Recent posts" className="space-y-4">
      <h2 className="text-xl font-semibold">Recent updates</h2>
      {loading ? <p role="status">Loading updates…</p> : posts.length === 0 ? <p className="rounded-xl border border-border p-5 text-muted-foreground">No public updates are available yet.</p> : posts.map(p=><article key={p.id} className="rounded-2xl border border-border bg-card p-5">
        <p className="whitespace-pre-wrap break-words">{p.body}</p>
        <time className="mt-3 block text-xs text-muted-foreground" dateTime={p.created_at}>{new Date(p.created_at).toLocaleString()}</time>
      </article>)}
    </section>
    <p className="text-sm text-muted-foreground">Groups, profiles, and external social syncing are being migrated separately.</p>
  </main>;
}
