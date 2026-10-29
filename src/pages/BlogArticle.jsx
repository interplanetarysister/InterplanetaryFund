import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../lib/supabase";
import { CampaignCard, Loading, Message } from "../components/UI";

const EMBED = /\[campaign:([a-f0-9-]{36})\]/gi;
function ArticleBody({ body }) {
  const [campaigns, setCampaigns] = useState([]);
  const matches = [...String(body || "").matchAll(EMBED)];
  const ids = [...new Set(matches.map((match) => match[1].toLowerCase()))];
  useEffect(() => {
    let cancelled = false;
    if (!db || !ids.length) { setCampaigns([]); return; }
    db.from("ifund_campaigns").select("*").eq("status", "active").in("id", ids)
      .then(({ data }) => { if (!cancelled) setCampaigns(data || []); })
      .catch(() => { if (!cancelled) setCampaigns([]); });
    return () => { cancelled = true; };
  }, [ids.join(",")]);
  const content = String(body || "").split(EMBED);
  const byId = new Map(campaigns.map((c) => [c.id.toLowerCase(), c]));
  return <div className="blog-body">{content.map((chunk, i) => {
    if (i % 2 === 1) {
      const campaign = byId.get(chunk.toLowerCase());
      return campaign ? <CampaignCard c={campaign} key={i} /> : null;
    }
    return chunk ? <p key={i} className="story">{chunk}</p> : null;
  })}</div>;
}
export default function BlogArticle() {
  const { id } = useParams();
  const [entry, setEntry] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setStatus("loading"); setEntry(null); setError("");
    if (!db) { setStatus("error"); setError("Blog service is unavailable."); return; }
    db.from("ifund_blog_entries")
      .select("id,owner_id,title,summary,body,kind,status,published_at")
      .eq("id", id).eq("status", "published").maybeSingle()
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) { setStatus("error"); setError(loadError.message); return; }
        if (!data) { setStatus("not-found"); return; }
        setEntry(data); setStatus("ready");
      }).catch((cause) => {
        if (cancelled) return;
        setStatus("error"); setError(cause?.message || "Article could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [id]);
  if (status === "loading") return <main className="blog-article"><Loading /></main>;
  if (status === "error") return <main className="blog-article">
    <h1>Article unavailable</h1><Message error>{error}</Message>
    <Link to="/blogs">Back to blogs</Link></main>;
  if (status === "not-found") return <main className="blog-article">
    <h1>Article not found</h1><p>This article is not publicly available.</p>
    <Link to="/blogs">Back to blogs</Link></main>;
  return <main className="blog-article">
    <Link to="/blogs">← Stories & Blogs</Link>
    <p className="eyebrow">{entry.kind === "newsletter" ? "IFUND NEWSLETTER" : "COMMUNITY BLOG"}</p>
    <h1>{entry.title}</h1>
    {entry.published_at && <p><small>{new Date(entry.published_at).toLocaleDateString()}</small></p>}
    {entry.summary && <p className="lede">{entry.summary}</p>}
    <ArticleBody body={entry.body} />
    <div className="actions">
      <Link className="secondary" to={"/blogs?author=" + entry.owner_id}>More from this author</Link>
      <Link className="secondary" to="/blogs">All stories</Link>
    </div>
  </main>;
}
