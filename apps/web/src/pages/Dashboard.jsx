import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { listActiveCampaigns } from "@/api/publicData";
import { listMyCampaigns } from "@/api/ownerCampaigns";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { memberIdentity } from "@/lib/guestAccess";
import { TERMS_VERSION } from "@/lib/legalPolicy";
import { hasGuestNotice } from "@/lib/guestAccess";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [state, setState] = useState("loading");
  const [campaigns, setCampaigns] = useState([]);
  const [myCampaigns, setMyCampaigns] = useState([]);
  const [myCampaignError, setMyCampaignError] = useState("");
  const [campaignError, setCampaignError] = useState("");
  useEffect(() => {
    let alive = true;
    let subscription;
    try {
      const client = authClient();
      client.auth.getUser().then(({ data, error }) => {
        if (!alive) return;
        if (error || !memberIdentity(data?.user)) { setUser(null); setState("guest"); return; }
        setUser(data.user); setState("ready");
        // Owner rows go through the same verified transport as every other
        // owner read: confirmed email, verified account lifecycle and
        // owner-scoped, validated rows. No ad-hoc inline query.
        listMyCampaigns(client)
          .then((owned) => { if (alive) setMyCampaigns(owned); })
          .catch((cause) => { if (alive) setMyCampaignError(cause?.message || "Your campaigns could not be loaded."); });
      }).catch(() => { if (alive) setState("error"); });
      const { data } = client.auth.onAuthStateChange((event) => {
        if (alive && event === "SIGNED_OUT") { setUser(null); setState("guest"); }
      });
      subscription = data.subscription;
      listActiveCampaigns({ limit: 12 }).then(items => {
        if (alive) setCampaigns(items);
      }).catch(() => { if (alive) setCampaignError("Public campaigns could not be loaded."); });
    } catch { setState("error"); }
    return () => { alive = false; subscription?.unsubscribe(); };
  }, [navigate]);
  async function signOut() {
    try { const { error } = await authClient().auth.signOut(); if (error) throw error; navigate("/dashboard", { replace: true }); }
    catch { setState("error"); }
  }
  if (state === "loading") return <main role="status" className="mx-auto max-w-5xl p-8">Verifying your session…</main>;
  if (state === "guest") return <main className="mx-auto max-w-5xl space-y-6 px-5 py-10 sm:px-8">
    <h1 className="font-display text-3xl font-bold">Welcome to your iFund workspace</h1>
    <p className="max-w-2xl text-muted-foreground">No identity verification is needed to explore or prepare a campaign. Your draft can stay in this browser until you choose a recoverable account. Cloud saving and publication require a secure, owner-bound account session.</p>
    {typeof sessionStorage !== "undefined" && hasGuestNotice(sessionStorage, TERMS_VERSION) && <p className="rounded-xl border border-cyan-500/30 p-4 text-sm">Guest mode is active on this device. Keep this browser open for your draft or link a recoverable account to protect your work across devices.</p>}
    <div className="flex flex-wrap gap-4"><Link className="min-h-12 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white" to="/create">Start or resume a campaign draft</Link><Link to="/discover" className="min-h-12 rounded-xl border px-5 py-3 font-semibold">Explore campaigns</Link><Link to="/register" className="min-h-12 rounded-xl border px-5 py-3 font-semibold">Make an account recoverable</Link></div>
    <p className="text-sm"><Link to="/withdrawals" className="underline">Withdrawal identity verification</Link> is only needed before a payout can be requested.</p>
  </main>;
  if (state === "error") return <main role="alert" className="mx-auto max-w-5xl p-8">Account services are unavailable. <Link className="underline" to="/login">Return to sign in</Link>.</main>;
  return <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="font-display text-3xl font-bold">Your dashboard</h1><p className="mt-2 text-muted-foreground">{user?.is_anonymous ? "Private guest account on this device" : "Signed in as " + user?.email}</p></div>
      <button onClick={signOut} className="min-h-11 rounded-xl border border-border px-5 py-2">Sign out</button>
    </header>
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Your campaigns</h2>
      <p className="mt-2 text-sm text-muted-foreground">Continue a saved draft or explore active campaigns. Donations and withdrawals remain unavailable until independently verified.</p>
      <Link to="/create" className="mt-4 mr-5 inline-block text-primary underline">Create a campaign</Link>
      <Link to="/campaigns" className="mt-4 mr-5 inline-block text-primary underline">Manage your campaigns</Link>
      <Link to="/ledger" className="mt-4 mr-5 inline-block text-primary underline">Verified finances</Link>
      <Link to="/giving" className="mt-4 mr-5 inline-block text-primary underline">My Giving</Link>
      <Link to="/discover" className="mt-4 inline-block text-primary underline">Explore campaigns</Link>
    </section>
    {myCampaignError && <p role="alert">{myCampaignError}</p>}
    {myCampaigns.length > 0 && <section aria-label="Your saved campaigns"><h2 className="mb-4 text-xl font-semibold">Your saved campaigns</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{myCampaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}</div></section>}
    {campaignError && <p role="alert">{campaignError}</p>}
    {campaigns.length > 0 && <section><h2 className="mb-4 text-xl font-semibold">Discover active campaigns</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}</div></section>}
  </main>;
}
