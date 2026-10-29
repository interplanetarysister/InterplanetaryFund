import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";

export default function Inbox({ user }) {
  const [items, setItems] = useState(null);
  const [tab, setTab] = useState("open");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setItems(null); setError("");
    if (!db || !user?.id) { setItems([]); return; }
    Promise.all([
      db.from("ifund_inbox_items")
        .select("id,platform,subject,body,campaign_id,status,created_at")
        .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100),
      db.from("ifund_notifications")
        .select("id,type,title,body,read,created_at,link")
        .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]).then(([inboxResult, noticesResult]) => {
      if (cancelled) return;
      if (inboxResult.error || noticesResult.error) {
        setItems([]);
        setError(inboxResult.error?.message || noticesResult.error?.message || "Inbox could not load.");
        return;
      }
      const inboxItems = (inboxResult.data || []).map((item) => ({
        key: "i-" + item.id, id: item.id, source: "inbox",
        platform: item.platform, title: item.subject || "Message",
        body: item.body, campaign_id: item.campaign_id,
        status: item.status, date: item.created_at,
        link: item.campaign_id ? "/campaign/" + item.campaign_id : "",
      }));
      const notices = (noticesResult.data || []).map((item) => ({
        key: "n-" + item.id, id: item.id, source: "notification",
        platform: "interplanetary", title: item.title, body: item.body,
        status: item.read ? "done" : "open", date: item.created_at,
        link: typeof item.link === "string" && /^\/(?!\/)[a-zA-Z0-9/_?#=&%.-]*$/.test(item.link) ? item.link : "",
      }));
      setItems([...inboxItems, ...notices].sort((a, b) => new Date(b.date) - new Date(a.date)));
    }).catch((cause) => {
      if (cancelled) return;
      setItems([]); setError(cause?.message || "Inbox could not load.");
    });
    return () => { cancelled = true; };
  }, [user?.id, revision]);

  async function complete(item) {
    if (!db || !user?.id || busy || item.status !== "open") return;
    setBusy(item.key); setError(""); setNotice("");
    try {
      const query = item.source === "notification"
        ? db.from("ifund_notifications").update({ read: true }).eq("owner_id", user.id)
        : db.from("ifund_inbox_items").update({ status: "done" }).eq("owner_id", user.id);
      const { data, error: saveError } = await query.eq("id", item.id).select("id");
      if (saveError) throw saveError;
      if (!data?.length) throw new Error("The update could not be verified.");
      setItems((existing) => (existing || []).map((current) =>
        current.key === item.key ? { ...current, status: "done" } : current));
      setNotice("Item marked done.");
    } catch (cause) {
      setError(cause?.message || "Could not update this item.");
    } finally { setBusy(""); }
  }

  if (!user) return <main><h1>Universal Inbox</h1>
    <p>Sign in to access your private communications center.</p>
    <Link className="primary" to="/login?returnTo=%2Finbox">Sign in</Link></main>;

  const platforms = [...new Set((items || []).map((item) => item.platform))];
  const visible = (items || []).filter((item) =>
    (tab === "all" || item.status === tab) &&
    (platform === "all" || item.platform === platform) &&
    (!search.trim() || [item.title,item.body,item.platform].join(" ")
      .toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  return <main className="universal-inbox">
    <h1>Universal Inbox</h1>
    <p>Your private IFund notifications and verified provider messages in one place.</p>
    <div className="card">
      <h2>Connected-platform messages</h2>
      <p>External messages require an authorized connection and a verified import. Nothing is fabricated or automatically synchronized.</p>
      <Link className="secondary" to="/connections">Manage connections</Link>
    </div>
    <div className="actions">
      <button type="button" className="secondary" disabled={!db}
        onClick={() => setRevision((n) => n + 1)}>Refresh</button>
      <Link className="secondary" to="/notifications">Notifications</Link>
    </div>
    <div className="inbox-filters">
      <div className="actions" role="group" aria-label="Inbox status">
        {["open","done","all"].map((value) =>
          <button key={value} type="button" className={tab === value ? "primary" : "secondary"}
            aria-pressed={tab === value} onClick={() => setTab(value)}>
            {value[0].toUpperCase() + value.slice(1)}</button>)}
      </div>
      <label>Platform
        <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
          <option value="all">All platforms</option>
          {platforms.map((value) => <option key={value} value={value}>{value}</option>)}
        </select></label>
      <label>Search messages
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search inbox…" /></label>
    </div>
    <Message error={Boolean(error)}>{error || notice}</Message>
    {items === null && !error ? <Loading /> : visible.length ?
      <div className="inbox-list">{visible.map((item) =>
        <article className="card" key={item.key}>
          <div className="notice-heading"><strong>{item.title}</strong>
            <span className="pill">{item.status === "open" ? "Open" : "Done"}</span></div>
          <small>{item.platform + " · " + new Date(item.date).toLocaleString()}</small>
          <p className="story">{item.body}</p>
          <div className="actions">
            {item.link && <Link className="secondary" to={item.link}>Open related page</Link>}
            {item.status === "open" && <button type="button" className="secondary"
              disabled={!!busy} onClick={() => complete(item)}>
              {busy === item.key ? "Updating…" : "Mark done"}</button>}
          </div>
        </article>)}</div> : !error ? <p>No items match your filters.</p> : null}
  </main>;
}
