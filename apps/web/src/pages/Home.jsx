import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/brand/BrandLogo";
import LegalFooter from "@/components/LegalFooter";
import { Sparkles, Compass, ArrowRight, ChevronDown, ChevronUp, Download, LayoutTemplate, ShieldCheck, Wand2 } from "lucide-react";
import PrelaunchNotice from "@/components/prelaunch/PrelaunchNotice";
import PayPalDonateButton from "@/components/payments/PayPalDonateButton";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import QuickActions from "@/components/QuickActions";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useAuthSession } from "@/hooks/useAuthSession";
import PromptComposer from "@/components/prompt/PromptComposer";
import CampaignCategoryGrid from "@/components/campaigns/CampaignCategoryGrid";
import CampaignCard from "@/components/campaigns/CampaignCard";
import { listActiveCampaigns } from "@/api/publicData";

// Archived original Base44 hero artwork, bundled locally with Cloudflare Pages.
// SHA-256 and original source are recorded in public/images/base44-archive/manifest.json.
const HERO_IMAGE = "/images/base44-archive/19cbf6ba785409de9ac0.png";

// "Who is Interplanetary Fund?" — the opening of our story shows directly; the
// full letter expands behind "Read more · Our Story".
const OPENING = [
  "Thank you for giving me the opportunity to introduce you to Interplanetary Fund.",
  "I want to start with a simple question: What if raising money for a cause, a business idea, a personal need, or a dream didn't require people to navigate a dozen different platforms?",
  "What if the technology could bring the fundraising ecosystem together?",
  "That is the idea behind Interplanetary Fund.",
];

const STORY = [
  { h: "The problem we're solving", p: "Today, people who need funding are often forced to piece together their fundraising strategy across crowdfunding platforms, social media, messaging, email, and other tools. They create a campaign in one place, promote it somewhere else, communicate with supporters somewhere else, analyze results somewhere else, and try to figure out what to do next on their own." },
  { h: "Fundraising, all in one place", p: "Fundraising should not mean jumping between a pile of different tools. Interplanetary Fund brings the important parts together: create your fundraiser, share it, keep up with supporters, see how it is doing, and grow it from one place." },
  { h: "Connect campaigns with what they need", p: "Our vision is to connect campaigns with the people, platforms, communication channels, and intelligence they need to succeed. Imagine creating one campaign and having the platform help you determine where that campaign should be promoted. Imagine connecting your social accounts and eventually being able to distribute approved campaign content across multiple networks instead of manually recreating the same post over and over. Imagine having one dashboard that shows campaign performance, communication, opportunities, and the next actions that could make the biggest difference." },
  { h: "Help when you want it", p: "Your built-in helper can suggest what to do next, improve your message, find useful opportunities, and help with everyday campaign work. You decide what it may do. You can change those choices anytime." },
  { h: "Because fundraising is about trust", p: "Because fundraising isn't just about technology. It's about trust. When someone contributes their money, they're putting trust in the person asking for help. That's why we're designing Interplanetary Fund around transparency, trust signals, campaign information, communication, and accountability." },
  { h: "Beyond individual campaigns", p: "We're also thinking beyond individual campaigns. Our long-term vision is an ecosystem where individuals, organizations, communities, institutions, and eventually businesses can participate in a connected funding network. And the opportunity is much larger than simply collecting donations. The real opportunity is the infrastructure surrounding fundraising: Discovery. Communication. Distribution. Analytics. Automation. Donor relationships. Campaign intelligence. And eventually, a network connecting people who need funding with people looking for meaningful opportunities to contribute. That creates multiple potential paths for growth and monetization." },
  { h: "Something people genuinely want to use", p: "But our first priority is not maximizing the number of revenue streams. It's building something people genuinely want to use. We want someone with a great idea and no marketing department to have access to capabilities that previously required a team. We want a nonprofit to be able to operate more efficiently. We want a family raising money for an important need to spend less time fighting technology and more time reaching people. And we want organizations to eventually have powerful fundraising tools without having to piece together lots of different products." },
  { h: "Turning What if into What happens next", p: "That's the larger vision. Interplanetary Fund is not just about helping people raise money. It's about making the process of turning an idea into momentum easier. Because every successful campaign begins with a question: What if? What if this idea worked? What if this project became real? What if enough people believed in it? What if the right person discovered it at exactly the right moment? Interplanetary Fund exists to help create that possibility. We are building the infrastructure that can help turn \u201cWhat if?\u201d into \u201cWhat happens next?\u201d" },
  { h: "Our ambition is global", p: "And that's why we're here today. We're looking for partners who see the potential to build a much larger ecosystem around how people fund ideas, causes, projects, and possibilities. Our ambition is global. Our technology is being built with scalability in mind. And our long-term goal is simple: Create a world where great ideas have a better chance of finding the people, resources, and momentum they need to become reality." },
];

export default function Home() {
  const platformOnlyMode = !usePublicCampaignFundraising();
  const navigate = useNavigate();
  const { user } = useAuthSession();
  const isAuthenticated = Boolean(user);
  const [heroOk, setHeroOk] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    let active = true;
    listActiveCampaigns({ limit: 6 })
      .then((items) => { if (active) setCampaigns(items); })
      .catch(() => { /* A guest-readable failure must not hide the rest of the page. */ });
    return () => { active = false; };
  }, []);

  function startFromPrompt(prompt) {
    navigate("/create?manual=1", { state: { prompt, source: "home-what-if" } });
  }

  return (
    <div className="ifund-public min-h-dvh bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <MobileBottomNav user={isAuthenticated ? user : null} />
      <QuickActions user={isAuthenticated ? user : null} />
      {platformOnlyMode && (
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-4">
          <PrelaunchNotice />
        </div>
      )}
      {/* Hero */}
      <section className="ifund-public-hero relative overflow-hidden deep-space">
        {heroOk && <img src={HERO_IMAGE} alt="A glowing planet arc surrounded by stars and soft nebula light" className="absolute inset-0 w-full h-full opacity-60 object-cover" style={{ objectPosition: "70% 60%" }} onError={() => setHeroOk(false)} />}
        <div className="relative px-5 sm:px-8 py-14 sm:py-20 max-w-3xl mx-auto text-center">
          <p className="ifund-editorial-eyebrow mb-6">A universe of possibility</p>
          <div className="flex justify-center mb-7"><BrandLogo size="sm" nameClassName="text-slate-100 text-sm" /></div>
          <h1 className="ifund-home-headline font-display text-4xl sm:text-6xl leading-[1.05] text-white mb-5">
            Endless possibilities start with one question:
            <br />
            <span className="brand-gradient-text">What if?</span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8 max-w-xl mx-auto">One place to ask for help — or make something possible.</p>
          <PromptComposer
            id="home-what-if"
            variant="hero"
            label="Describe a goal, a problem to solve, or a financial burden."
            placeholder="What would you like help making possible?"
            submitLabel="Continue"
            maxLength={1500}
            note="We'll fill in your draft. You can edit everything before publishing."
            onSubmit={startFromPrompt}
            className="mb-6 mx-auto max-w-xl"
          />
          <div className="flex flex-wrap items-center justify-center gap-3">
            {isAuthenticated ? (
              <Link to="/dashboard"><Button size="lg" className="!min-h-12 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/25 hover:opacity-90">Go to dashboard <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
            ) : (
              <>
                <Link to="/create?manual=1"><Button size="lg" className="!min-h-12 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/25 hover:opacity-90"><Sparkles className="w-4 h-4 mr-2" /> Create a campaign</Button></Link>
                <Link to="/discover"><Button size="lg" variant="outline" className="!min-h-12 rounded-xl border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"><Compass className="w-4 h-4 mr-2" /> Explore causes</Button></Link>
              </>
            )}
          </div>
          <Link to="/download" className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/40 bg-slate-950/75 px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-200 hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300">
            <Download className="h-4 w-4" aria-hidden="true" /> Get the IFund app
          </Link>
          <p className="mt-2 text-xs text-slate-300">Install the web app on iPhone, Android, or desktop.</p>
          <div className="mt-7 mx-auto max-w-md rounded-2xl border border-cyan-400/30 bg-slate-950/65 px-5 py-5 text-center">
            <p className="text-lg font-semibold text-white">Be here from the beginning.</p>
            <p className="mt-1 mb-4 text-sm text-slate-300">Create a free Interplanetary Fund account to follow campaigns, share ideas and start building a fundraiser.</p>
            <Link to="/register" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Create your free account <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </div>
          {!isAuthenticated && (
            <p className="mt-8 text-sm text-slate-400">Already have an account? <Link to="/login" className="inline-flex min-h-11 items-center text-cyan-300 hover:text-cyan-200 font-medium">Log in</Link> · <Link to="/register" className="inline-flex min-h-11 items-center text-cyan-300 hover:text-cyan-200 font-medium">Create one</Link></p>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20" aria-labelledby="home-categories-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Find your starting point</p>
            <h2 id="home-categories-heading" className="font-display text-3xl sm:text-4xl leading-tight">What are you hoping to make possible?</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">Choose a cause to see real campaigns — or start one of your own with a template that fits.</p>
          </div>
          <Link to="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold">Browse all <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <div className="mt-5">
          <CampaignCategoryGrid linkTo={(id) => `/discover?category=${id}`} limit={6} columns="sm:grid-cols-2 lg:grid-cols-3" headingLevel={3} />
        </div>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link to="/templates" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/5 px-4 font-semibold text-cyan-800 dark:text-cyan-200"><LayoutTemplate className="h-4 w-4" aria-hidden="true" /> See campaign templates</Link>
          <Link to="/fundraising-partners" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 font-semibold">Fundraising partners</Link>
          <Link to="/fund-your-mission" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 font-semibold">Fund your Mission <ArrowRight size={16}/></Link>
        </div>
      </section>

      {/* Featured campaigns */}
      {campaigns.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20" aria-labelledby="home-campaigns-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Real people, real needs</p>
              <h2 id="home-campaigns-heading" className="font-display text-3xl sm:text-4xl leading-tight">Campaigns you can support today</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">Every campaign below is published by its owner. Funding totals appear only when verified.</p>
            </div>
            <Link to="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold">See all campaigns <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20" aria-labelledby="home-how-heading">
        <div className="ifund-cosmic-panel rounded-3xl border border-border p-6 sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-2">Simple by design</p>
          <h2 id="home-how-heading" className="font-display text-3xl sm:text-4xl leading-tight">Three steps, no maze.</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { icon: Wand2, title: "Describe it", body: "Answer one plain-language prompt. iFund helps shape the idea into a private plan." },
              { icon: LayoutTemplate, title: "Make it yours", body: "Choose a template, add your own words and images, and preview it on mobile or desktop." },
              { icon: ShieldCheck, title: "Share it safely", body: "Publish when you are ready. Guest giving is welcome, and verified payment results are shown honestly." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border bg-card p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/create?manual=1" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 font-semibold text-white"><Sparkles className="h-4 w-4" aria-hidden="true" /> Start free</Link>
            <Link to="/plans" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border px-5 font-semibold">See plans</Link>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="ifund-story-surface max-w-3xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary mb-3">Who is Interplanetary Fund?</p>
        <h2 className="font-display text-3xl sm:text-4xl text-foreground mb-8 leading-tight">One place to shape a cause, find your people, and understand what actually happens.</h2>

        <div className="space-y-5">
          {OPENING.map((p, i) => <p key={i} className="text-muted-foreground leading-relaxed">{p}</p>)}
        </div>

        {expanded && (
          <div className="space-y-8 mt-8 animate-fade-up">
            {STORY.map((s) => (
              <div key={s.h}>
                <h3 className="font-display text-xl text-foreground mb-2">{s.h}</h3>
                <p className="text-muted-foreground leading-relaxed">{s.p}</p>
              </div>
            ))}
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5 text-center">
              <p className="font-display text-xl text-foreground">That's Interplanetary Fund.</p>
              <p className="text-muted-foreground mt-1">Endless possibilities start with one question: <span className="brand-gradient-text font-semibold">What if?</span></p>
            </div>
          </div>
        )}

        <div className="mt-10 flex flex-col items-center">
          <button onClick={() => setExpanded((v) => !v)} className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors min-h-[44px]">
            {expanded ? <>Show less <ChevronUp className="w-4 h-4" /></> : <>Read more · Our Story <ChevronDown className="w-4 h-4" /></>}
          </button>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Link to="/discover"><Button variant="outline" className="!min-h-12 rounded-xl"><Compass className="w-4 h-4 mr-2" /> Explore causes</Button></Link>
          <Link to="/create"><Button className="!min-h-12 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 hover:opacity-90"><Sparkles className="w-4 h-4 mr-2" /> Start a campaign</Button></Link>
          <div className="max-w-sm mx-auto mt-9 rounded-2xl border border-border p-4 text-center">
            <p className="text-sm font-medium text-foreground mb-2">Support Interplanetary Fund itself</p>
            <p className="text-xs text-muted-foreground mb-3">This donation helps operate the platform. It is not credited to any individual campaign.</p>
            <PayPalDonateButton label="Support Interplanetary Fund with PayPal" />
          </div>
        </div>
      </section>
      <LegalFooter />
    </div>
  );
}
