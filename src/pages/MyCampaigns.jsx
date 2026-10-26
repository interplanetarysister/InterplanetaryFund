import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { CampaignCard } from "../components/UI";
function MyCampaigns({ user }) {
  const [state, setState] = useState({ loading: true, items: [], error: "" });
  useEffect(() => {
    let active = true;
    if (!db || !user) {
      setState({
        loading: false,
        items: [],
        error: "Your campaign account is not connected.",
      });
      return;
    }
    db.from("ifund_campaigns")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (active)
          setState({
            loading: false,
            items: data || [],
            error: error ? "Your campaigns could not be verified." : "",
          });
      })
      .catch(() => {
        if (active)
          setState({
            loading: false,
            items: [],
            error: "Campaign service is unavailable.",
          });
      });
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <main className="stack">
      <h1>My campaigns</h1>
      <Link className="primary" to="/create">
        Create campaign
      </Link>
      {state.loading ? (
        <p role="status">Loading campaigns…</p>
      ) : state.error ? (
        <p role="alert">{state.error}</p>
      ) : state.items.length === 0 ? (
        <p>
          There are no campaigns attached to this verified account. Legacy
          records have not been automatically published.
        </p>
      ) : null}
      <div className="cards">
        {state.items.map((c) => (
          <div key={c.id}>
            <CampaignCard c={c} />
            <Link to={"/edit/" + c.id}>Edit campaign</Link>
          </div>
        ))}
      </div>
    </main>
  );
}
export default MyCampaigns;
