import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { listActiveCampaigns } from "@/api/publicData";
import { listMyCampaigns } from "@/api/ownerCampaigns";
import CampaignCard from "@/components/campaigns/CampaignCard";

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
        if (error || !data?.user) { navigate("/login", { replace: true }); return; }
        setUser(data.user); setState("ready");
        // Owner rows go through the same verified transport as every other
        // owner read: confirmed email, verified account lifecycle and
        // owner-scoped, validated rows. No ad-hoc inline query.
        listMyCampaigns(client)
          .then((owned) => { if (alive) setMyCampaigns(owned); })
          .catch((cause) => { if (alive) setMyCampaignError(cause?.message || "Your campaigns could not be loaded."); });
      }).catch(() => { if (alive) setState("error"); });
      const { data } = client.auth.onAuthStateChange((event) => {
        if (alive && event === "SIGNED_OUT") navigate("/login", { replace: true });
      });
      subscription = data.subscription;
      listActiveCampaigns({ limit: 12 }).then(items => {
        if (alive) setCampaigns(items);
      }).catch(() => { if (alive) setCampaignError("Public campaigns could not be loaded."); });
    } catch { setState("error"); }
    return () => { alive = false; subscription?.unsubscribe(); };
  }, [navigate]);
  async function signOut() {
    try { const { error } = await authClient().auth.signOut(); if (error) throw error; navigate("/login", { replace: true }); }
    catch { setState("error"); }
  }
  if (state === "loading") return <main role="status" className="mx-auto max-w-5xl p-8">Verifying your session…</main>;
  if (state === "error") return <main role="alert" className="mx-auto max-w-5xl p-8">Account services are unavailable. <Link className="underline" to="/login">Return to sign in</Link>.</main>;
  return <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="font-display text-3xl font-bold">Your dashboard</h1><p className="mt-2 text-muted-foreground">Signed in as {user?.email}</p></div>
      <button onClick={signOut} className="min-h-11 rounded-xl border border-border px-5 py-2">Sign out</button>
    </header>
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Your campaigns</h2>
      <p className="mt-2 text-sm text-muted-foreground">Continue a saved draft or explore active campaigns. Your verified donations and campaign receipts are available in Finance. New campaign checkout and withdrawals remain disabled until payment verification is complete.</p>
      <Link to="/create" className="mt-4 mr-5 inline-block text-primary underline">Create a campaign</Link>
      <Link to="/campaigns" className="mt-4 mr-5 inline-block text-primary underline">Manage your campaigns</Link>
      <Link to="/discover" className="mt-4 mr-5 inline-block text-primary underline">Explore campaigns</Link>
      <Link to="/ledger" className="mt-4 inline-block text-primary underline">View your finances</Link>
    </section>
    {myCampaignError && <p role="alert">{myCampaignError}</p>}
    {myCampaigns.length > 0 && <section aria-label="Your saved campaigns"><h2 className="mb-4 text-xl font-semibold">Your saved campaigns</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{myCampaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}</div></section>}
    {campaignError && <p role="alert">{campaignError}</p>}
    {campaigns.length > 0 && <section><h2 className="mb-4 text-xl font-semibold">Discover active campaigns</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}</div></section>}
  </main>;
}
