import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../lib/supabase";
import { Loading, Message, CampaignCard, Planet } from "../components/UI";
import { platforms } from "../lib/platforms";
const OPENING = [
  "Thank you for giving me the opportunity to introduce you to Interplanetary Fund.",
  "I want to start with a simple question: What if raising money for a cause, a business idea, a personal need, or a dream didn't require people to navigate a dozen different platforms?",
  "What if the technology could bring the fundraising ecosystem together?",
  "That is the idea behind Interplanetary Fund.",
];

const STORY = [
  {
    h: "The problem we're solving",
    p: "Today, people who need funding are often forced to piece together their fundraising strategy across crowdfunding platforms, social media, messaging, email, and other tools. They create a campaign in one place, promote it somewhere else, communicate with supporters somewhere else, analyze results somewhere else, and try to figure out what to do next on their own.",
  },
  {
    h: "Fundraising, all in one place",
    p: "Fundraising should not mean jumping between a pile of different tools. Interplanetary Fund brings the important parts together: create your fundraiser, share it, keep up with supporters, see how it is doing, and grow it from one place.",
  },
  {
    h: "Connect campaigns with what they need",
    p: "Our vision is to connect campaigns with the people, platforms, communication channels, and intelligence they need to succeed. Imagine creating one campaign and having the platform help you determine where that campaign should be promoted. Imagine connecting your social accounts and eventually being able to distribute approved campaign content across multiple networks instead of manually recreating the same post over and over. Imagine having one dashboard that shows campaign performance, communication, opportunities, and the next actions that could make the biggest difference.",
  },
  {
    h: "Help when you want it",
    p: "Your built-in helper can suggest what to do next, improve your message, find useful opportunities, and help with everyday campaign work. You decide what it may do. You can change those choices anytime.",
  },
  {
    h: "Because fundraising is about trust",
    p: "Because fundraising isn't just about technology. It's about trust. When someone contributes their money, they're putting trust in the person asking for help. That's why we're designing Interplanetary Fund around transparency, trust signals, campaign information, communication, and accountability.",
  },
  {
    h: "Beyond individual campaigns",
    p: "We're also thinking beyond individual campaigns. Our long-term vision is an ecosystem where individuals, organizations, communities, institutions, and eventually businesses can participate in a connected funding network. And the opportunity is much larger than simply collecting donations. The real opportunity is the infrastructure surrounding fundraising: Discovery. Communication. Distribution. Analytics. Automation. Donor relationships. Campaign intelligence. And eventually, a network connecting people who need funding with people looking for meaningful opportunities to contribute. That creates multiple potential paths for growth and monetization.",
  },
  {
    h: "Something people genuinely want to use",
    p: "But our first priority is not maximizing the number of revenue streams. It's building something people genuinely want to use. We want someone with a great idea and no marketing department to have access to capabilities that previously required a team. We want a nonprofit to be able to operate more efficiently. We want a family raising money for an important need to spend less time fighting technology and more time reaching people. And we want organizations to eventually have powerful fundraising tools without having to piece together lots of different products.",
  },
  {
    h: "Turning What if into What happens next",
    p: "That's the larger vision. Interplanetary Fund is not just about helping people raise money. It's about making the process of turning an idea into momentum easier. Because every successful campaign begins with a question: What if? What if this idea worked? What if this project became real? What if enough people believed in it? What if the right person discovered it at exactly the right moment? Interplanetary Fund exists to help create that possibility. We are building the infrastructure that can help turn \u201cWhat if?\u201d into \u201cWhat happens next?\u201d",
  },
  {
    h: "Our ambition is global",
    p: "And that's why we're here today. We're looking for partners who see the potential to build a much larger ecosystem around how people fund ideas, causes, projects, and possibilities. Our ambition is global. Our technology is being built with scalability in mind. And our long-term goal is simple: Create a world where great ideas have a better chance of finding the people, resources, and momentum they need to become reality.",
  },
];

function Feed({ user }) {
  const [expanded, setExpanded] = useState(false);
  const [campaigns, setCampaigns] = useState(null);
  const [posts, setPosts] = useState(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!db) {
      setCampaigns([]);
      setPosts([]);
      setMessage(
        "Campaigns and posts are unavailable until the independent data service is configured.",
      );
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
        setMessage(
          "The community feed is temporarily unavailable. Please retry later.",
        );
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <main className="ifund-home stack">
      <section className="ifund-public-hero" aria-labelledby="ifund-home-title">
        <div className="ifund-starfield" aria-hidden="true" />
        <div className="ifund-hero-content">
          <p className="ifund-editorial-eyebrow">A universe of possibility</p>
          <div className="ifund-hero-brand">
            <Planet />
            <strong>Interplanetary Fund</strong>
          </div>
          <h1 id="ifund-home-title">
            Endless possibilities start with one question: <span>What if?</span>
          </h1>
          <p className="ifund-home-subtitle">
            One place to ask for help — or make something possible.
          </p>
          <div className="ifund-home-ctas">
            {user ? (
              <Link className="primary" to="/dashboard">
                Go to dashboard
              </Link>
            ) : (
              <Link className="primary" to="/create">
                Start a campaign
              </Link>
            )}
            <Link className="secondary" to="/discover">
              Explore causes
            </Link>
          </div>
          <div className="ifund-founding-panel">
            <strong>Be here from the beginning.</strong>
            <p>
              Join the free InterplanetaryFund founding community and get
              early-access updates.
            </p>
            <Link className="primary" to="/founding-members">
              Join Founding Members
            </Link>
          </div>
          {!user && (
            <p className="ifund-auth-links">
              Already have an account? <Link to="/login">Log in</Link> ·{" "}
              <Link to="/register">Create one</Link>
            </p>
          )}
        </div>
      </section>
      <section
        className="ifund-story-surface"
        aria-labelledby="ifund-story-title"
      >
        <p className="ifund-editorial-eyebrow">Who is Interplanetary Fund?</p>
        <h2 id="ifund-story-title">
          One universe of funding — for every person, every cause, every
          platform.
        </h2>
        {OPENING.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {expanded && (
          <div className="ifund-story-expanded">
            {STORY.map((part) => (
              <section key={part.h}>
                <h3>{part.h}</h3>
                <p>{part.p}</p>
              </section>
            ))}
            <p>
              <strong>That's Interplanetary Fund.</strong> Endless possibilities
              start with one question: What if?
            </p>
          </div>
        )}
        <button
          type="button"
          className="ifund-story-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Read more · Our Story"}
        </button>
        <div className="ifund-home-ctas">
          <Link to="/discover" className="secondary">
            Explore causes
          </Link>
          <Link to="/create" className="primary">
            Start your own fund
          </Link>
        </div>
        <div className="ifund-platform-support">
          <strong>Support Interplanetary Fund itself</strong>
          <p>
            This donation would help operate the platform, not an individual
            campaign.
          </p>
          <p>
            PayPal support is unavailable until independent merchant and receipt
            verification is complete. No payment is taken here.
          </p>
          <small>Cryptocurrency donations — Coming soon</small>
        </div>
      </section>
      <section
        className="ifund-platform-links"
        aria-labelledby="ifund-platforms-title"
      >
        <h2 id="ifund-platforms-title">Connect your world</h2>
        <p>
          Explore the platforms IFund plans to connect. Select a platform to
          review its verified status.
        </p>
        <div className="ifund-platform-row">
          {platforms.map((platform) => (
            <Link
              key={platform.id}
              to={user ? "/connections" : "/login"}
              className="ifund-platform-tile"
              title={platform.name}
            >
              {platform.id === "paypal" ? (
                <span className="ifund-paypal-symbol">P</span>
              ) : (
                <img
                  src={`/platform-logos/${platform.id}.svg`}
                  alt=""
                  loading="lazy"
                />
              )}
              <small>{platform.name}</small>
            </Link>
          ))}
        </div>
      </section>
      <div className="ifund-community-grid">
        <section aria-labelledby="ifund-feed-title">
          <h2 id="ifund-feed-title">Community live feed</h2>
          {!posts ? (
            <Loading />
          ) : posts.length ? (
            posts.map((post) => (
              <article className="card" key={post.id}>
                <small>
                  Community · {new Date(post.created_at).toLocaleDateString()}
                </small>
                <p>{post.body}</p>
              </article>
            ))
          ) : !message ? (
            <p>No posts yet. Community updates will appear here.</p>
          ) : null}
          <Link to="/community">Explore community</Link>
        </section>
        <section aria-labelledby="ifund-campaigns-title">
          <h2 id="ifund-campaigns-title">Campaigns</h2>
          {!campaigns ? (
            <Loading />
          ) : campaigns.length ? (
            campaigns
              .slice(0, 8)
              .map((campaign) => (
                <CampaignCard key={campaign.id} c={campaign} />
              ))
          ) : !message ? (
            <p>There are no published campaigns yet.</p>
          ) : null}
          <Link to="/discover">Discover campaigns</Link>
        </section>
      </div>
      <Message error>{message}</Message>
    </main>
  );
}
export default Feed;
