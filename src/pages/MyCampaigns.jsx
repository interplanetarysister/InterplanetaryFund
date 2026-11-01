import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Rocket, Plus, RefreshCw, AlertCircle } from "lucide-react";
import { db } from "../lib/supabase";
import { CampaignCard } from "../components/UI";

const OWNER_CAMPAIGN_COLUMNS = "id,title,summary,story,category,goal_amount,cover_image_url,status,created_at";

export default function MyCampaigns({ user }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!db || !user?.id) {
      setItems([]);
      setError("Sign in and connect account services to view your campaigns.");
      return;
    }
    setItems(null);
    setError("");
    db.from("ifund_campaigns")
      .select(OWNER_CAMPAIGN_COLUMNS)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        setItems(data || []);
        setError(queryError ? "Campaigns could not be loaded. Please try again." : "");
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setError("Campaigns could not be loaded. Please try again.");
      });
    return () => { cancelled = true; };
  }, [user?.id, refreshKey]);

  return <main className="ifund-my-campaigns">
    <section className="ifund-my-campaigns-hero">
      <Rocket size={30} aria-hidden="true" />
      <p className="eyebrow">YOUR MISSIONS</p>
      <h1>My campaigns</h1>
      <p>Find your fundraisers, make changes, or start something new.</p>
      <Link className="primary" to="/create"><Plus size={19} /> Create campaign</Link>
    </section>
    <div className="ifund-my-campaigns-heading">
      <h2>Your fundraisers</h2>
      <button className="secondary" type="button" onClick={() => setRefreshKey((n) => n + 1)} disabled={items === null || !db || !user?.id}>
        <RefreshCw size={18} /> Refresh
      </button>
    </div>
    {error && <p className="notice error" role="alert"><AlertCircle size={18} /> {error}</p>}
    {items === null ? <p role="status">Loading your campaigns...</p> :
      items.length ? <div className="ifund-my-campaigns-grid">
        {items.map((campaign) => <article key={campaign.id} className="ifund-my-campaigns-item">
          <CampaignCard c={campaign} />
          <Link className="ifund-my-campaigns-edit" to={"/edit/" + campaign.id}>Edit this campaign</Link>
        </article>)}
      </div> : !error && <section className="ifund-my-campaigns-empty">
        <Rocket size={36} aria-hidden="true" />
        <h3>No campaigns yet</h3>
        <p>Start your first fundraiser. You can save it as a draft before sharing it.</p>
        <Link className="primary" to="/create">Create your first campaign</Link>
      </section>}
  </main>;
}
