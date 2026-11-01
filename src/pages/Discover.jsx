import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, LifeBuoy, HeartHandshake } from "lucide-react";
import { db } from "../lib/supabase";
import { Loading, Message, CampaignCard } from "../components/UI";

const COLUMNS = "id,title,summary,story,category,goal_amount,cover_image_url,status,created_at";
export default function Discover() {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    let active = true;
    if (!db) { setList([]); setError("Campaign data is not configured."); return; }
    setList(null);
    db.from("ifund_campaigns").select(COLUMNS).eq("status", "active")
      .order("created_at", { ascending: false }).limit(100)
      .then(({ data, error: e }) => {
        if (!active) return;
        setList(data || []);
        setError(e?.message || "");
      }).catch(() => {
        if (!active) return;
        setList([]);
        setError("Campaigns could not be loaded. Please try again later.");
      });
    return () => { active = false; };
  }, []);
  const categories = useMemo(() => Array.from(new Set((list || []).map(c => c.category).filter(Boolean))).sort(), [list]);
  const category = params.get("category") || "all";
  const selected = category === "all" || categories.includes(category) ? category : "all";
  const filtered = (list || []).filter(c =>
    (selected === "all" || c.category === selected) &&
    (!query.trim() || (c.title + " " + (c.summary || "")).toLowerCase().includes(query.trim().toLowerCase()))
  );
  return <main className="ifund-discover">
    <div className="ifund-discover-heading">
      <div><p className="eyebrow">EXPLORE THE UNIVERSE OF GIVING</p><h1>Explore Universe</h1>
        <p>What if your support changed everything for someone today? These causes need help right now.</p></div>
      <Link className="secondary" to="/help"><LifeBuoy size={18}/> Help Center</Link>
    </div>
    <section className="ifund-discover-featured">
      <HeartHandshake size={28}/><div><h2>Find a cause that moves you</h2>
      <p>Explore active campaigns and discover the people making a difference.</p></div>
    </section>
    <label className="ifund-discover-search"><Search size={20}/><span className="sr-only">Search campaigns</span>
      <input type="search" value={query} onChange={e => setQuery(e.target.value)}
        placeholder="Search campaigns by name or cause…" /></label>
    <div className="ifund-discover-filters" role="group" aria-label="Campaign category">
      {["all", ...categories].map(c => <button key={c} type="button" aria-pressed={selected === c}
        className={selected === c ? "is-active" : ""}
        onClick={() => setParams(c === "all" ? {} : { category: c })}>{c === "all" ? "All" : c}</button>)}
    </div>
    <Message error>{error}</Message>
    {list === null ? <Loading /> : filtered.length
      ? <div className="cards">{filtered.map(c => <CampaignCard c={c} key={c.id} />)}</div>
      : <p className="ifund-discover-empty">No active campaigns match this search yet — what if yours was the first?</p>}
  </main>;
}
