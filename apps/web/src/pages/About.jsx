import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import LegalFooter from "@/components/LegalFooter";

export default function About() {
  return (
    <div className="ifund-public min-h-dvh bg-background">
      {/* Hero */}
      <section className="ifund-public-hero relative overflow-hidden deep-space">
        <div className="relative px-5 sm:px-8 py-16 sm:py-24 max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-8"><BrandLogo size="sm" nameClassName="text-slate-100 text-sm" /></div>
          <h1 className="ifund-home-headline font-display text-4xl sm:text-6xl leading-[1.05] text-white mb-6">
            About <span className="brand-gradient-text">Interplanetary Fund</span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
            One place to start, share, and grow a fundraiser.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-14 sm:py-20 space-y-8">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-foreground mb-4">What we do</h2>
          <p className="text-muted-foreground leading-relaxed">
            Interplanetary Fund brings fundraising into one simple place. Create your fundraiser, accept support, share updates, connect the other places you use, talk with supporters, and see how things are going. Built-in helpers can suggest ideas and help with writing or outreach. You stay in control of what they are allowed to do.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-foreground mb-4">Who it is for</h2>
          <p className="text-muted-foreground leading-relaxed">
            Interplanetary Fund is designed for anyone who needs to raise money for a cause, a project, or a dream. That includes individuals fundraising for medical expenses, emergencies, memorials, or creative projects; small businesses seeking capital; nonprofits that want to operate more efficiently; communities organizing around local needs; and institutions looking for a simple fundraising home without juggling lots of different tools. We built it so that a family raising money for an important need can spend less time fighting technology and more time reaching people, and so that an organizer with a great idea and no marketing department can get help that once required a whole team. Our long-term vision extends to organizations, communities, institutions, and eventually businesses participating in a connected funding network.
          </p>
        </div>

        <div>
          <h2 className="font-display text-2xl sm:text-3xl text-foreground mb-4">Who builds it</h2>
          <p className="text-muted-foreground leading-relaxed">
            Interplanetary Fund is built by Michelle Rogers and a team dedicated to making fundraising more connected, transparent, and trustworthy. The platform is engineered with scalability in mind — its ambition is global, and it is being built to help campaigns of every size. We believe fundraising is fundamentally about trust: when someone contributes their money, they are putting trust in the person asking for help. That is why every decision we make — from helpful tools to clear money records and account controls — is grounded in transparency, accountability, and keeping humans in control. We are actively looking for partners who see the potential to build a larger ecosystem around how people fund ideas, causes, projects, and possibilities. Every successful campaign begins with a question: <span className="brand-gradient-text font-semibold">What if?</span> Interplanetary Fund exists to help turn that question into momentum.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5">
          <h2 className="font-display text-xl sm:text-2xl text-foreground mb-3">Fund a healthier planet</h2>
          <p className="text-muted-foreground leading-relaxed">Interplanetary Fund welcomes fundraising for environmental projects, from habitat restoration to waste reduction and cleaner energy. We are working to make our own software more efficient too. Our hosting energy use and overall emissions have not yet been independently verified, and campaign categories alone are not proof of environmental outcomes.</p>
          <Link to="/discover?category=environment" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline">Explore Planet &amp; Environment campaigns <ArrowRight size={16} /></Link>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link to="/discover"><Button variant="outline" className="rounded-xl"><Compass className="w-4 h-4 mr-2" /> Explore causes</Button></Link>
          <Link to="/create"><Button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 hover:opacity-90"><Sparkles className="w-4 h-4 mr-2" /> Start a campaign <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
        </div>
      </section>
      <LegalFooter />
    </div>
  );
}