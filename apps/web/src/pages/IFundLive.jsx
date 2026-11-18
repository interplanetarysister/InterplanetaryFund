import { Link } from "react-router-dom";
import { Radio, Video, Newspaper, Compass, ShieldCheck } from "lucide-react";

// Source-backed live-media gateway. No video stream, schedule or donation is
// claimed unless a provider-backed broadcast session exists.
const sections = [
  { href: "/shorts", title: "Orbit Shorts", detail: "Explore existing campaign video posts and short-form content.", Icon: Video },
  { href: "/social", title: "IFund Social", detail: "Follow community conversations and shared campaign updates.", Icon: Radio },
  { href: "/news", title: "IFund Newscaster", detail: "Read published platform reports, announcements and editorial updates.", Icon: Newspaper },
  { href: "/discover", title: "Explore campaigns", detail: "Find publicly visible fundraisers and ways to connect.", Icon: Compass },
];
export default function IFundLive() {
  return <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
    <header className="space-y-3">
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">Interplanetary Fund / Media</p>
      <h1 className="font-display text-3xl font-bold sm:text-4xl">IFund Live</h1>
      <p className="max-w-3xl text-muted-foreground">Find video stories, ongoing community discussions, and the latest published IFund reporting from one place.</p>
    </header>
    <section className="grid gap-4 sm:grid-cols-2" aria-label="Explore IFund media">
      {sections.map(({href,title,detail,Icon}) => <Link key={href} to={href} className="flex min-h-36 flex-col gap-3 rounded-2xl border border-border bg-card p-5 hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </Link>)}
    </section>
    <section className="space-y-2 rounded-2xl border border-border bg-card p-5" aria-labelledby="livestream-status">
      <h2 id="livestream-status" className="flex items-center gap-2 text-xl font-semibold"><ShieldCheck aria-hidden="true" /> Live broadcasts</h2>
      <p className="text-muted-foreground">Verified live broadcasting and scheduled event streams are not yet available here. No stream or donation is represented as active.</p>
      <p className="text-sm text-muted-foreground">Future broadcasts will require host permission, provider-backed session verification, moderation, clear recording consent and safe links to the original campaign.</p>
      <Link to="/fundraising-tips" className="inline-flex min-h-11 items-center text-primary underline">Improve your fundraiser while you explore</Link>
    </section>
  </main>;
}
