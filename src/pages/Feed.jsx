import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Rocket, Compass } from "lucide-react";
import { db } from "../lib/supabase";
import { SLOGAN, TAGLINE } from "../lib/brand";
import { Loading, Message, CampaignCard } from "../components/UI";

const PUBLIC_CAMPAIGN_COLUMNS =
  "id,title,summary,story,category,goal_amount,cover_image_url,status,created_at";
const PUBLIC_POST_COLUMNS = "id,body,created_at";

function Feed() {
  const [campaigns, setCampaigns] = useState(null);
  const [posts, setPosts] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!db) {
      setCampaigns([]);
      setPosts([]);
      setMessage("Live community updates are not connected yet.");
      return;
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
    ]).then(([a, b]) => {
      setCampaigns(a.data || []);
      setPosts(b.data || []);
      setMessage(a.error?.message || b.error?.message || "");
    }).catch(() => {
      setCampaigns([]);
      setPosts([]);
      setMessage("Community updates could not be loaded. Please try again later.");
    });
  }, []);
  return (
    <div className="stack">
      <section className="hero">
        <p className="eyebrow">ONE UNIVERSE OF FUNDING</p>
        <h1>Launchpad</h1>
        <p className="ifund-launchpad-slogan">{SLOGAN}</p>
        <p>{TAGLINE}</p>
        <div className="actions">
          <Link className="primary" to="/create">
            <Rocket size={20} aria-hidden="true" /> Launch a Mission
          </Link>
          <Link className="secondary" to="/discover">
            <Compass size={20} aria-hidden="true" /> Explore Universe
          </Link>
        </div>
      </section>
      <div className="split">
        <section>
          <h2>Community Signals</h2>
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
          ) : (
            <p>No posts yet. Community updates will appear here.</p>
          )}
        </section>
        <section>
          <h2>Fundraising Missions</h2>
          {!campaigns ? (
            <Loading />
          ) : campaigns.length ? (
            campaigns.slice(0, 8).map((c) => <CampaignCard key={c.id} c={c} />)
          ) : (
            <p>There are no published campaigns yet.</p>
          )}
        </section>
      </div>
      <Message error>{message}</Message>
    </div>
  );
}
export default Feed;
