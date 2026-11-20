import { useEffect, useState } from "react";
import { Bot, Compass, PlusCircle, FolderKanban, ArrowUpRight, Sparkles } from "lucide-react";
import FollowFeed from "@/components/dashboard/FollowFeed";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { listActiveCampaigns } from "@/api/publicData";
import { listMyCampaigns } from "@/api/ownerCampaigns";
import CampaignCard from "@/components/campaigns/CampaignCard";
import EventsDashboardSection from "@/components/dashboard/EventsDashboardSection";
import { observeDashboardSession } from "@/lib/dashboardSession";
import { TERMS_VERSION } from "@/lib/legalPolicy";
import { hasGuestNotice } from "@/lib/guestAccess";

export default function Dashboard() {
  const navigate = useNavigate();
  const whatIfEnabled = import.meta.env.VITE_IFUND_WHAT_IF_ENABLED === "enabled";
  const [account, setAccount] = useState({ phase: "loading", user: null, campaigns: [], error: "" });
  const { user, phase: state, campaigns: myCampaigns, error: myCampaignError } = account;
  const [campaigns, setCampaigns] = useState([]);
  const [campaignError, setCampaignError] = useState("");
  useEffect(() => {
    let alive = true;
    let stopAccount;
    try {
      const client = authClient();
      stopAccount = observeDashboardSession(client, {
        // Preserve the verified owner transport and its lifecycle/RLS checks.
        loadCampaigns: () => listMyCampaigns(client),
        onChange: next => { if (alive) setAccount(next); },
      });
      listActiveCampaigns({ limit: 12 }).then(items => {
        if (alive) setCampaigns(items);
      }).catch(() => { if (alive) setCampaignError("Public campaigns could not be loaded."); });
    } catch { setAccount({ phase: "error", user: null, campaigns: [], error: "" }); }
    return () => { alive = false; stopAccount?.(); };
  }, [navigate]);
  async function signOut() {
    try { const { error } = await authClient().auth.signOut(); if (error) throw error; navigate("/dashboard", { replace: true }); }
    catch { setAccount({ phase: "error", user: null, campaigns: [], error: "" }); }
  }
  if (state === "loading") return <main role="status" className="mx-auto max-w-5xl p-8">Verifying your session…</main>;
  if (state === "guest") return <main className="mx-auto max-w-5xl space-y-6 px-5 py-10 sm:px-8">
    <h1 className="font-display text-3xl font-bold">Welcome to your iFund workspace</h1>
    <p className="max-w-2xl text-muted-foreground">Explore campaigns as a visitor. To create, save, or publish your own content, sign up with an email address. Two-factor authentication is only required when you request your first withdrawal.</p>
    {typeof sessionStorage !== "undefined" && hasGuestNotice(sessionStorage, TERMS_VERSION) && <p className="rounded-xl border border-cyan-500/30 p-4 text-sm">Guest browsing is active on this device. Create a verified email account before writing or publishing campaign content.</p>}
    <div className="flex flex-wrap gap-4"><Link className="min-h-12 rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white" to={whatIfEnabled ? "/register?returnTo=%2Fwhat-if" : "/register?returnTo=%2Fcreate"}>{whatIfEnabled ? "Start a Mission with email" : "Create a campaign with email"}</Link><Link to="/discover" className="min-h-12 rounded-xl border px-5 py-3 font-semibold">Explore campaigns</Link><Link to="/register" className="min-h-12 rounded-xl border px-5 py-3 font-semibold">Sign up with email</Link></div>
    <p className="text-sm"><Link to="/withdrawals" className="underline">Withdrawal identity verification</Link> is only needed before a payout can be requested.</p>
  </main>;
  if (state === "error") return <main role="alert" className="mx-auto max-w-5xl p-8">Account services are unavailable. <Link className="underline" to="/login">Return to sign in</Link>.</main>;
  return <main className="ifund-dashboard mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-8 sm:py-9">
    <header className="ifund-dashboard-hero">
      <div className="relative z-10 max-w-2xl">
        <p className="ifund-dashboard-eyebrow !text-cyan-200">Your IFund workspace</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Make your what if happen.</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-200">Your campaigns, people you follow, and AI specialists in one place. Pick up wherever you left off.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to={whatIfEnabled ? "/what-if" : "/create"} className="ifund-dashboard-primary"><PlusCircle size={18}/> {whatIfEnabled ? "Start a Mission" : "Start a campaign"}</Link>
          <button type="button" className="ifund-dashboard-secondary" onClick={() => window.dispatchEvent(new CustomEvent("ifund-open-agent", { detail: { agent: "nexus" } }))}><Bot size={18}/> Ask your AI Team</button>
        </div>
      </div>
      <Sparkles size={170} strokeWidth={0.65} className="pointer-events-none absolute -right-4 -top-12 text-cyan-300/20 sm:right-10" aria-hidden="true"/>
    </header>
    {whatIfEnabled && <section className="ifund-dashboard-card space-y-3" aria-label="What If private Missions">
      <h2 className="text-xl font-semibold">Your next possibility starts here</h2>
      <p className="text-sm text-muted-foreground">Build a private Mission from an idea or need. A fundraiser is optional, and nothing is published without your review.</p>
      <div className="flex flex-wrap gap-3">
        <Link to="/what-if" className="ifund-dashboard-primary">Explore What If?</Link>
        <Link to="/missions" className="ifund-dashboard-secondary">My Missions</Link>
      </div>
    </section>}
    <div className="ifund-dashboard-shortcuts">
      <Link to={whatIfEnabled?"/missions":"/campaigns"} className="ifund-dashboard-shortcut"><FolderKanban size={21}/><span>{whatIfEnabled?"My Missions":"My campaigns"}</span><ArrowUpRight size={15} className="ml-auto"/></Link>
      <Link to="/discover" className="ifund-dashboard-shortcut"><Compass size={21}/><span>Discover</span><ArrowUpRight size={15} className="ml-auto"/></Link>
      <Link to="/messaging" className="ifund-dashboard-shortcut"><Bot size={21}/><span>Messaging</span><ArrowUpRight size={15} className="ml-auto"/></Link>
      <Link to="/analytics" className="ifund-dashboard-shortcut"><Sparkles size={21}/><span>Command Center</span><ArrowUpRight size={15} className="ml-auto"/></Link>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
      <section className="ifund-dashboard-card space-y-4">
        <div><p className="ifund-dashboard-eyebrow">Build and manage</p><h2 className="text-xl font-bold">Your fundraising hub</h2>
          <p className="mt-2 text-sm text-muted-foreground">Keep campaigns, external fundraisers and verified finances organized. No estimated donation totals.</p></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Link to="/campaigns" className="ifund-dashboard-mini-link">Manage campaigns <ArrowUpRight size={15}/></Link>
          <Link to="/fundraising-hub" className="ifund-dashboard-mini-link">Connected fundraisers <ArrowUpRight size={15}/></Link>
          <Link to="/ledger" className="ifund-dashboard-mini-link">Verified finances <ArrowUpRight size={15}/></Link>
          <Link to="/giving" className="ifund-dashboard-mini-link">My giving <ArrowUpRight size={15}/></Link>
        </div>
      </section>
      <FollowFeed ownerId={user?.id}/>
    </div>
    <EventsDashboardSection />
    {myCampaignError && <p role="alert">{myCampaignError}</p>}
    {myCampaigns.length > 0 && <section aria-label="Your saved campaigns"><h2 className="mb-4 text-xl font-semibold">Your saved campaigns</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{myCampaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}</div></section>}
    {campaignError && <p role="alert">{campaignError}</p>}
    {campaigns.length > 0 && <section><h2 className="mb-4 text-xl font-semibold">Discover active campaigns</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{campaigns.map(c => <CampaignCard key={c.id} campaign={c} />)}</div></section>}
    <div className="flex justify-end"><button onClick={signOut} className="min-h-11 rounded-xl border border-border px-5 py-2 text-sm">Sign out</button></div>
  </main>;
}
