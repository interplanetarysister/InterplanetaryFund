import React from "react";
import { format } from "date-fns";

const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function TreasurySummary({ snapshot }) {
  if (!snapshot) return <p className="text-sm text-slate-500 text-center py-10">No treasury data yet — tap Sync Now.</p>;
  const stats = [
    { label: "Total Raised", value: fmt(snapshot.total_raised), accent: "text-cyan-300" },
    { label: "Held (Clearing)", value: fmt(snapshot.total_held), accent: "text-amber-400" },
    { label: "Fees", value: fmt(snapshot.total_fees), accent: "text-slate-300" },
    { label: "Net Position", value: fmt(snapshot.net_position), accent: "text-emerald-400" },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className={`mt-1 font-display text-xl ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>
      {(snapshot.campaign_totals || []).length > 0 && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 divide-y divide-white/5">
          {snapshot.campaign_totals.map((t, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-slate-300 truncate mr-3">{t.campaign}</span>
              <span className="text-cyan-300 font-semibold shrink-0">{fmt(t.raised)}</span>
            </div>
          ))}
        </div>
      )}
      {snapshot.synced_at && (
        <p className="mt-3 text-[11px] text-slate-500 text-center">Last synced {format(new Date(snapshot.synced_at), "MMM d, h:mm a")}</p>
      )}
    </div>
  );
}