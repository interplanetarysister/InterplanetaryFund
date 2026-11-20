import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { listActiveCampaigns } from "@/api/publicData";
import { listMyCampaigns } from "@/api/ownerCampaigns";
import CampaignCard from "@/components/campaigns/CampaignCard";
import EventsDashboardSection from "@/components/dashboard/EventsDashboardSection";
import { observeDashboardSession } from "@/lib/dashboardSession";
import { TERMS_VERSION } from "@/lib/legalPolicy";
import { hasGuestNotice } from "@/lib/guestAccess";
import { ArrowRight, BookOpen, Compass, HeartHandshake, Layers3, MessageSquareText, Orbit, Palette, ShoppingBag, Sparkles, TrendingUp } from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();
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
  if (state === "guest") return <main className="ifund-dashboard mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
    <section className="ifund-dashboard-hero space-y-4">
      <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-cyan-200"><Orbit className="h-5 w-5"/> A universe of possibilities</p>
      <h1 className="font-display text-4xl sm:text-5xl font-black">Your next possibility starts here.</h1>
      <p className="max-w-2xl text-slate-100">Explore a campaign, discover a Mission, or create a fundraiser with your own words and images. Your space grows with you.</p>
      <div className="flex flex-wrap gap-3">
        <Link to="/register?returnTo=%2Fcreate" className="ifund-action bg-gradient-to-r from-cyan-300 to-violet-300 text-slate-950"><Sparkles className="w-5 h-5"/> Start a campaign <ArrowRight className="w-4 h-4"/></Link>
        <Link to="/discover" className="ifund-action border border-white/30 bg-white/10 text-white"><Compass className="w-5 h-5"/> Explore campaigns</Link>
      </div>
    </section>
    {typeof sessionStorage !== "undefined" && hasGuestNotice(sessionStorage, TERMS_VERSION) && <p className="rounded-xl border border-cyan-500/30 p-4 text-sm">Guest browsing is active on this device. Create a verified email account before saving or publishing content.</p>}
    <p className="text-sm text-muted-foreground">Browsing is open to everyone. Email registration is required to save. First-withdrawal identity verification remains separate.</p>
    <Link className="text-sm underline" to="/login">Already have an account? Sign in.</Link>
  </main>;
  if (state === "error") return <main role="alert" className="mx-auto max-w-5xl p-8">Account services are unavailable. <Link className="underline" to="/login">Return to sign in</Link>.</main>;
  const activeCount = myCampaigns.filter(c => c.status === "active").length;
  const draftCount = myCampaigns.filter(c => c.status === "draft").length;
  const shortcuts = [
    { to: "/campaigns", title: "My campaigns", detail: "Manage drafts, updates and public pages", icon: Layers3 },
    { to: "/strategy#campaign-merch-studio", title: "Shop to Support", detail: "Create three personalized merchandise proofs", icon: ShoppingBag },
    { to: "/communications", title: "Communications", detail: "Prepare approved campaign updates and outreach", icon: MessageSquareText },
    { to: "/analytics", title: "Command Center", detail: "Review progress and verified performance", icon: TrendingUp },
    { to: "/agents", title: "Meet your AI team", detail: "Find NEXUS and specialist tools", icon: Sparkles },
    { to: "/discover", title: "Discover", detail: "Explore community possibilities", icon: Compass },
  ];
  return <main className="ifund-dashboard mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-8">
    <section className="ifund-dashboard-hero space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-cyan-200"><Orbit className="h-5 w-5"/> Mission workspace</p>
          <h1 className="font-display text-4xl sm:text-5xl font-black leading-tight">What if your next idea<br/><span className="text-cyan-200">became possible?</span></h1>
          <p className="max-w-xl text-slate-200">One place to create, plan, share, and celebrate your campaigns. Your existing records stay exactly where they are.</p>
        </div>
        <button onClick={signOut} className="min-h-11 rounded-xl border border-white/30 bg-slate-950/30 px-4 py-2 text-sm text-white hover:bg-white/10">Sign out</button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/create" className="ifund-action bg-gradient-to-r from-cyan-300 via-teal-200 to-violet-300 text-slate-950 shadow-lg shadow-cyan-500/20"><Sparkles className="h-5 w-5"/> Create a campaign <ArrowRight className="h-4 w-4"/></Link>
        <Link to="/campaigns" className="ifund-action border border-white/25 bg-white/10 text-white"><Palette className="w-5 h-5"/> View my campaigns</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[{label:"My campaigns",value:myCampaigns.length},{label:"Active campaigns",value:activeCount},{label:"Drafts to finish",value:draftCount}].map(stat =>
          <div key={stat.label} className="ifund-dashboard-stat p-4"><p className="text-3xl font-bold">{stat.value}</p><p className="text-xs text-slate-200">{stat.label}</p></div>)}
      </div>
      <p className="text-xs text-slate-300">Signed in as {user?.email}</p>
    </section>
    <section className="space-y-4" aria-label="Workspace shortcuts">
      <div className="flex items-end justify-between gap-3">
        <div><h2 className="font-display text-2xl font-bold">Your tools</h2><p className="text-sm text-muted-foreground">Everything you need, without hunting through menus.</p></div>
        <Link to="/campaigns" className="text-sm text-primary underline underline-offset-4">All campaigns</Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {shortcuts.map(({to,title,detail,icon:Icon}) =>
          <Link key={to} to={to} className="ifund-dashboard-module group p-5 transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-300/20 to-violet-300/25"><Icon className="h-6 w-6 text-cyan-700 dark:text-cyan-200"/></div>
            <h3 className="font-semibold flex items-center gap-2">{title}<ArrowRight className="h-4 w-4 opacity-50 transition-transform group-hover:translate-x-1"/></h3>
            <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
          </Link>)}
      </div>
    </section>
    <section className="ifund-dashboard-module p-5 sm:p-7 space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2"><BookOpen className="h-5 w-5 text-violet-500"/> Pick up where you left off</h2>
      <p className="text-sm text-muted-foreground">Continue an existing draft, follow community projects, or check verified financial records. Nothing is automatically published.</p>
      <div className="flex flex-wrap gap-3">
        <Link className="ifund-action bg-cyan-700 text-white" to="/campaigns">Manage my work</Link>
        <Link className="ifund-action border border-border text-foreground" to="/fundraising-hub">External campaigns</Link>
        <Link className="ifund-action border border-border text-foreground" to="/finances">Verified finances</Link>
        <Link className="ifund-action border border-border text-foreground" to="/giving"><HeartHandshake className="h-4 w-4"/> My giving</Link>
      </div>
    </section>
    <EventsDashboardSection/>
    {myCampaignError && <p role="alert">{myCampaignError}</p>}
    {myCampaigns.length > 0 && <section aria-label="Your saved campaigns" className="space-y-4"><h2 className="text-2xl font-semibold">Your saved campaigns</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{myCampaigns.map(c => <CampaignCard key={c.id} campaign={c}/>)}</div></section>}
    {campaignError && <p role="alert">{campaignError}</p>}
    {campaigns.length > 0 && <section className="space-y-4"><h2 className="text-2xl font-semibold">Discover active campaigns</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{campaigns.map(c => <CampaignCard key={c.id} campaign={c}/>)}</div></section>}
  </main>;
}
