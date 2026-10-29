import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";

const safePath = (path) => typeof path === "string" &&
  /^\/(?!\/)[a-zA-Z0-9/_?#=&%.-]*$/.test(path);

export default function Notifications({ user }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setItems(null); setError("");
    if (!db || !user?.id) { setItems([]); return; }
    db.from("ifund_notifications")
      .select("id,type,title,body,link,read,created_at")
      .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        setItems(data || []); setError(loadError?.message || "");
      }).catch((cause) => {
        if (cancelled) return;
        setItems([]); setError(cause?.message || "Notifications could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [user?.id, revision]);

  async function markRead(ids) {
    if (!db || !user || busy || ids.length === 0) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const { data, error: updateError } = await db.from("ifund_notifications")
        .update({ read: true }).eq("owner_id", user.id).in("id", ids)
        .select("id");
      if (updateError) throw updateError;
      if (!Array.isArray(data) || data.length !== ids.length)
        throw new Error("Not all updates could be verified. Refresh before retrying.");
      const updated = new Set(data.map((item) => item.id));
      setItems((previous) => (previous || []).map((item) =>
        updated.has(item.id) ? { ...item, read: true } : item));
      setNotice("Notifications marked as read.");
    } catch (cause) {
      setError(cause?.message || "Unable to update notifications.");
    } finally { setBusy(false); }
  }
  if (!user) return <main><h1>Notifications</h1>
    <p>Sign in to view private account notices.</p>
    <Link className="primary" to="/login?returnTo=%2Fnotifications">Sign in</Link></main>;

  const unread = (items || []).filter((item) => !item.read);
  const shown = (items || []).filter((item) => filter === "all" || !item.read);
  return <main className="account-notifications">
    <h1>Notifications</h1>
    <p>Alerts attached to your IFund account. External activity appears only after verified integrations report it.</p>
    <div className="actions">
      <button type="button" className="secondary" onClick={() => setRevision((n) => n + 1)}
        disabled={!db || busy}>Refresh</button>
      <button type="button" className="secondary" onClick={() => markRead(unread.map((item) => item.id))}
        disabled={busy || !unread.length}>{busy ? "Saving…" : "Mark all read"}</button>
      <span className="pill">{unread.length} unread</span>
    </div>
    <div className="actions" role="group" aria-label="Filter notifications">
      {["all","unread"].map((value) =>
        <button key={value} type="button" className={filter === value ? "primary" : "secondary"}
          aria-pressed={filter === value} onClick={() => setFilter(value)}>
          {value === "all" ? "All" : "Unread"}</button>)}
    </div>
    <Message error={Boolean(error)}>{error || notice}</Message>
    {items === null && !error ? <Loading /> : shown.length ? <div className="notice-list">
      {shown.map((item) => <article key={item.id} className="card">
        <div className="notice-heading">
          <strong>{item.title}</strong>
          {!item.read && <span className="pill">Unread</span>}
        </div>
        <small>{new Date(item.created_at).toLocaleString()}</small>
        {item.body && <p>{item.body}</p>}
        <div className="actions">
          {safePath(item.link) && <Link to={item.link} className="secondary">Open</Link>}
          {!item.read && <button type="button" className="text-button"
            disabled={busy} onClick={() => markRead([item.id])}>Mark read</button>}
        </div>
      </article>)}</div> : !error ?
      <p>{filter === "unread" ? "No unread notifications." : "No notifications yet."}</p> : null}
  </main>;
}
