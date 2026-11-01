import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Coins, AlertTriangle, Info, Wifi, Clock } from "lucide-react";

// "Count My Money" — retrieves and reconciles available donation and fund
// information from every connected, supported fundraising platform for every
// campaign owned by the signed-in user. Calls the centralized syncExternalFunds
// engine and classifies each source by freshness and reliability so the user
// always knows what is LIVE, INFORMATIONAL, or needs attention.

function classifySource(r) {
  // LIVE: real-time webhook sync — funds are observed as they arrive.
  if (r.status === "realtime_webhook") return { type: "live", label: "Live", icon: Wifi, color: "text-emerald-600", bg: "bg-emerald-50" };
  // IMPORTED: transactions were successfully imported from a provider API.
  if (r.status === "imported") return { type: "live", label: "Live", icon: Wifi, color: "text-emerald-600", bg: "bg-emerald-50" };
  // INFORMATIONAL: no read API or credentials required — external totals are
  // owner-reported and must never be presented as withdrawable cash.
  if (["no_read_api", "credentials_required"].includes(r.status)) {
    return { type: "informational", label: "Informational", icon: Info, color: "text-blue-600", bg: "bg-blue-50" };
  }
  // ERROR: the sync failed for this provider.
  if (r.status === "error") return { type: "error", label: "Needs attention", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" };
  // MANUAL: provider requires user action for payout.
  return { type: "manual", label: "Manual", icon: Clock, color: "text-stone-600", bg: "bg-stone-50" };
}

export default function CountMyMoney() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const { data } = await base44.functions.invoke("syncExternalFunds", { scope: "user", initiator_type: "user", request_id: crypto.randomUUID() });
      setResult(data);
    } catch (e) {
      setError("We couldn't count your money right now. Please try again.");
    }
    setBusy(false);
  };

  // Separate results by classification for clear display.
  const providerResults = result?.provider_results || [];
  const liveSources = providerResults.filter(r => classifySource(r).type === "live");
  const informationalSources = providerResults.filter(r => classifySource(r).type === "informational");
  const errorSources = providerResults.filter(r => classifySource(r).type === "error");
  const manualSources = providerResults.filter(r => classifySource(r).type === "manual");

  // External observed totals are NEVER the same as withdrawable cash.
  const externalObserved = result?.total_discovered || 0;
  const withdrawable = result?.withdrawable_imported || 0;

  const overallOk = result && ["success", "partial"].includes(result.overall_status);
  const noConnections = result?.overall_status === "no_connections";

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">
        <Coins className="w-3.5 h-3.5" /> Count My Money
      </p>
      <p className="text-sm text-stone-600 mb-4">
        Check every connected fundraising platform and update your totals.
      </p>
      <Button onClick={run} disabled={busy} className="rounded-xl">
        {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Counting…</> : <><Coins className="w-4 h-4 mr-2" /> Count My Money</>}
      </Button>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      {result && (
        <div className="mt-4 space-y-3 text-sm">
          {/* Overall summary */}
          {noConnections ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-stone-700 font-medium">Nothing is on yet.</p>
              <p className="text-xs text-stone-500 mt-1">Turn on a fundraising platform in Connections to see your totals here.</p>
            </div>
          ) : (
            <>
              {/* Withdrawable — the number users actually care about */}
              <div className={`rounded-xl border p-3 ${withdrawable > 0 ? "border-emerald-200 bg-emerald-50" : "border-stone-200 bg-stone-50"}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Available in Interplanetary Fund</p>
                <p className="text-2xl font-bold text-stone-900 mt-1">${withdrawable.toLocaleString()}</p>
                <p className="text-xs text-stone-500 mt-0.5">Verified, settled funds you can withdraw.</p>
              </div>

              {/* External observed — clearly labeled as informational */}
              {externalObserved > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Observed on External Platforms</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">${externalObserved.toLocaleString()}</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Informational only. These funds are held by external platforms and are <strong>not</strong> withdrawable from Interplanetary Fund until a verified transfer is completed.
                  </p>
                </div>
              )}

              {/* Per-provider breakdown */}
              {providerResults.map((r, i) => {
                const cls = classifySource(r);
                const Icon = cls.icon;
                return (
                  <div key={i} className={`flex items-start gap-2 rounded-lg border border-stone-200 p-2 ${cls.bg}`}>
                    <Icon className={`w-4 h-4 ${cls.color} shrink-0 mt-0.5`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-stone-800 capitalize">{r.provider}</p>
                        <span className={`text-xs font-medium ${cls.color}`}>{cls.label}</span>
                      </div>
                      {r.amount_discovered > 0 ? (
                        <p className="text-xs text-stone-600">
                          ${r.amount_discovered.toLocaleString()} {r.currency !== "UNSPECIFIED" ? r.currency : ""} observed
                          {r.withdrawable_imported > 0 && <span className="text-emerald-600 font-medium"> · ${r.withdrawable_imported.toLocaleString()} imported</span>}
                        </p>
                      ) : (
                        <p className="text-xs text-stone-500">No new transactions found</p>
                      )}
                      {r.note && <p className="text-xs text-stone-500 mt-0.5">{r.note}</p>}
                      {r.error && <p className="text-xs text-red-500 mt-0.5">{r.error}</p>}
                    </div>
                  </div>
                );
              })}

              {/* Summary counts */}
              {(liveSources.length > 0 || informationalSources.length > 0 || errorSources.length > 0) && (
                <p className="text-xs text-stone-500 pt-1">
                  {liveSources.length > 0 && `${liveSources.length} live · `}
                  {informationalSources.length > 0 && `${informationalSources.length} informational · `}
                  {errorSources.length > 0 && `${errorSources.length} need attention · `}
                  {manualSources.length > 0 && `${manualSources.length} manual`}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}