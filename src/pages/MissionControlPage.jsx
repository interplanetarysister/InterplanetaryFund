import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";
import { campaignOverview } from "../lib/campaignReview";

const TABS = ["Briefing", "Recommendations", "Opportunities", "Automation"];
export default function MissionControl({ user }) {
  const [campaigns, setCampaigns] = useState(null);
  const [tab, setTab] = useState("Briefing");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setCampaigns(null); setError("");
    if (!db || !user?.id) { setCampaigns([]); return; }
    db.from("ifund_campaigns")
      .select("id,title,summary,story,category,goal_amount,cover_image_url,location,status")
      .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        setCampaigns(data || []); setError(loadError?.message || "");
      }).catch((cause) => {
        if (cancelled) return;
        setCampaigns([]); setError(cause?.message || "Unable to load your campaign overview.");
      });
    return () => { cancelled = true; };
  }, [user?.id, revision]);
  const review = useMemo(() => campaignOverview(campaigns || []), [campaigns]);
  if (!user) return <main><h1>Mission Control</h1>
    <p>Sign in to work with your own campaigns.</p>
    <Link className="primary" to="/login?returnTo=%2Fmission">Sign in</Link></main>;
  return <main className="mission-control">
    <div className="discover-heading">
      <div><h1>Mission Control</h1>
        <p>Your campaigns, recommendations, and next steps in one place. You make the decisions.</p></div>
      <button type="button" className="secondary" onClick={() => setRevision((n) => n + 1)}
        disabled={!db}>Refresh</button>
    </div>
    <Message error={Boolean(error)}>{error}</Message>
    <div className="mission-tabs" role="tablist" aria-label="Mission Control sections">
      {TABS.map((name) => <button key={name} type="button" role="tab"
        aria-selected={tab === name} className={tab === name ? "primary" : "secondary"}
        onClick={() => setTab(name)}>{name}</button>)}
    </div>
    {campaigns === null && !error ? <Loading /> : <>
      {tab === "Briefing" && <section>
        <h2>Campaign briefing</h2>
        <p>This summary is calculated from campaign records, not an AI-generated briefing.</p>
        <div className="dashboard-stats">
          <div className="card"><small>My campaigns</small><strong>{review.total}</strong></div>
          <div className="card"><small>Published</small><strong>{review.active}</strong></div>
          <div className="card"><small>Private drafts</small><strong>{review.drafts}</strong></div>
        </div>
        <div className="actions"><Link className="primary" to="/create">Create campaign</Link>
          <Link className="secondary" to="/mine">Manage my campaigns</Link></div>
        {review.paused > 0 && <p>{review.paused} paused campaigns are also listed in My Campaigns.</p>}
      </section>}
      {tab === "Recommendations" && <section>
        <h2>Campaign improvement suggestions</h2>
        <p>Suggestions use only your saved campaign fields. They do not imply that AI or external data analysis has run.</p>
        {review.actionItems.length ? <div className="mission-items">
          {review.actionItems.slice(0, 50).map((item) => <article className="card" key={item.campaignId + item.id}>
            <small>{item.campaignTitle}</small><h3>{item.title}</h3><p>{item.detail}</p>
            <Link to={item.campaignStatus === "draft"
              ? "/create?draft=" + encodeURIComponent(item.campaignId)
              : "/edit/" + item.campaignId}>Improve campaign</Link>
          </article>)}</div> : <p>No suggestions were identified from the fields currently available.</p>}
      </section>}
      {tab === "Opportunities" && <section>
        <h2>Opportunities</h2>
        <p>Current opportunities are ways to improve and share your own campaigns. Grant matching and external supporter discovery require separate, verified services.</p>
        <div className="cards">
          <Link className="card" to="/discover"><h3>Explore the IFund network</h3><p>Discover published causes and see how campaigns are presented.</p></Link>
          <Link className="card" to="/social"><h3>Join the community</h3><p>Post updates and connect with other members within IFund.</p></Link>
          <Link className="card" to="/connections"><h3>Review connection status</h3><p>Find out which external accounts are actually verified.</p></Link>
          <Link className="card" to="/blogs"><h3>Stories & Blogs</h3><p>Read community perspectives and prepare your own articles.</p></Link>
        </div>
      </section>}
      {tab === "Automation" && <section>
        <h2>Automation controls</h2>
        <p>Campaign automation and autonomous outbound posting are not active in the independent migration. No background agent is running because of a preference, page visit, or button press.</p>
        <p>Approved automations will require separate, verified connection permissions, audit records, and execution services.</p>
        <div className="actions"><Link className="secondary" to="/agents">AI Team</Link>
          <Link className="secondary" to="/connections">Connections</Link></div>
      </section>}
    </>}
  </main>;
}
