import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { CampaignCard, Loading, Message } from "../components/UI";

export default function Dashboard({ user }) {
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    setCampaigns(null);
    setError("");
    if (!db || !user?.id) {
      setCampaigns([]);
      setError("Connect your account and database to view your campaigns.");
      return;
    }
    db.from("ifund_campaigns").select("*").eq("owner_id", user.id)
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        setCampaigns(data || []);
        setError(loadError?.message || "");
      }).catch((cause) => {
        if (cancelled) return;
        setCampaigns([]);
        setError(cause?.message || "Unable to load your campaign dashboard.");
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (!user) return <main><h1>Dashboard</h1>
    <p>Sign in to see and manage your own campaigns.</p>
    <Link className="primary" to="/login">Sign in</Link>
  </main>;

  const total = campaigns?.length || 0;
  const draft = campaigns?.filter((c) => c.status === "draft").length || 0;
  const active = campaigns?.filter((c) => c.status === "active").length || 0;
  return (
    <main>
      <section className="hero dashboard-hero">
        <p className="eyebrow">MISSION CONTROL · OVERVIEW</p>
        <h1>Your campaigns, in one place</h1>
        <p>Start a fundraiser, finish your private drafts, and connect with your community.</p>
        <div className="actions">
          <Link className="primary" to="/create">Create campaign</Link>
          <Link className="secondary" to="/mine">Manage campaigns</Link>
        </div>
      </section>
      <Message error>{error}</Message>
      {campaigns === null && !error ? <Loading /> : (
        <div className="dashboard-stats" aria-label="My campaign totals">
          <div className="card"><small>My campaigns</small><strong>{total}</strong></div>
          <div className="card"><small>Published</small><strong>{active}</strong></div>
          <div className="card"><small>Private drafts</small><strong>{draft}</strong></div>
        </div>
      )}
      <h2>Quick actions</h2>
      <div className="cards">
        <Link className="card" to="/create"><h3>New campaign</h3><p>Tell your story with the original step-by-step creator.</p></Link>
        <Link className="card" to="/discover"><h3>Discover</h3><p>Explore published community campaigns.</p></Link>
        <Link className="card" to="/community"><h3>Community</h3><p>See the latest public discussions.</p></Link>
        <Link className="card" to="/connections"><h3>Connections</h3><p>Review available integration status.</p></Link>
      </div>
      <h2>My recent campaigns</h2>
      {campaigns?.length ? <div className="cards">
        {campaigns.slice(0, 6).map((c) => <CampaignCard c={c} key={c.id} />)}
      </div> : campaigns && !error ? <p>Campaigns you create will appear here.</p> : null}
      <section className="card">
        <h3>Collect & Withdraw</h3>
        <p>Balances and withdrawals will appear only after the independent payment ledger and payout authorization are verified. No simulated totals are shown.</p>
      </section>
    </main>
  );
}
