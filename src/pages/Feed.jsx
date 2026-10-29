import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { CampaignCard, Loading, Message, Planet } from "../components/UI";

const opening = [
  "Thank you for giving me the opportunity to introduce you to Interplanetary Fund.",
  "I want to start with a simple question: What if raising money for a cause, a business idea, a personal need, or a dream didn't require people to navigate a dozen different platforms?",
  "What if the technology could bring the fundraising ecosystem together?",
  "That is the idea behind Interplanetary Fund.",
];

export default function Feed({ user }) {
  const [campaigns, setCampaigns] = useState(null);
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setCampaigns(null); setPosts(null); setError("");
    if (!db) {
      setCampaigns([]); setPosts([]);
      setError("The independent campaign database is not configured.");
      return;
    }
    Promise.all([
      db.from("ifund_campaigns").select("*").eq("status", "active")
        .order("created_at", { ascending: false }).limit(20),
      db.from("ifund_posts").select("id,body,created_at")
        .order("created_at", { ascending: false }).limit(10),
    ]).then(([campaignResult, postResult]) => {
      if (cancelled) return;
      setCampaigns(campaignResult.data || []);
      setPosts(postResult.data || []);
      setError(campaignResult.error?.message || postResult.error?.message || "");
    }).catch((cause) => {
      if (cancelled) return;
      setCampaigns([]); setPosts([]);
      setError(cause?.message || "The home feed could not load.");
    });
    return () => { cancelled = true; };
  }, [revision]);

  return <div className="stack home-page">
    <section className="hero home-hero">
      <p className="eyebrow">A UNIVERSE OF POSSIBILITY</p>
      <div className="home-planet"><Planet /></div>
      <h1>Endless possibilities start with one question:
        <span>What if?</span>
      </h1>
      <p>One place to ask for help — or make something possible.</p>
      <div className="actions">
        <Link className="primary" to={user ? "/dashboard" : "/create"}>
          {user ? "Go to dashboard" : "Start a campaign"}
        </Link>
        <Link className="secondary" to="/discover">Explore causes</Link>
      </div>
    <div className="home-founding card">
        <h2>Be here from the beginning</h2>
        <p>Join the free IFund founding community and help shape what comes next.</p>
        <Link className="secondary" to="/founding-members">Join Founding Members</Link>
      </div>
    </section>

    <section className="home-story">
      <small className="eyebrow">WHO IS INTERPLANETARY FUND?</small>
      <h2>One universe of funding — for every person, every cause, every platform.</h2>
      {opening.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {expanded && <div>
        <h3>The problem we're solving</h3>
        <p>People raising money often have to manage their campaigns, social networks, communication, and supporters across many separate services.</p>
        <h3>Fundraising, all in one place</h3>
        <p>Interplanetary Fund is designed to bring creation, sharing, communication, discovery, and campaign management together.</p>
        <h3>Help when you want it</h3>
        <p>Campaign assistance should be optional and under the creator's control. The aim is transparent, trustworthy fundraising.</p>
        <Link to="/about">Read the full platform overview</Link>
      </div>}
      <button type="button" className="secondary" aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}>
        {expanded ? "Show less" : "Read more · Our Story"}</button>
    </section>

    <Message error={Boolean(error)}>{error}</Message>
    <div className="split">
      <section>
        <div className="discover-heading"><h2>Community live feed</h2>
          <Link to="/social">Visit Social</Link></div>
        {posts === null ? <Loading /> : posts.length ? posts.map((post) =>
          <article className="card" key={post.id}>
            <small>{"Community · " + new Date(post.created_at).toLocaleDateString()}</small>
            <p className="story">{post.body}</p>
          </article>) : !error ? <p>No community posts yet.</p> : null}
      </section>
      <section>
        <div className="discover-heading"><h2>Latest campaigns</h2>
          <Link to="/discover">See all</Link></div>
        {campaigns === null ? <Loading /> : campaigns.length ?
          campaigns.slice(0, 8).map((campaign) => <CampaignCard key={campaign.id} c={campaign} />)
          : !error ? <p>There are no published campaigns yet.</p> : null}
      </section>
    </div>
    <div className="card home-support">
      <h2>Support Interplanetary Fund itself</h2>
      <p>Platform support is separate from donations to individual campaigns.</p>
      <p>PayPal donations will become available when independent checkout and reconciliation are verified.</p>
    </div>
  </div>;
}
