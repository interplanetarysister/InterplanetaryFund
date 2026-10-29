import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { CampaignCard, Loading, Message } from "../components/UI";

export default function FollowedCampaigns({ user }) {
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setCampaigns(null); setError("");
    if (!db || !user?.id) { setCampaigns([]); return; }
    async function load() {
      try {
        const { data: follows, error: followError } = await db
          .from("ifund_campaign_follows").select("campaign_id")
          .eq("follower_id", user.id).order("created_at", { ascending: false });
        if (followError) throw followError;
        const ids = (follows || []).map((row) => row.campaign_id);
        if (!ids.length) { if (!cancelled) setCampaigns([]); return; }
        const { data, error: campaignError } = await db.from("ifund_campaigns")
          .select("*").eq("status", "active").in("id", ids);
        if (campaignError) throw campaignError;
        if (!cancelled) {
          const byId = new Map((data || []).map((campaign) => [campaign.id, campaign]));
          setCampaigns(ids.map((id) => byId.get(id)).filter(Boolean));
        }
      } catch (cause) {
        if (!cancelled) {
          setCampaigns([]);
          setError(cause?.message || "Followed campaigns could not be loaded.");
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user?.id, revision]);

  async function unfollow(campaignId) {
    if (!db || !user || busy) return;
    setBusy(campaignId); setError(""); setNotice("");
    try {
      const { data, error: deleteError } = await db.from("ifund_campaign_follows")
        .delete().eq("campaign_id", campaignId).eq("follower_id", user.id)
        .select("campaign_id");
      if (deleteError) throw deleteError;
      if (!data?.length) throw new Error("Could not verify the follow was removed.");
      setCampaigns((items) => (items || []).filter((campaign) => campaign.id !== campaignId));
      setNotice("Campaign removed from Following.");
    } catch (cause) { setError(cause?.message || "Unable to unfollow."); }
    finally { setBusy(""); }
  }

  if (!user) return <main><h1>Following</h1>
    <p>Sign in to view campaigns you follow.</p>
    <Link className="primary" to="/login?returnTo=%2Ffollowing">Sign in</Link></main>;
  return <main>
    <h1>Following</h1>
    <p>Find the active campaigns you saved, revisit their stories, and choose when to stop following.</p>
    <div className="actions">
      <Link className="primary" to="/discover">Discover campaigns</Link>
      <button type="button" className="secondary" onClick={() => setRevision((n) => n + 1)}>Refresh</button>
    </div>
    <Message error={!!error}>{error || notice}</Message>
    {campaigns === null && !error ? <Loading /> : campaigns?.length ?
      <div className="cards">{campaigns.map((c) =>
        <div key={c.id}><CampaignCard c={c} />
          <button type="button" className="secondary compare-button" disabled={!!busy}
            onClick={() => unfollow(c.id)}>
            {busy === c.id ? "Removing…" : "Unfollow"}</button>
        </div>)}</div> : !error ? <p>No campaigns followed yet.</p> : null}
  </main>;
}
