import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { CampaignCard, Loading } from "../components/UI";
import { DollarSign, Users, Flame, Sparkles, PlusCircle, HeartHandshake, Rocket } from "lucide-react";

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
      }).catch(() => {
        if (!active) return;
        setCampaigns([]);
        setError("Campaigns could not be loaded. Please try again later.");
      });
    return () => { active = false; };
  }, [user?.id]);
  const active = campaigns?.filter(c => c.status === "active") || [];
  return <main className="ifund-dashboard">
    <section className="ifund-dashboard-brandhero">
      <div className="ifund-dashboard-orb" aria-hidden="true">✦</div>
      <p className="eyebrow">THE UNIVERSAL FUNDRAISING OPERATING SYSTEM</p>
      <h2>What if endless possibilities could be reality?</h2>
      <p>Connect Once. Fund Everywhere.</p>
    </section>
    <div className="ifund-dashboard-heading">
      <div><p className="ifund-dashboard-kicker">Every gift you receive, in one place</p>
      <h1>Mission Dashboard</h1></div>
      <Link className="primary" to="/create"><PlusCircle size={18}/> Launch a Mission</Link>
    </div>
    <section className="ifund-onboarding">
      <span className="ifund-onboarding-icon"><Sparkles size={24}/></span>
      <div><strong>Set up your intelligent fundraising OS</strong>
      <p>Connect platforms, activate your AI Growth Engine, and organize fundraising outreach.</p></div>
      <Link to="/connections" aria-label="Explore connections">Connect</Link>
    </section>
    <div className="ifund-dashboard-stats" aria-label="Campaign overview">
      <section className="card"><DollarSign size={22}/><strong>—</strong><span>Total Raised</span><small>Verified totals unavailable</small></section>
      <section className="card"><Users size={22}/><strong>—</strong><span>Supporters</span><small>Verified totals unavailable</small></section>
      <section className="card"><Flame size={22}/><strong>{campaigns ? active.length : "—"}</strong><span>Active Campaigns</span></section>
    </div>
    <div className="ifund-dashboard-feature-grid">
      <section className="card"><h2><HeartHandshake size={22}/> Your fundraising</h2><p>Manage the causes you're building and sharing.</p>
        <div className="ifund-dashboard-links"><Link to="/mine">My Missions</Link><Link to="/discover">Discover</Link></div>
      </section>
      <section className="card"><h2><Rocket size={22}/> Mission Control</h2><p>Prepare your campaign outreach and connect the channels you want to use.</p>
        <div className="ifund-dashboard-links"><Link to="/mission">Open Mission Control</Link><Link to="/connections">Connections</Link></div>
      </section>
    </div>
    {error && <p className="notice error" role="alert">Could not load your campaigns: {error}</p>}
    <h2>Your Missions</h2>
    {campaigns === null ? <Loading /> : campaigns.length
      ? <div className="cards">{campaigns.map(c => <div key={c.id}><CampaignCard c={c} /><Link to={"/edit/" + c.id}>Edit campaign</Link></div>)}</div>
      : <section className="card"><h3>Start your first campaign</h3><p>Your campaigns will appear here after you create one.</p><Link className="primary" to="/create">Create campaign</Link></section>}
  </main>;
}
