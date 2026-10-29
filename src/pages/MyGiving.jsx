import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";

const usd = (cents) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD",
}).format(Number(cents || 0) / 100);

export default function MyGiving({ user }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setItems(null); setError("");
    if (!db || !user?.id) {
      setItems([]); return;
    }
    db.from("ifund_donations")
      .select("id,campaign_id,gift_cents,optional_support_cents,currency,status,created_at,captured_at")
      .eq("donor_id", user.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        setItems(data || []);
        setError(loadError?.message || "");
      }).catch((cause) => {
        if (cancelled) return;
        setItems([]); setError(cause?.message || "Giving history could not be loaded.");
      });
    return () => { cancelled = true; };
  }, [user?.id, revision]);

  const completed = (items || []).filter((gift) => gift.status === "captured");
  const totalGift = completed.reduce((sum, gift) => sum + Number(gift.gift_cents || 0), 0);
  const totalSupport = completed.reduce((sum, gift) => sum + Number(gift.optional_support_cents || 0), 0);
  const shown = (items || []).filter((gift) => filter === "all" || gift.status === filter);

  if (!user) return <main><h1>My Giving</h1>
    <p>Sign in to review your own giving history.</p>
    <Link className="primary" to="/login?returnTo=%2Fgiving">Sign in</Link></main>;
  return <main className="giving-page">
    <h1>My Giving</h1>
    <p>See donations made through your IFund account. Only confirmed PayPal captures count as completed gifts.</p>
    <div className="actions">
      <Link className="primary" to="/discover">Explore campaigns</Link>
      <button type="button" className="secondary" disabled={!db}
        onClick={() => setRevision((n) => n + 1)}>Refresh</button>
    </div>
    <Message error={Boolean(error)}>{error}</Message>
    {items === null && !error ? <Loading /> : <>
      <div className="dashboard-stats">
        <div className="card"><small>Completed campaign gifts</small><strong>{usd(totalGift)}</strong></div>
        <div className="card"><small>Optional platform support</small><strong>{usd(totalSupport)}</strong></div>
        <div className="card"><small>Captured gifts</small><strong>{completed.length}</strong></div>
      </div>
      <div className="actions" role="group" aria-label="Giving history filter">
        {[["all", "All"], ["captured", "Completed"], ["created", "Created"],
          ["approved", "Approved"], ["refunded", "Refunded"], ["failed", "Failed"]]
          .map(([value, label]) => <button key={value} type="button"
            className={filter === value ? "primary" : "secondary"}
            aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      <h2>Donation history</h2>
      {shown.length ? <div className="giving-list">
        {shown.map((gift) => <article className="card" key={gift.id}>
          <div className="giving-row"><strong>{usd(gift.gift_cents)}</strong>
            <span className="pill">{gift.status}</span></div>
          <p><small>{"Created " + new Date(gift.created_at).toLocaleDateString()}</small></p>
          <p>{"Optional support: " + usd(gift.optional_support_cents)}</p>
          <Link to={"/campaign/" + gift.campaign_id}>View campaign</Link>
        </article>)}
      </div> : !error ? <p>No {filter === "all" ? "" : filter + " "}donations found in this account.</p> : null}
      <p className="giving-note">Gifts made as a guest or using another account may not appear here. Pending or refunded payments are excluded from completed totals.</p>
    </>}
  </main>;
}
