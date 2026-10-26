import { useEffect, useState } from "react";
import { db } from "../lib/supabase";
import { Loading, Message, CampaignCard } from "../components/UI";
function Discover() {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!db) {
      setList([]);
      setError(
        "Campaign discovery is unavailable until the independent data service is configured.",
      );
      return;
    }
    let active = true;
    db.from("ifund_campaigns")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .then(({ data, error: e }) => {
        if (!active) return;
        setList(data || []);
        setError(e?.message || "");
      })
      .catch(() => {
        if (!active) return;
        setList([]);
        setError("Unable to load campaigns. Please retry later.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main>
      <h1>Discover campaigns</h1>
      <Message error>{error}</Message>
      <div className="cards">
        {list?.map((c) => <CampaignCard c={c} key={c.id} />) || <Loading />}
      </div>
      {list?.length === 0 && !error && <p>No active campaigns yet.</p>}
    </main>
  );
}
export default Discover;
