import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message, CampaignCard } from "../components/UI";

const categories = {
  all: "All", medical: "Medical", emergency: "Emergency",
  education: "Education", community: "Community", animals: "Animals",
  business: "Business", memorial: "Memorial", disaster_relief: "Disaster Relief",
  creative: "Creative", environment: "Planet & Environment", other: "Other",
};

export default function Discover() {
  const [params, setParams] = useSearchParams();
  const category = categories[params.get("category")] ? params.get("category") : "all";
  const [search, setSearch] = useState("");
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [compareIds, setCompareIds] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setCampaigns(null); setError("");
    if (!db) {
      setCampaigns([]); setError("Campaign database is not configured.");
      return;
    }
    db.from("ifund_campaigns").select("*")
      .eq("status", "active").order("created_at", { ascending: false }).limit(100)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        setCampaigns(data || []); setError(loadError?.message || "");
      }).catch((cause) => {
        if (cancelled) return;
        setCampaigns([]); setError(cause?.message || "Could not load campaigns.");
      });
    return () => { cancelled = true; };
  }, [revision]);

  const filtered = (campaigns || [])
    .filter((c) => category === "all" || c.category === category)
    .filter((c) => !search.trim() ||
      [c.title, c.summary, c.story].join(" ").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const compared = compareIds.map((id) => (campaigns || []).find((c) => c.id === id)).filter(Boolean);
  function toggle(id) {
    setCompareIds((ids) => ids.includes(id)
      ? ids.filter((value) => value !== id)
      : ids.length < 3 ? [...ids, id] : ids);
  }
  return <main className="discover-page">
    <div className="discover-heading">
      <div><h1>Discover campaigns</h1>
        <p>Explore real fundraisers and compare goals before choosing where to support.</p></div>
      <button className="secondary" type="button" onClick={() => setRevision((n) => n + 1)}
        disabled={!db}>Refresh</button>
    </div>
    <label className="discover-search">Search campaigns by name or cause
      <input type="search" placeholder="Search campaigns…"
        value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    <div className="category-strip" role="group" aria-label="Filter by campaign category">
      {Object.entries(categories).map(([id, label]) =>
        <button key={id} type="button"
          className={category === id ? "primary" : "secondary"}
          aria-pressed={category === id}
          onClick={() => setParams(id === "all" ? {} : { category: id })}>{label}</button>)}
    </div>
    <Message error>{error}</Message>
    {campaigns === null && !error ? <Loading /> : <>
      {compared.length > 0 && <section className="card" aria-label="Campaign comparison">
        <div className="discover-heading"><div><h2>Compare campaigns</h2>
          <p>Choose up to three. Funding goals are supplied by campaign creators.</p></div>
          <button type="button" className="secondary" onClick={() => setCompareIds([])}>Clear</button></div>
        <div className="compare-scroll"><table className="compare-table">
          <thead><tr><th>Campaign</th><th>Category</th><th>Funding goal</th><th>Verified raised</th></tr></thead>
          <tbody>{compared.map((c) => <tr key={c.id}>
            <td><Link to={"/campaign/" + c.id}>{c.title}</Link></td>
            <td>{categories[c.category] || "Other"}</td>
            <td>{"$" + Number(c.goal_amount || 0).toLocaleString()}</td>
            <td>Not yet available</td></tr>)}</tbody></table></div>
      </section>}
      {filtered.length === 0 && !error
        ? <p className="card">No published campaigns match these filters.</p>
        : <div className="cards discover-grid">{filtered.map((c) =>
          <div key={c.id}>
            <CampaignCard c={c} />
            <button type="button" className="secondary compare-button"
              aria-pressed={compareIds.includes(c.id)}
              disabled={!compareIds.includes(c.id) && compareIds.length >= 3}
              onClick={() => toggle(c.id)}>
              {compareIds.includes(c.id) ? "Remove from comparison" : "Compare campaign"}
            </button>
          </div>)}</div>}
      {campaigns.length >= 100 && <small>Showing the latest 100 published campaigns. More results may exist.</small>}
    </>}
  </main>;
}
