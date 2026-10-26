import React from "react";
import { format } from "date-fns";
import { FileCheck2 } from "lucide-react";

export default function OpsReports({ reports }) {
  if (!reports.length) {
    return <p className="text-sm text-slate-500 text-center py-10">No protocol reports synced yet.</p>;
  }
  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start gap-3">
            <FileCheck2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" strokeWidth={1.75} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-100 text-sm">{r.title}</p>
              {r.generated_at && (
                <p className="text-[11px] text-slate-500">{format(new Date(r.generated_at), "MMM d, yyyy h:mm a")}</p>
              )}
              <p className="mt-1 text-xs">
                <span className="text-emerald-400 font-semibold">{r.passed_count || 0} passed</span>
                <span className="text-slate-500"> · </span>
                <span className="text-rose-400 font-semibold">{r.failed_count || 0} failed</span>
              </p>
              {r.summary && <p className="mt-1 text-xs text-slate-400">{r.summary}</p>}
              {(r.results || []).length > 0 && (
                <ul className="mt-2 space-y-1">
                  {r.results.map((x, i) => (
                    <li key={i} className="text-xs flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${x.passed ? "bg-emerald-400" : "bg-rose-400"}`} />
                      <span className="text-slate-400 truncate">{x.standard} — {x.campaign}{x.detail ? `: ${x.detail}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}