import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";

export default function Blogs() {
  const [params, setParams] = useSearchParams();
  const author = params.get("author") || "";
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setItems(null); setError("");
    if (!db) {
      setItems([]); setError("Blog database is not connected."); return;
    }
    let query = db.from("ifund_blog_entries")
      .select("id,owner_id,title,summary,kind,published_at,status")
      .eq("status", "published").order("published_at", { ascending: false }).limit(100);
    if (author) query = query.eq("owner_id", author);
    query.then(({ data, error: loadError }) => {
      if (cancelled) return;
      setItems(data || []); setError(loadError?.message || "");
    }).catch((cause) => {
      if (cancelled) return;
      setItems([]); setError(cause?.message || "Unable to load blog entries.");
    });
    return () => { cancelled = true; };
  }, [author, revision]);
  const official = (items || []).filter((entry) => entry.kind === "newsletter");
  const community = (items || []).filter((entry) => entry.kind !== "newsletter");
  const renderCards = (entries) => <div className="cards">{entries.map((entry) =>
    <Link to={"/blogs/" + entry.id} key={entry.id} className="card">
      <small>{entry.kind === "newsletter" ? "IFund newsletter" : "Community blog"}
        {entry.published_at ? " · " + new Date(entry.published_at).toLocaleDateString() : ""}</small>
      <h3>{entry.title}</h3><p>{entry.summary || "Read the article"}</p>
    </Link>)}</div>;
  return <main className="blog-index">
    <div className="discover-heading"><div>
      <h1>IFund Stories & Blogs</h1>
      <p>Newsletters, community stories, ideas, and member journalism.</p></div>
      <div className="actions">
        <Link className="primary" to="/my-blog">My Blog Studio</Link>
        <button type="button" className="secondary" onClick={() => setRevision((n) => n + 1)}>Refresh</button>
      </div>
    </div>
    {author && <Link to="/blogs">View all published blogs</Link>}
    <Message error={Boolean(error)}>{error}</Message>
    {items === null && !error ? <Loading /> : <>
      <section><h2>IFund publications</h2>
        {official.length ? renderCards(official) :
          <p>No public newsletters have been published on the independent platform yet.</p>}</section>
      <section><h2>Community blogs</h2>
        {community.length ? renderCards(community) :
          <p>No published member stories yet.</p>}</section>
    </>}
  </main>;
}
