import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import BrandLogo from "@/components/brand/BrandLogo";
import LegalFooter from "@/components/LegalFooter";
import PrelaunchNotice from "@/components/prelaunch/PrelaunchNotice";
import PayPalDonateButton from "@/components/payments/PayPalDonateButton";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import QuickActions from "@/components/QuickActions";
import MobileBottomNav from "@/components/MobileBottomNav";
import { useAuthSession } from "@/hooks/useAuthSession";
import useDocumentTitle from "@/hooks/useDocumentTitle";

// Archived original Base44 hero artwork, bundled locally with Cloudflare Pages.
// SHA-256 and original source are recorded in public/images/base44-archive/manifest.json.
const HERO_IMAGE = "/images/base44-archive/19cbf6ba785409de9ac0.png";

// "Who is Interplanetary Fund?" — the full story is the page now (Sprint 3,
// 2026-11-25). Previously this file was a copy of the old homepage — same
// hero, prompt composer, categories, featured campaigns and how-it-works —
// with the story hidden behind a "Read more" expander, so /our-story
// rendered as a second homepage. The homepage sections are gone; the story
// below is fully visible.
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

export default function OurStory() {
  const platformOnlyMode = !usePublicCampaignFundraising();
  const { user } = useAuthSession();
  const isAuthenticated = Boolean(user);
  // Standalone page outside <Layout />: set its own title (Sprint 3).
  useDocumentTitle("Our Story");

  return (
    <div className="ifund-public min-h-dvh bg-background pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <MobileBottomNav user={isAuthenticated ? user : null} />
      <QuickActions user={isAuthenticated ? user : null} />
      {platformOnlyMode && (
        <div className="max-w-5xl mx-auto px-4 sm:px-8 pt-4">
          <PrelaunchNotice />
        </div>
      )}
      {/* Story hero — distinct from the homepage hero: no prompt composer,
          no campaign browsing. The story is the page. */}
      <section className="ifund-public-hero relative overflow-hidden deep-space">
        <img src={HERO_IMAGE} alt="A glowing planet arc surrounded by stars and soft nebula light" className="absolute inset-0 w-full h-full opacity-40 object-cover" style={{ objectPosition: "70% 60%" }} />
        <div className="relative px-5 sm:px-8 py-14 sm:py-20 max-w-3xl mx-auto text-center">
          <p className="ifund-editorial-eyebrow mb-6">Our Story</p>
          <div className="flex justify-center mb-7"><BrandLogo size="sm" nameClassName="text-slate-100 text-sm" /></div>
          <h1 className="ifund-page-heading text-white">
            Why we built Interplanetary Fund
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed mt-5 max-w-xl mx-auto">One place to ask for help — or make something possible. This is the story behind it.</p>
        </div>
      </section>

      {/* The full story, on the page — not hidden behind an expander. */}
      <article className="mx-auto max-w-3xl px-5 sm:px-8 py-14 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary mb-3">Who is Interplanetary Fund?</p>
        <h2 className="font-display text-3xl sm:text-4xl text-foreground mb-8 leading-tight">One place to shape a cause, find your people, and understand what actually happens.</h2>

        <div className="space-y-5">
          {OPENING.map((p, i) => <p key={i} className="text-muted-foreground leading-relaxed">{p}</p>)}
        </div>

        <div className="space-y-8 mt-10">
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

        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          <Link to="/discover"><Button variant="outline" className="!min-h-12 rounded-xl"><Compass className="w-4 h-4 mr-2" /> Explore causes</Button></Link>
          <Link to="/create"><Button className="!min-h-12 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 hover:opacity-90"><Sparkles className="w-4 h-4 mr-2" /> Start a campaign</Button></Link>
        </div>
        {!isAuthenticated && (
          <p className="mt-6 text-center text-sm text-muted-foreground">New here? <Link to="/register" className="font-semibold text-primary underline underline-offset-4">Create your free account</Link> <ArrowRight className="inline h-4 w-4" aria-hidden="true" /></p>
        )}

        <div className="max-w-sm mx-auto mt-9 rounded-2xl border border-border p-4 text-center">
          <p className="text-sm font-medium text-foreground mb-2">Support Interplanetary Fund itself</p>
          <p className="text-xs text-muted-foreground mb-3">This donation helps operate the platform. It is not credited to any individual campaign.</p>
          <PayPalDonateButton label="Support Interplanetary Fund with PayPal" />
        </div>
      </article>
      <LegalFooter />
    </div>
  );
}
