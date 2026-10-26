import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../lib/supabase";
import FoundingMembers from "./FoundingMembers";
import DownloadApp from "./DownloadApp";

const helpTopics = [
  {
    slug: "campaigns",
    title: "Creating a campaign",
    body: "Sign in, open New Campaign, add a title and story, then save a draft. Publishing requires a verified independent account and working campaign API.",
  },
  {
    slug: "donations",
    title: "Donations and receipts",
    body: "Only provider-verified gifts belong in totals and donor records. IFund never treats a copied payment confirmation or a pending transaction as settled funds.",
  },
  {
    slug: "withdrawals",
    title: "Withdrawals",
    body: "Withdrawals require an eligible account, reconciled funds, and a provider-approved payout integration. Do not send money or account credentials through chat or an unverified form.",
  },
  {
    slug: "connections",
    title: "Connected platforms",
    body: "A connected badge requires a completed provider authorization and a verified sync. An available connect button alone is not proof that posting or transfers work.",
  },
  {
    slug: "accounts",
    title: "Account access",
    body: "Use the independent Sign in page. Existing Base44 accounts cannot be assumed migrated until their identities and permissions have been reconciled.",
  },
  {
    slug: "community",
    title: "Community activity",
    body: "Use Community to see public posts. Personal notifications, direct messages, and story publication require independent data and authorization before activation.",
  },
];
function Notice({ children }) {
  return (
    <p className="ifund-route-notice" role="status">
      {children}
    </p>
  );
}
function Section({ title, children }) {
  return (
    <section className="card ifund-restored-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Record({ table, field = "id", id, columns, render }) {
  const [state, setState] = useState({
    loading: true,
    record: null,
    error: "",
  });
  useEffect(() => {
    let active = true;
    if (!db || !id || (field === "id" && !/^[a-f\d-]{36}$/i.test(id))) {
      setState({
        loading: false,
        error: "An independently verified record is not available.",
        record: null,
      });
      return;
    }
    setState({ loading: true, record: null, error: "" });
    db.from(table)
      .select(columns)
      .eq(field, id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active)
          setState({
            loading: false,
            record: data || null,
            error: error ? "Unable to verify this record." : "",
          });
      })
      .catch(() => {
        if (active)
          setState({
            loading: false,
            record: null,
            error: "Unable to reach the independent data service.",
          });
      });
    return () => {
      active = false;
    };
  }, [table, field, id, columns]);
  if (state.loading) return <Notice>Checking independent records…</Notice>;
  if (state.error) return <Notice>{state.error}</Notice>;
  if (!state.record)
    return <Notice>No published record is available at this address.</Notice>;
  return render(state.record);
}
function HelpIndex({ slug }) {
  const [search, setSearch] = useState("");
  const filtered = helpTopics.filter((item) =>
    (item.title + item.body).toLowerCase().includes(search.toLowerCase()),
  );
  if (slug) {
    const topic = helpTopics.find((item) => item.slug === slug);
    return topic ? (
      <main className="stack">
        <h1>{topic.title}</h1>
        <Section title="Guidance">
          <p>{topic.body}</p>
        </Section>
        <Link to="/help">All help topics</Link>
      </main>
    ) : (
      <main>
        <h1>Help article unavailable</h1>
        <Notice>
          No verified independent help article exists for this link.
        </Notice>
        <Link to="/help">Help Center</Link>
      </main>
    );
  }
  return (
    <main className="stack">
      <h1>Help Center</h1>
      <label>
        Search guidance{" "}
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search help topics"
        />
      </label>
      <div className="cards">
        {filtered.map((item) => (
          <Section key={item.slug} title={item.title}>
            <p>{item.body}</p>
            <Link to={`/help/${item.slug}`}>Read topic</Link>
          </Section>
        ))}
      </div>
      {!filtered.length && <Notice>No matching topics.</Notice>}
    </main>
  );
}
function AccountAction({ kind }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const registration = kind === "registration";
  const reset = kind === "reset";
  const allowed =
    Boolean(db) &&
    (registration
      ? import.meta.env.VITE_IFUND_ENABLE_NEW_SIGNUPS === "true"
      : import.meta.env.VITE_IFUND_ENABLE_PASSWORD_RECOVERY === "true");
  async function submit(event) {
    event.preventDefault();
    if (!allowed || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const action = registration
        ? db.auth.signUp({ email: email.trim(), password })
        : reset
          ? db.auth.updateUser({ password })
          : db.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: window.location.origin + "/reset-password",
            });
      const { error } = await action;
      if (error) throw error;
      setStatus(
        registration
          ? "Check your email for any required verification."
          : reset
            ? "Password updated."
            : "If that account is eligible, recovery instructions will be emailed.",
      );
    } catch {
      setStatus(
        "This action could not be completed. Check your account settings or contact support.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="stack">
      <h1>
        {registration
          ? "Create your account"
          : reset
            ? "Set a new password"
            : "Recover your account"}
      </h1>
      {!allowed ? (
        <Notice>
          Independent account enrollment and recovery remain disabled until
          existing accounts, email templates and authorization policies are
          verified. No registration or reset request was sent.
        </Notice>
      ) : (
        <form className="form" onSubmit={submit}>
          {!reset && (
            <label>
              Email address{" "}
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {(registration || reset) && (
            <label>
              Password{" "}
              <input
                required
                minLength={10}
                type="password"
                autoComplete={registration ? "new-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          <button type="submit" disabled={busy}>
            {busy
              ? "Checking…"
              : registration
                ? "Register"
                : reset
                  ? "Save password"
                  : "Email recovery link"}
          </button>
          {status && <Notice>{status}</Notice>}
        </form>
      )}
      <Link to="/login">Return to sign in</Link>
    </main>
  );
}
export default function RestoredPublic({ page, user }) {
  const { id, slug } = useParams();
  switch (page.kind) {
    case "registration":
    case "recovery":
    case "reset":
      return <AccountAction kind={page.kind} />;
    case "help":
      return <HelpIndex />;
    case "help-article":
      return <HelpIndex slug={slug} />;
    case "post":
      return (
        <main className="stack">
          <h1>Community discussion</h1>
          <Record
            table="ifund_posts"
            columns="id,body,created_at"
            id={id}
            render={(post) => (
              <Section title="Community post">
                <p>{post.body}</p>
                <small>{new Date(post.created_at).toLocaleDateString()}</small>
              </Section>
            )}
          />
          <Link to="/community">Community</Link>
          <Notice>
            Replies and private discussions are disabled until moderation and
            ownership APIs are verified.
          </Notice>
        </main>
      );
    case "public-profile":
      return (
        <main className="stack">
          <h1>Member profile</h1>
          <Record
            table="ifund_profiles"
            columns="id,handle,display_name"
            id={id}
            render={(profile) => (
              <Section
                title={profile.display_name || profile.handle || "Member"}
              >
                <p>
                  {profile.handle ? "@" + profile.handle : "Public profile"}
                </p>
              </Section>
            )}
          />
          <Link to="/discover">Discover</Link>
        </main>
      );
    case "embed":
      return (
        <main className="stack">
          <Record
            table="ifund_campaigns"
            columns="id,title,summary,status,goal_amount"
            id={id}
            render={(campaign) =>
              campaign.status === "active" ? (
                <Section title={campaign.title}>
                  <p>{campaign.summary}</p>
                  <p>
                    Goal:{" "}
                    {Number(campaign.goal_amount).toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}
                  </p>
                  <Link to={`/campaign/${campaign.id}`}>See campaign</Link>
                </Section>
              ) : (
                <Notice>This campaign is not public.</Notice>
              )
            }
          />
        </main>
      );
    case "social":
      return (
        <main className="stack">
          <h1>IFund Social</h1>
          <p>
            Community posts are available independently; cross-platform
            publishing and private interactions require verified provider
            connections.
          </p>
          <Link className="primary" to="/community">
            Open community feed
          </Link>
          {user && <Link to="/connections">Review platform connections</Link>}
        </main>
      );
    case "globe":
      return (
        <main className="stack">
          <h1>Global Globe</h1>
          <Notice>
            Global map pins cannot be reconstructed until campaign locations and
            consent are migrated. No locations have been invented.
          </Notice>
          <Link to="/discover">Explore published campaigns</Link>
        </main>
      );
    case "contact":
      return (
        <main className="stack">
          <h1>Contact IFund</h1>
          <Notice>
            Support submissions are not enabled until the independent inbox and
            delivery workflow are verified. Do not send sensitive account or
            payment information through an unverified form.
          </Notice>
          <Link to="/help">Help Center</Link>
        </main>
      );
    case "founding":
      return <FoundingMembers />;
    case "download":
      return <DownloadApp />;
    case "restricted":
      return (
        <main className="stack">
          <h1>{page.title}</h1>
          <Notice>
            No authorization or activation has occurred. This endpoint will be
            enabled only with signed, time-limited state and an independently
            verified callback.
          </Notice>
          <Link to="/login">Account</Link>
        </main>
      );
    default:
      return (
        <main className="stack">
          <h1>{page.title}</h1>
          <Notice>
            Content from the original service has not been independently
            published. The route is available, but no legacy content or
            capability is being represented as migrated.
          </Notice>
          <Link to="/community">Community</Link>
        </main>
      );
  }
}
