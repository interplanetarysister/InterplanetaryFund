import React from "react";
import ConfidenceBadge from "./ConfidenceBadge";
import { CalendarDays, CalendarRange, Target, AlertTriangle, TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function PriorityList({ icon: Icon, title, items }) {
  if (!items?.length) return null;
  return (
    <div className="ifund-mobile-card bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
      <h3 className="flex items-center gap-2 font-semibold text-sm text-stone-900 mb-3">
        <Icon className="w-4 h-4 text-primary" /> {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex min-w-0 gap-2 text-sm leading-6 text-slate-600">
            <span className="text-primary font-semibold">{i + 1}.</span> {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BriefingPanel({ brief }) {
  if (!brief) {
    return (
      <p className="text-sm text-stone-400 text-center py-12">
        No briefing yet — run an analysis and Mission Control will build your strategic plan.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-950 rounded-2xl p-6">
        <p className="text-slate-200 leading-relaxed">{brief.summary}</p>
        {brief.generated_at && (
          <p className="text-[11px] text-slate-500 mt-3">
            Updated {formatDistanceToNow(new Date(brief.generated_at), { addSuffix: true })}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PriorityList icon={CalendarDays} title="Today" items={brief.today_priorities} />
        <PriorityList icon={CalendarRange} title="This Week" items={brief.week_priorities} />
        <PriorityList icon={Target} title="Long-Term" items={brief.long_term} />
      </div>

      {brief.risks?.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200/70 shadow-sm p-5">
          <h3 className="flex items-center gap-2 font-semibold text-sm text-stone-900 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Risks
          </h3>
          <ul className="space-y-2">
            {brief.risks.map((r, i) => <li key={i} className="text-sm text-stone-600">• {r}</li>)}
          </ul>
        </div>
      )}

      {brief.predictions?.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-semibold text-sm text-stone-900">
            <TrendingUp className="w-4 h-4 text-primary" /> Predictions
            <span className="text-xs font-normal text-stone-400">— estimates, never guarantees</span>
          </h3>
          {brief.predictions.map((p, i) => (
            <div key={i} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-stone-900">{p.forecast}</p>
                <ConfidenceBadge level={p.confidence} />
              </div>
              {p.evidence && <p className="text-xs text-stone-500 mt-2"><span className="font-semibold">Evidence:</span> {p.evidence}</p>}
              {p.recommended_action && <p className="text-xs text-primary mt-1.5"><span className="font-semibold">Recommended:</span> {p.recommended_action}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}