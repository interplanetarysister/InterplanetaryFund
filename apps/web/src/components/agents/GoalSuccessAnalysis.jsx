import {Link} from "react-router-dom";
import {analyzeGoalSuccess} from "@/lib/goalSuccessAnalysis.mjs";

const label={baseline:"Useful starting point",explore:"Worth researching",consider_carefully:"Review risks first",optional:"Optional avenue"};
export default function GoalSuccessAnalysis({campaign}) {
  const analysis=analyzeGoalSuccess(campaign);
  const query=encodeURIComponent(campaign?.id||"");
  const money=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2});
  return <section className="space-y-4 rounded-2xl border border-cyan-500/25 bg-cyan-500/[.04] p-4 sm:p-5" aria-label="Goal Success Analysis">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="text-lg font-bold">Goal Success Analysis</h3>
        <p className="mt-1 text-sm text-muted-foreground">Explore more than donations: opportunities to earn, receive, borrow responsibly, or reduce the cash needed.</p>
      </div>
      <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">NEXUS · Team planning</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground">Campaign cash target</p>
        <p className="mt-1 font-semibold">{analysis.target===null?"Not specified":money.format(analysis.target)}</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground">Verified funding received</p>
        <p className="mt-1 font-semibold">See verified finances</p>
        <p className="text-xs text-muted-foreground">Not calculated from opportunities</p>
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground">Confirmed donated resources</p>
        <p className="mt-1 font-semibold">Not verified here</p>
        <p className="text-xs text-muted-foreground">Keep separate from cash</p>
      </div>
    </div>
    <p className="text-sm font-medium">{analysis.suggestedNextStep}</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {analysis.channels.map(channel=><article key={channel.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold">{channel.title}</h4>
          <span className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{label[channel.relevance]}</span>
        </div>
        <p className="text-xs font-medium text-cyan-700 dark:text-cyan-300">{channel.role}</p>
        <p className="text-sm text-muted-foreground">{channel.why}</p>
        <p className="text-sm">{channel.start}</p>
        <p className="text-xs text-muted-foreground">Individual opportunity: {channel.verification} · No funds or supplies confirmed</p>
        <Link to={channel.route+(channel.route==="/institutions"&&query?"?campaign="+query:"")}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4">
          {channel.id==="financing"?"Review financial information":"Explore this pathway"}
        </Link>
      </article>)}
    </div>
    <p className="text-xs leading-relaxed text-muted-foreground">{analysis.disclaimer} Check original sources, program conditions, deadlines, contact permissions and legal requirements before taking action.</p>
  </section>;
}
