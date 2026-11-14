import { useMemo, useState } from "react";
import { DonutChart } from "@/components/analytics/CampaignMetrics";
import { calculateCampaignReadiness } from "@/lib/campaignReadinessScore.mjs";

export default function CampaignReadinessScore({ form }) {
  const [sharingPlan,setSharingPlan]=useState(false);
  const review=useMemo(()=>calculateCampaignReadiness(form,{sharingPlan}),[form,sharingPlan]);
  const data=[
    ...review.rows.map(row=>({name:row.label,value:row.earned,label:row.earned+" / "+row.max+" points"})),
    {name:"Room to improve",value:100-review.total,label:(100-review.total)+" points"},
  ];
  const label=review.total>=85?"Strong editorial completeness":review.total>=60?"Good foundation — review the tips":"Keep developing your campaign";
  return <section aria-label="Campaign readiness score" className="rounded-2xl border border-emerald-400/25 bg-card p-5 sm:p-7 space-y-4">
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">Campaign studio · readiness insights</p>
      <h2 className="text-xl font-semibold">Your campaign readiness score</h2>
      <p className="text-sm text-muted-foreground">See which areas you can improve before sharing your campaign.</p>
    </div>
    <div className="flex flex-wrap items-baseline gap-3" aria-live="polite">
      <strong className="text-4xl font-bold tabular-nums">{review.total}<span className="text-xl font-medium text-muted-foreground">/100</span></strong>
      <span className="text-sm font-semibold">{label}</span>
    </div>
    <DonutChart data={data} title="Campaign editorial readiness categories" valueText={review.total+" out of 100 editorial points"} />
    <p className="text-xs text-muted-foreground">{review.disclosure}</p>
    <label id="campaign-sharing-plan" className="flex gap-3 rounded-xl border border-border p-3 text-sm">
      <input type="checkbox" checked={sharingPlan} onChange={event=>setSharingPlan(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0" />
      <span>I have a responsible plan to share this campaign with my community. <span className="block text-xs text-muted-foreground">Self-declared; this does not connect accounts or publish posts.</span></span>
    </label>
    <div className="space-y-2">
      <h3 className="font-semibold">Ways to improve</h3>
      {review.tips.length===0 ? <p className="text-sm">All checklist categories are complete. Please still verify accuracy and permissions.</p> :
      <ul className="space-y-2">{review.tips.map(row=><li key={row.key} className="rounded-xl border border-border p-3">
        <div className="flex items-center justify-between gap-2 text-sm"><strong>{row.label}</strong><span className="tabular-nums text-muted-foreground">{row.earned}/{row.max}</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{row.tip}</p>
        <a href={"#"+row.field} className="mt-2 inline-block min-h-10 py-2 text-sm font-semibold text-primary underline">Improve this section</a>
      </li>)}</ul>}
    </div>
    <p className="text-sm text-muted-foreground">A low readiness score does not prevent publishing. Standard account, required-field, story-format and financial safety checks still apply.</p>
  </section>;
}
