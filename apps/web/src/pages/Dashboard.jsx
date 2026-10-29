import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { listActiveCampaigns } from "@/api/publicData";
import CampaignCard from "@/components/campaigns/CampaignCard";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [state, setState] = useState("loading");
  const [campaigns, setCampaigns] = useState([]);
  const [campaignError, setCampaignError] = useState("");
  useEffect(() => {
    let alive = true;
    let subscription;
    try {
      const client = authClient();
      client.auth.getUser().then(({ data, error }) => {
        if (!alive) return;
        if (error || !data.user) { navigate("/login", { replace: true }); return; }
        setUser(data.user); setState("ready");
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
    try { await authClient().auth.signOut(); navigate("/login", { replace: true }); }
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
      <h2 className="text-xl font-semibold">Campaigns</h2>
      <p className="mt-2 text-sm text-muted-foreground">Browse active public campaigns. Private campaign management, donations, and withdrawals remain unavailable until their independent services are verified.</p>
      <Link to="/discover" className="mt-4 inline-block text-primary underline">Explore campaigns</Link>
    </section>
    {campaignError && <p role="alert">{campaignError}</p>}
    {campaigns.length > 0 && <section><h2 className="mb-4 text-xl font-semibold">Discover active campaigns</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}</div></section>}
  </main>;
}
