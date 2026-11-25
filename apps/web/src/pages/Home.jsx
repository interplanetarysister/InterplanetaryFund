import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Compass, LogIn, Sparkles } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import PromptComposer from "@/components/prompt/PromptComposer";
import LegalFooter from "@/components/LegalFooter";
import MobileBottomNav from "@/components/MobileBottomNav";
import QuickActions from "@/components/QuickActions";
import { useAuthSession } from "@/hooks/useAuthSession";

// Public entry is deliberately focused. The archived original homepage lives at
// /our-story, while the established three-step creator remains at /create.
export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const signedIn = Boolean(user && !user.is_anonymous);
  function begin(prompt) {
    navigate("/create?manual=1", { state: { prompt, source: "home-what-if" } });
  }
  return <div className="ifund-public min-h-dvh bg-[#080c18] text-white pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
    <QuickActions user={signedIn ? user : null} />
    <MobileBottomNav user={signedIn ? user : null} />
    <div className="relative isolate min-h-[min(850px,100dvh)] overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
        background:"radial-gradient(ellipse 60% 46% at 50% 24%,rgba(65,94,210,.20),transparent 75%), radial-gradient(ellipse 43% 40% at 85% 85%,rgba(23,165,176,.11),transparent 90%),linear-gradient(180deg,#080c18,#0e1529 65%,#080c18)"
      }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30" style={{
        backgroundImage:"linear-gradient(rgba(153,190,255,.06) 1px, transparent 1px),linear-gradient(90deg,rgba(153,190,255,.06) 1px,transparent 1px)",
        backgroundSize:"72px 72px",maskImage:"linear-gradient(to bottom, transparent, black 32%, transparent)"
      }} />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8" aria-label="Home navigation">
        <Link to="/" aria-label="Interplanetary Fund home" className="inline-flex min-h-11 items-center"><BrandLogo size="sm" nameClassName="text-slate-100 text-sm" /></Link>
        <nav className="flex flex-wrap items-center justify-end gap-2 sm:gap-3" aria-label="Primary">
          <Link to="/our-story" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-200 hover:bg-white/10">Our Story</Link>
          <Link to="/discover" className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-200 hover:bg-white/10 sm:inline-flex">Discover</Link>
          <Link to={signedIn ? "/dashboard" : "/login"} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-200/35 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20">
            {signedIn ? "Dashboard" : <><LogIn className="h-4 w-4" aria-hidden="true" /> Log in</>}
          </Link>
        </nav>
      </header>
      <main className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-5 pb-20 pt-12 text-center sm:px-8 sm:pt-24">
        <p className="mb-6 rounded-full border border-cyan-200/20 bg-cyan-100/5 px-4 py-2 text-xs font-semibold uppercase tracking-[.19em] text-cyan-200">Interplanetary Fund</p>
        <h1 className="ifund-marketing-hero max-w-4xl font-semibold tracking-tight">
          What if <span className="brand-gradient-text">anything</span> were possible?
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
          Tell us what you want to achieve, what you need, or what you want to change. Start with an idea and shape it into something real.
        </p>
        <PromptComposer id="home-what-if" variant="hero" label="What would you like to make possible?"
          placeholder="I want to… I need help with… What if we could…"
          submitLabel="Build my campaign" maxLength={1500}
          note="Your idea stays private until you choose to publish."
          onSubmit={begin} className="mt-9 w-full max-w-2xl !rounded-3xl !border-cyan-100/25 !bg-[#111a30]/95 !p-5 sm:!p-7" />
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link to="/create?manual=1" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-cyan-300/40 px-5 font-semibold text-cyan-100 hover:bg-cyan-100/10"><Sparkles className="h-4 w-4" /> Start a campaign without a prompt</Link>
          <Link to="/discover" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/20 px-5 font-semibold text-slate-200 hover:bg-white/10"><Compass className="h-4 w-4" /> Explore campaigns</Link>
        </div>
        <Link to="/download" className="mt-6 inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-cyan-200 underline underline-offset-4 hover:text-white">Get the IFund app</Link>
        <p className="mt-1 text-xs text-slate-400">Install the web app on iPhone, Android, or desktop.</p>
        {!signedIn && <p className="mt-8 text-sm text-slate-300">Already a member? <Link to="/login" className="font-semibold text-cyan-200 underline underline-offset-4">Log in</Link> · <Link to="/register" className="font-semibold text-cyan-200 underline underline-offset-4">Create a free account</Link></p>}
      </main>
    </div>
    <section className="mx-auto grid max-w-6xl gap-4 px-5 py-12 sm:grid-cols-3 sm:px-8" aria-label="How IFund helps">
      {[
        ["01", "Start with an idea", "Tell us what matters to you. No technical setup required."],
        ["02", "Make it your own", "Adjust your campaign and choose what you want to share."],
        ["03", "Grow with support", "Explore trusted fundraising connections, outreach and guidance."]
      ].map(([number,title,description])=><div key={number} className="rounded-2xl border border-white/10 bg-white/[.04] p-6"><span className="text-xs font-bold tracking-widest text-cyan-300">{number}</span><h2 className="mt-3 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-slate-300">{description}</p></div>)}
    </section>
    <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-5 px-5 pb-12 text-sm"><Link to="/our-story" className="inline-flex min-h-11 items-center gap-2 text-cyan-200 underline underline-offset-4">Discover our story <ArrowRight className="h-4 w-4" /></Link><Link to="/fundraising-partners" className="inline-flex min-h-11 items-center text-slate-300 underline underline-offset-4">Fundraising partners</Link><Link to="/plans" className="inline-flex min-h-11 items-center text-slate-300 underline underline-offset-4">Premium tools &amp; plans</Link></div>
    <LegalFooter />
  </div>;
}
