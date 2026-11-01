import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Recent refresh history — shows the last few platform sync runs so you can see
// what each platform reported without leaving the Connections page.
const PROVIDER_LABELS = {
  imported: "Updated",
  realtime_webhook: "Updates automatically",
  no_read_api: "Manual totals only",
  credentials_required: "Needs sign-in",
  error: "Couldn't check",
};

const OVERALL_LABELS = {
  success: { text: "Working", tone: "text-emerald-600" },
  partial: { text: "Partly", tone: "text-amber-600" },
  failed: { text: "Failed", tone: "text-red-600" },
  unavailable: { text: "Nothing new", tone: "text-stone-500" },
  no_connections: { text: "Nothing on yet", tone: "text-stone-500" },
};

export default function SyncRunHistory({ refreshKey = 0 }) {
  const [runs, setRuns] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await base44.entities.SyncRun.filter({}, "-started_at", 5);
        if (!cancelled) setRuns(list || []);
      } catch {
        if (!cancelled) setRuns([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-stone-400 py-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading refresh history…
      </div>
    );
  }
  if (!runs || runs.length === 0) {
    return (
      <p className="text-sm text-stone-500 py-2">
        No refreshes yet. Press <span className="font-semibold">Refresh now</span> to check your platforms.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {runs.map((run) => {
        const overall = OVERALL_LABELS[run.overall_status] || { text: run.overall_status, tone: "text-stone-500" };
        const providers = (run.provider_results || []).slice(0, 4);
        return (
          <div key={run.id} className="rounded-xl border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-sm font-semibold ${overall.tone}`}>{overall.text}</span>
              <span className="text-xs text-stone-400">
                {run.started_at ? formatDistanceToNow(new Date(run.started_at), { addSuffix: true }) : ""}
              </span>
            </div>
            {providers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {providers.map((p, i) => (
                  <span key={`${p.provider}-${i}`} className="text-xs rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-stone-600">
                    {p.provider}: {PROVIDER_LABELS[p.status] || p.status}
                  </span>
                ))}
              </div>
            )}
            {run.total_discovered > 0 && (
              <p className="text-xs text-stone-500 mt-1.5">
                {run.discovered_totals && run.discovered_totals.length
                  ? run.discovered_totals.map((d) => `${d.currency} ${Number(d.amount || 0).toLocaleString()}`).join(" · ") + " observed"
                  : `USD ${run.total_discovered.toLocaleString()} observed`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}