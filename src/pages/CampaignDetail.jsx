import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message } from "../components/UI";
import { campaignDetailOutcome } from "../lib/campaignDetailState";

const PUBLIC_CAMPAIGN_COLUMNS =
  "id,title,summary,story,category,goal_amount,cover_image_url,status,created_at";

function Detail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;
    setC(null);
    setError("");
    setNotFound(false);
    setLoading(true);

    if (!db) {
      setError("Campaign data is not configured. Campaign details are unavailable.");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    db.from("ifund_campaigns")
      .select(PUBLIC_CAMPAIGN_COLUMNS)
      .eq("id", id)
      .single()
      .then((result) => {
        if (!active) return;
        const outcome = campaignDetailOutcome(result);
        if (outcome.status === "ready") setC(outcome.campaign);
        else if (outcome.status === "not_found") setNotFound(true);
        else setError(outcome.message);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("We couldn't load this campaign. Please try again.");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  return (
    <main>
      {loading ? (
        <Loading />
      ) : error ? (
        <Message error>{error}</Message>
      ) : notFound ? (
        <p role="status">Campaign not found.</p>
      ) : c ? (
        <article className="detail">
          <small>
            {c.category} · {c.status}
          </small>
          <h1>{c.title}</h1>
          {c.cover_image_url && (
            <img
              className="cover"
              src={c.cover_image_url}
              alt="Campaign cover"
            />
          )}
          <p className="lede">{c.summary}</p>
          <div className="card">
            <h3>Funding goal</h3>
            <strong>${Number(c.goal_amount || 0).toLocaleString()}</strong>
            <p>
              This preview does not accept campaign donations. No payment can
              be made from this page.
            </p>
          </div>
          <p className="story">{c.story}</p>
        </article>
      ) : (
        <Message error>Campaign details are unavailable.</Message>
      )}
    </main>
  );
}
export default Detail;
