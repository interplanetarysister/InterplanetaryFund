import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { CampaignCard, Loading } from "../components/UI";

const COLUMNS = "id,title,summary,story,category,goal_amount,cover_image_url,status,created_at";
export default function Dashboard({ user }) {
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!db || !user?.id) { setCampaigns([]); setError("Campaign data is not configured."); return; }
    setCampaigns(null);
    db.from("ifund_campaigns").select(COLUMNS).eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        setCampaigns(data || []);
        setError(queryError?.message || "");
      });
    return () => { active = false; };
  }, [user?.id]);
  const active = campaigns?.filter(c => c.status === "active") || [];
  const drafts = campaigns?.filter(c => c.status !== "active") || [];
  return <main className="ifund-dashboard">
    <div className="ifund-dashboard-heading">
      <div><p className="eyebrow">YOUR WORKSPACE</p><h1>Dashboard</h1>
        <p>Manage campaigns, follow their progress, and continue your fundraising journey.</p></div>
      <Link className="primary" to="/create">New campaign</Link>
    </div>
    <div className="ifund-dashboard-stats" aria-label="Campaign overview">
      <section className="card"><strong>{campaigns?.length ?? "—"}</strong><span>Total campaigns</span></section>
      <section className="card"><strong>{campaigns ? active.length : "—"}</strong><span>Published</span></section>
      <section className="card"><strong>{campaigns ? drafts.length : "—"}</strong><span>Other statuses</span></section>
    </div>
    <nav aria-label="Workspace shortcuts" className="ifund-dashboard-links">
      <Link to="/mine">My campaigns</Link><Link to="/connections">Connected platforms</Link>
      <Link to="/discover">Discover campaigns</Link><Link to="/community">Community</Link>
    </nav>
    {error && <p className="notice error" role="alert">Could not load your campaigns: {error}</p>}
    <h2>Your campaigns</h2>
    {campaigns === null ? <Loading /> : campaigns.length
      ? <div className="cards">{campaigns.map(c => <div key={c.id}><CampaignCard c={c} /><Link to={"/edit/" + c.id}>Edit campaign</Link></div>)}</div>
      : <section className="card"><h3>Start your first campaign</h3><p>Your campaigns will appear here after you create one.</p><Link className="primary" to="/create">Create campaign</Link></section>}
  </main>;
}
