import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { CampaignCard, Loading, Message } from "../components/UI";

export default function MyCampaigns({ user }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError("");
    if (!db || !user?.id) {
      setItems([]);
      setError("Sign in and connect the database to load your campaigns.");
      return;
    }
    db.from("ifund_campaigns").select("*").eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        setItems(data || []);
        setError(loadError?.message || "");
      }).catch((cause) => {
        if (cancelled) return;
        setItems([]);
        setError(cause?.message || "Unable to load campaigns.");
      });
    return () => { cancelled = true; };
  }, [user?.id, revision]);
  const shown = (items || []).filter((campaign) => filter === "all" || campaign.status === filter);
  return (
    <main>
      <h1>My campaigns</h1>
      <p>Keep private drafts, finish your story, and manage published fundraisers.</p>
      <div className="actions">
        <Link className="primary" to="/create">New campaign</Link>
        <button type="button" className="secondary" onClick={() => setRevision((n) => n + 1)}>
          Refresh
        </button>
      </div>
      <Message error>{error}</Message>
      {items === null && !error ? <Loading /> : (
        <>
          <div className="actions" role="group" aria-label="Filter my campaigns">
            {[
              ["all", "All"],
              ["draft", "Drafts"],
              ["active", "Published"],
              ["paused", "Paused"],
            ].map(([value, label]) =>
              <button key={value} type="button"
                className={filter === value ? "primary" : "secondary"}
                aria-pressed={filter === value} onClick={() => setFilter(value)}>
                {label}{items && " (" + (value === "all" ? items.length : items.filter((c) => c.status === value).length) + ")"}
              </button>)}
          </div>
          <div className="cards">
            {shown.map((campaign) => (
              <article key={campaign.id} className="my-campaign">
                <CampaignCard c={campaign} />
                <div className="actions">
                  <Link className="secondary" to={campaign.status === "draft"
                    ? "/create?draft=" + encodeURIComponent(campaign.id)
                    : "/edit/" + campaign.id}>
                    {campaign.status === "draft" ? "Continue draft" : "Edit campaign"}
                  </Link>
                  {campaign.status === "active" &&
                    <Link className="secondary" to={"/campaign/" + campaign.id}>View campaign</Link>}
                </div>
              </article>
            ))}
          </div>
          {!error && shown.length === 0 &&
            <p>{filter === "all" ? "No campaigns yet. Create your first fundraiser." : "No campaigns in this category."}</p>}
        </>
      )}
    </main>
  );
}
