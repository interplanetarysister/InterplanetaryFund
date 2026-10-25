import { useEffect, useState } from "react";
import { db } from "../lib/supabase";
import { Loading, Message, CampaignCard } from "../components/UI";
function Discover() {
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!db) return;
    db.from("ifund_campaigns")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .then(({ data, error: e }) => {
        setList(data || []);
        setError(e?.message || "");
      });
  }, []);
  return (
    <main>
      <h1>Discover campaigns</h1>
      <Message error>{error}</Message>
      <div className="cards">
        {list?.map((c) => <CampaignCard c={c} key={c.id} />) || <Loading />}
      </div>
      {list?.length === 0 && <p>No active campaigns yet.</p>}
    </main>
  );
}
export default Discover;
