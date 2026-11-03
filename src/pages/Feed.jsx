import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { SLOGAN, TAGLINE } from "../lib/brand";
import { Loading, Message, CampaignCard } from "../components/UI";
import { publicFeedFailure, publicFeedState } from "../lib/publicFeedState";

const PUBLIC_CAMPAIGN_COLUMNS =
  "id,title,summary,story,category,goal_amount,cover_image_url,status,created_at";
const PUBLIC_POST_COLUMNS = "id,body,created_at";

function Feed() {
  const [campaigns, setCampaigns] = useState(null);
  const [posts, setPosts] = useState(null);
  const [message, setMessage] = useState("");
  const [campaignError, setCampaignError] = useState(false);
  const [postError, setPostError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setCampaigns(null);
    setPosts(null);
    setMessage("");
    setCampaignError(false);
    setPostError(false);

    if (!db) {
      const state = publicFeedFailure();
      setCampaigns(state.campaigns);
      setPosts(state.posts);
      setCampaignError(state.campaignError);
      setPostError(state.postError);
      setMessage(state.message);
      return () => {
        active = false;
      };
    }

    Promise.all([
      db
        .from("ifund_campaigns")
        .select(PUBLIC_CAMPAIGN_COLUMNS)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("ifund_posts")
        .select(PUBLIC_POST_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(20),
    ])
      .then(([a, b]) => {
        if (!active) return;
        const state = publicFeedState(a, b);
        setCampaigns(state.campaigns);
        setPosts(state.posts);
        setCampaignError(state.campaignError);
        setPostError(state.postError);
        setMessage(state.message);
      })
      .catch(() => {
        if (!active) return;
        const state = publicFeedFailure();
        setCampaigns(state.campaigns);
        setPosts(state.posts);
        setCampaignError(state.campaignError);
        setPostError(state.postError);
        setMessage(state.message);
      });

    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <div className="stack">
      <section className="hero">
        <p className="eyebrow">ONE UNIVERSE OF FUNDING</p>
        <h1>{SLOGAN}</h1>
        <p>{TAGLINE}</p>
        <div className="actions">
          <Link className="primary" to="/create">
            Start a campaign
          </Link>
          <Link className="secondary" to="/discover">
            Explore campaigns
          </Link>
        </div>
      </section>
      <div className="split">
        <section>
          <h2>Community live feed</h2>
          {!posts ? (
            <Loading />
          ) : posts.length ? (
            posts.map((p) => (
              <article className="card" key={p.id}>
                <small>
                  Community · {new Date(p.created_at).toLocaleDateString()}
                </small>
                <p>{p.body}</p>
              </article>
            ))
          ) : postError ? (
            <p>Community updates are temporarily unavailable.</p>
          ) : (
            <p>No posts yet. Community updates will appear here.</p>
          )}
        </section>
        <section>
          <h2>Campaigns</h2>
          {!campaigns ? (
            <Loading />
          ) : campaigns.length ? (
            campaigns.slice(0, 8).map((c) => <CampaignCard key={c.id} c={c} />)
          ) : campaignError ? (
            <p>Campaigns are temporarily unavailable.</p>
          ) : (
            <p>There are no published campaigns yet.</p>
          )}
        </section>
      </div>
      {message && (
        <div className="actions">
          <Message error>{message}</Message>
          {db && (
            <button
              className="secondary"
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export default Feed;
