import { Link } from "react-router-dom";
import { Mail, Flag, ShieldCheck } from "lucide-react";
export default function MobileStoreHelp() {
  return <div className="space-y-6">
    <header className="space-y-2"><h1 className="text-3xl font-bold">Help and safety</h1>
      <p className="text-sm leading-6 text-slate-300">Contact Interplanetary Fund about a campaign, app problem, privacy concern or account request.</p></header>
    <section className="space-y-4 rounded-2xl border border-white/20 bg-white/5 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Mail aria-hidden="true" className="h-5 w-5 text-emerald-300"/> Contact IFund</h2>
      <a href="mailto:hello@interplanetaryfund.com" className="inline-flex min-h-12 items-center rounded-lg border border-emerald-300/40 px-4 text-sm font-semibold text-emerald-200">hello@interplanetaryfund.com</a>
      <p className="text-sm text-slate-300">Do not send passwords, authentication codes, full payment-card numbers or sensitive medical documents in email.</p>
    </section>
    <section className="space-y-3 rounded-2xl border border-white/20 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Flag aria-hidden="true" className="h-5 w-5 text-emerald-300"/> Report an unsafe campaign</h2>
      <p className="text-sm leading-6 text-slate-300">Open the campaign and choose <strong>Report content</strong>. Signed-in reports create a tracked review case. You can also hide that campaign from your Explore list.</p>
      <Link to="/discover" className="inline-flex min-h-11 items-center rounded-lg bg-emerald-200 px-4 text-sm font-bold text-slate-950">Explore campaigns</Link>
    </section>
    <section className="space-y-3 rounded-2xl border border-white/20 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck aria-hidden="true" className="h-5 w-5 text-emerald-300"/> Privacy and account deletion</h2>
      <div className="flex flex-wrap gap-4"><Link to="/delete-account" className="text-emerald-200 underline">Delete your account</Link><Link to="/privacy" className="text-emerald-200 underline">Privacy policy</Link><Link to="/terms" className="text-emerald-200 underline">Terms</Link></div>
    </section>
  </div>;
}
