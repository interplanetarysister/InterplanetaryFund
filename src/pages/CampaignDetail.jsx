import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../lib/supabase";
import { CampaignCard, Loading, Message, Planet } from "../components/UI";

const labels = {
  medical: "Medical", emergency: "Emergency", education: "Education",
  community: "Community", animals: "Animals", business: "Business",
  memorial: "Memorial", disaster_relief: "Disaster Relief",
  creative: "Creative", environment: "Planet & Environment", other: "Other",
};

export default function CampaignDetail({ user }) {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [related, setRelated] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!db) {
      setLoadState("error"); setError("Campaign database is unavailable.");
      return;
    }
    setCampaign(null); setRelated([]); setLoadState("loading"); setError("");
    db.from("ifund_campaigns").select("*").eq("id", id).maybeSingle()
      .then(async ({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) throw loadError;
        if (!data) {
          setLoadState("not_found");
          return;
        }
        setCampaign(data); setLoadState("ready");
        const { data: other } = await db.from("ifund_campaigns")
          .select("*").eq("status", "active").eq("category", data.category)
          .neq("id", id).order("created_at", { ascending: false }).limit(3);
        if (!cancelled) setRelated(other || []);
      }).catch((cause) => {
        if (cancelled) return;
        setLoadState("error"); setError(cause?.message || "Campaign could not load.");
      });
    return () => { cancelled = true; };
  }, [id, revision]);

  async function share() {
    const link = window.location.origin + "/campaign/" + encodeURIComponent(id);
    try {
      if (navigator.share) {
        await navigator.share({ title: campaign.title || "Interplanetary Fund", url: link });
        return;
      }
      if (!navigator.clipboard?.writeText) throw new Error("Copy is unavailable in this browser.");
      await navigator.clipboard.writeText(link);
      setNotice("Campaign link copied.");
    } catch (cause) {
      if (cause?.name === "AbortError") return;
      setError(cause?.message || "Could not share this campaign.");
    }
  }

  if (loadState === "loading") return <main className="detail"><Loading /></main>;
  if (loadState === "not_found") return <main className="detail"><h1>Campaign not found</h1>
    <p>This campaign may be private, unavailable, or deleted.</p>
    <Link to="/discover">Browse campaigns</Link></main>;
  if (loadState === "error") return <main className="detail"><h1>Campaign unavailable</h1>
    <Message error>{error}</Message>
    <button type="button" className="secondary" onClick={() => setRevision((n) => n + 1)}>Retry</button>
  </main>;
  const mine = campaign.owner_id === user?.id;
  const status = campaign.status === "active" ? "Published"
    : campaign.status === "paused" ? "Paused" : "Private draft";
  return <main className="campaign-details">
    <div className="campaign-detail-grid">
      <article className="campaign-detail-main">
        {campaign.cover_image_url
          ? <img className="campaign-detail-cover" src={campaign.cover_image_url} alt={campaign.title || "Campaign cover"} />
          : <div className="campaign-detail-cover cover-empty"><Planet /></div>}
        {campaign.cover_image_is_ai &&
          <p><small>AI-generated illustration · People shown may represent campaign subjects.</small></p>}
        <div className="actions">
          <span className="pill">{labels[campaign.category] || "Other"}</span>
          <span className="pill">{status}</span>
        </div>
        <h1>{campaign.title || "Untitled campaign"}</h1>
        {campaign.summary && <p className="lede">{campaign.summary}</p>}
        {campaign.location && <p>Location: {campaign.location}</p>}
        {campaign.end_date && <p>End date: {campaign.end_date}</p>}
        <section className="card">
          <h2>Campaign story</h2>
          <div className="story">{campaign.story || campaign.summary || "No story has been added yet."}</div>
        </section>
        <div className="actions">
          <button type="button" onClick={share} className="secondary">Share campaign</button>
          {mine && <Link className="secondary" to={"/edit/" + campaign.id}>Edit campaign</Link>}
          {mine && <Link className="secondary" to="/mine">My campaigns</Link>}
        </div>
        <Message error={Boolean(error)}>{error || notice}</Message>
      </article>
      <aside className="campaign-detail-sidebar">
        <section className="card">
          <h2>Funding goal</h2>
          <strong className="campaign-goal">{"$" + Number(campaign.goal_amount || 0).toLocaleString()}</strong>
          <p>Verified donation totals are unavailable until independent payment reconciliation is enabled.</p>
          <p>PayPal checkout is not enabled in this preview; no payment will be collected from this screen.</p>
        </section>
        <section className="card"><h3>Support the campaign</h3>
          <p>Share this fundraiser while verified payment checkout is being completed.</p>
          <button type="button" className="primary" onClick={share}>Share this campaign</button>
        </section>
      </aside>
    </div>
    {related.length > 0 && <section>
      <h2>More campaigns you may like</h2>
      <div className="cards">{related.map((item) =>
        <CampaignCard c={item} key={item.id} />)}</div>
    </section>}
  </main>;
}
