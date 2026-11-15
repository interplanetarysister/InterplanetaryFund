import { Link } from "react-router-dom";
import { ArrowUpRight, HeartHandshake, Lightbulb, ShieldCheck, Share2 } from "lucide-react";

// Independent campaign destinations, not claimed partners or authorized integrations.
// Keep user-managed sharing distinct from API-based publishing.
const DESTINATIONS = [
  { name: "GoFundMe", url: "https://www.gofundme.com/", audience: "Personal needs, emergencies and community support" },
  { name: "Givebutter", url: "https://givebutter.com/", audience: "Nonprofit fundraising, community giving and events" },
  { name: "FundRazr", url: "https://fundrazr.com/", audience: "Personal, charitable and community campaigns" },
];

export default function FundraisingPartners() {
  return <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
    <header className="max-w-3xl space-y-4">
      <p className="text-sm font-semibold uppercase tracking-widest text-primary">Grow together</p>
      <h1 className="font-display text-4xl font-black leading-tight">Your cause. Your choice of fundraising platform.</h1>
      <p className="text-lg text-muted-foreground">iFund helps you plan, improve and share a campaign. You choose where donations are collected. We want to help existing fundraising platforms grow alongside the people they serve.</p>
      <div className="flex flex-wrap gap-3">
        <Link className="rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" to="/create">Prepare my campaign</Link>
        <Link className="rounded-xl border border-border px-5 py-3 font-semibold" to="/connections">Manage sharing connections</Link>
      </div>
    </header>
    <section aria-label="How it works" className="grid gap-3 md:grid-cols-3">
      {[
        {icon:Lightbulb, title:"1. Prepare with AI",detail:"Improve your story, title and campaign presentation before choosing a fundraising home."},
        {icon:HeartHandshake,title:"2. Choose your host",detail:"Pick a platform that fits your cause. The host handles its own account, payments and donations."},
        {icon:Share2,title:"3. Grow your reach",detail:"Use iFund to plan updates and outreach, then share your external campaign link with supporters."}
      ].map(({icon:Icon,title,detail})=><article key={title} className="rounded-2xl border border-border bg-card p-5">
        <Icon aria-hidden="true" className="mb-3 text-primary" size={26}/><h2 className="font-bold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      </article>)}
    </section>
    <section className="space-y-4" aria-labelledby="destinations-title">
      <div><h2 id="destinations-title" className="text-2xl font-bold">Explore fundraising platforms</h2>
      <p className="mt-2 text-sm text-muted-foreground">These are independent services, not confirmed iFund partners. Opening a site does not publish a campaign or transfer your draft.</p></div>
      <div className="grid gap-3 md:grid-cols-3">
        {DESTINATIONS.map(platform=><article className="rounded-2xl border border-border bg-card p-5" key={platform.name}>
          <h3 className="text-xl font-bold">{platform.name}</h3>
          <p className="my-3 min-h-12 text-sm text-muted-foreground">{platform.audience}</p>
          <a href={platform.url} rel="noopener noreferrer" target="_blank" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 py-2 font-semibold">
            Visit {platform.name} <ArrowUpRight size={16} aria-hidden="true"/>
          </a>
        </article>)}
      </div>
    </section>
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2"><ShieldCheck aria-hidden="true" className="text-primary"/><h2 className="text-xl font-bold">Your donations stay with your chosen platform</h2></div>
      <p className="mt-3 text-sm text-muted-foreground">If you host your fundraiser externally, donations are made on that provider's site under its own rules, terms and fees. iFund does not collect, transfer or reconcile those donations. Do not enter partner passwords into iFund. Future account integrations will require provider-approved access and your permission.</p>
      <p className="mt-3 text-sm text-muted-foreground">The optional iFund-hosted fundraising experience remains separate. Its payment terms apply only when choosing to raise funds directly with iFund.</p>
    </section>
  </main>;
}
