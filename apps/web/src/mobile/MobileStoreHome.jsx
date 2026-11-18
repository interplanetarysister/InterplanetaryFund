import { Link } from "react-router-dom";
import { Compass, Leaf, Share2, ShieldCheck, CalendarDays } from "lucide-react";
const cards = [
  { to: "/discover", title:"Find a cause", text:"Browse currently published campaigns on the shared live IFund platform.", icon:Compass },
  { to: "/plan", title:"Plan your story", text:"Use a private, on-device campaign checklist. Your answers are not transmitted.", icon:Leaf },
  { to: "/account", title:"Your IFund account", text:"Use your existing sign-in, review your campaigns and manage account controls.", icon:ShieldCheck },
  { to: "/events", title:"Fundraising events", text:"Find benefit dinners, art auctions and community events, then save your RSVP to your account.", icon:CalendarDays },
];
export default function MobileStoreHome() {
  return <div className="space-y-8">
    <header className="relative overflow-hidden rounded-[28px] border border-emerald-300/20 bg-gradient-to-br from-[#163c42] via-[#102c40] to-[#0b2132] p-6 shadow-xl sm:p-9">
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full border border-cyan-300/20 shadow-[0_0_80px_35px_rgba(23,184,128,.13)]" aria-hidden="true"/>
      <p className="relative text-sm font-bold uppercase tracking-[.18em] text-emerald-200">What if?</p>
      <h1 className="relative mt-3 max-w-lg text-3xl font-bold leading-tight sm:text-4xl">Your cause. A world of possibilities.</h1>
      <p className="relative mt-4 max-w-lg text-sm leading-7 text-slate-200">Discover campaigns, prepare a thoughtful fundraising story and share causes using your phone's native sharing tools.</p>
      <Link to="/discover" className="relative mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-200 px-5 py-3 text-sm font-bold text-[#08231f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        Explore live campaigns <Compass aria-hidden="true" className="h-5 w-5"/>
      </Link>
    </header>
    <section aria-labelledby="mobile-features" className="space-y-4">
      <h2 id="mobile-features" className="text-xl font-bold">Find your way</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map(({to,title,text,icon:Icon})=><Link key={to} to={to} className="group flex min-h-36 flex-col items-start gap-3 rounded-2xl border border-emerald-300/20 bg-white/5 p-5 transition hover:border-emerald-200/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">
          <Icon aria-hidden="true" className="h-6 w-6 text-emerald-300"/><strong className="text-lg">{title}</strong>
          <span className="text-sm leading-6 text-slate-300">{text}</span>
        </Link>)}
      </div>
    </section>
    <section className="rounded-2xl border border-cyan-300/20 bg-cyan-900/10 p-5">
      <h2 className="flex items-center gap-2 font-bold"><Share2 aria-hidden="true" className="h-5 w-5"/> Share on your terms</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">Sharing opens your device's native share sheet. IFund does not send posts automatically or imply a donation has occurred.</p>
    </section>
  </div>;
}
