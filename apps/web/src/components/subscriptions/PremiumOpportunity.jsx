import { Link } from "react-router-dom";

/** A contextual invitation, never a fake checkout or mandatory creation step. */
export default function PremiumOpportunity({ context = "general", compact = false }) {
  const copy = {
    dashboard: ["Make more possible with your AI Team", "Try premium AI assistance for 24 hours. Explore plans when you want to continue creating."],
    agent: ["Keep creating with your AI Team", "See premium access options when your trial or AI allowance ends. Site navigation remains free."],
    creator: ["Want a hand with your story?", "AI writing is optional. You can always write, upload, save and publish your campaign yourself."],
    artwork: ["Create more with IFund", "Premium plans support eligible AI artwork and editing. Manual image uploads stay available."],
    general: ["Explore premium IFund tools", "Upgrade only when you want more AI assistance. Your free campaign tools remain available."]
  };
  const [title, description] = copy[context] || copy.general;
  return <aside aria-label="Optional premium features" className={compact
    ?"flex flex-wrap items-center justify-between gap-2 rounded-lg bg-cyan-500/[.055] px-2 py-2 text-xs"
    :"rounded-2xl border border-cyan-400/25 bg-gradient-to-r from-cyan-500/[.07] via-transparent to-violet-500/[.06] p-5"}>
    <div className={"flex flex-wrap items-center justify-between gap-3 "+(compact?"text-sm":"")}>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        {!compact&&<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <Link to="/subscriptions" className={compact
        ?"inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-2 font-semibold text-cyan-500 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        :"inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"}>View premium plans</Link>
    </div>
    {!compact && <p className="mt-3 text-xs text-muted-foreground">No automatic charge. Membership prices and enrollment are confirmed by the payment provider before checkout.</p>}
  </aside>;
}
