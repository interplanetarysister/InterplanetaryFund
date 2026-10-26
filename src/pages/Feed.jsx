import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { SLOGAN, TAGLINE } from "../lib/brand";
import { Loading, Message, CampaignCard } from "../components/UI";
function Feed() {
  const [campaigns, setCampaigns] = useState(null);
  const [posts, setPosts] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!db) {
      setCampaigns([]);
      setPosts([]);
      setMessage("Campaigns and posts are unavailable until the independent data service is configured.");
      return;
    }
    let active = true;
    Promise.all([
      db
        .from("ifund_campaigns")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("ifund_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
    ])
      .then(([a, b]) => {
        if (!active) return;
        setCampaigns(a.data || []);
        setPosts(b.data || []);
        setMessage(a.error?.message || b.error?.message || "");
      })
      .catch(() => {
        if (!active) return;
        setCampaigns([]);
        setPosts([]);
        setMessage("The community feed is temporarily unavailable. Please retry later.");
      });
    return () => {
      active = false;
    };
  }, []);
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
          ) : !message ? (
            <p>No posts yet. Community updates will appear here.</p>
          ) : null}
        </section>
        <section>
          <h2>Campaigns</h2>
          {!campaigns ? (
            <Loading />
          ) : campaigns.length ? (
            campaigns.slice(0, 8).map((c) => <CampaignCard key={c.id} c={c} />)
          ) : !message ? (
            <p>There are no published campaigns yet.</p>
          ) : null}
        </section>
      </div>
      <Message error>{message}</Message>
    </div>
  );
}
export default Feed;
