import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { platformName } from "@/components/connections/platformCatalog";
import { healthStatus } from "@/lib/externalAccounts";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export default function ActionQueuePanel({ connections, campaigns, onResolved }) {
  const [busyId, setBusyId] = useState(null);
  const queue = connections.filter((c) => healthStatus(c) === "requires_action");

  const resolve = async (c) => {
    setBusyId(c.id);
    try {
      const { data } = await base44.functions.invoke("acknowledgeConnectionIssue", { connection_id: c.id });
      if (data?.ok !== true) throw new Error("Connection acknowledgement rejected");
      onResolved?.();
    } finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-red-500" />
        <p className="text-sm text-stone-600">{queue.length} account{queue.length === 1 ? "" : "s"} require admin action.</p>
      </div>
      <div className="space-y-3">
        {queue.map((c) => (
          <div key={c.id} className="rounded-2xl border border-red-200 bg-red-50/50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-stone-900">{platformName(c.platform)} · {c.display_name || "Unnamed"}</p>
              <p className="text-sm text-stone-600">Campaign: {campaigns[c.campaign_id]?.title || "—"}</p>
              <p className="text-sm text-red-600 mt-1">Action needed: {c.last_error || (c.status === "disconnected" ? "Account disconnected" : "Connection error")}</p>
            </div>
            <button
              onClick={() => resolve(c)}
              disabled={busyId === c.id}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 text-white px-4 h-9 min-h-[44px] text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
            >
              {busyId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Acknowledge error
            </button>
          </div>
        ))}
        {!queue.length && (
          <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-stone-400">No accounts require admin action right now.</div>
        )}
      </div>
    </div>
  );
}