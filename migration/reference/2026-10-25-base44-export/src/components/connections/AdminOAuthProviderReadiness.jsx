import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

// This inventory shows IFund administrators which *personal account sign-in*
// routes still need a Base44 workspace OAuth registration. Shared platform
// integrations never count as app-user sign-in readiness.
export default function AdminOAuthProviderReadiness() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("adminOAuthProviderReadiness", {});
      if (data?.status !== "configuration_inventory" || !Array.isArray(data.entries)) {
        throw new Error("Invalid connection setup report");
      }
      setReport(data);
    } catch {
      setReport(null);
      setError("IFund could not check account sign-in setup. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <section aria-label="Admin provider sign-in setup" className="mb-7 rounded-2xl border border-border bg-card p-4 sm:p-5 text-foreground">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-semibold text-lg">Admin: Account sign-in setup</h2>
        <p className="mt-1 text-sm text-muted-foreground">Shows which outside platforms IFund has prepared for members to authorize their own accounts.</p>
      </div>
      <Button size="sm" variant="outline" type="button" disabled={loading} onClick={refresh} className="shrink-0 min-h-10">
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />} Refresh
      </Button>
    </div>
    {error && <p className="mt-3 text-sm text-amber-700 dark:text-amber-300" role="alert">{error}</p>}
    {loading && !report && <p className="mt-3 text-sm text-muted-foreground" role="status">Checking platform setup…</p>}
    {report && <>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm" role="status" aria-live="polite">
        {report.missing ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
        <strong>{report.registration_references_present}/{report.expected}</strong>
        <span>registration references saved</span>
        {report.missing > 0 && <span className="text-amber-700 dark:text-amber-300">· {report.missing} need setup</span>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        This only checks whether a provider registration reference exists. Each member must still approve provider sign-in, and IFund must verify the connection before it displays Connected.
      </p>
      <details className="mt-3 rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold">View platform setup requirements</summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Register each app-user OAuth connector in Base44 Workspace Settings → Integrations → Connectors, with the provider's own credentials and redirect URLs. Save its connector ID to the indicated IFund backend secret. Do not use IFund's shared business account for member connections.
        </p>
        <div className="mt-3 space-y-2 max-h-64 overflow-y-auto overscroll-contain">
          {report.entries.map(entry => <div key={entry.env_key} className="rounded-lg border border-border bg-background/50 px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="capitalize font-medium">{entry.platforms[0].replace(/_/g, " ")}</span>
              <span className={entry.registration_reference_present ? "text-emerald-700 dark:text-emerald-300 text-xs" : "text-amber-700 dark:text-amber-300 text-xs"}>
                {entry.registration_reference_present ? "Reference present; unverified" : "Needs registration"}
              </span>
            </div>
            {!entry.registration_reference_present && <code className="block mt-1 text-[11px] break-all text-muted-foreground">{entry.env_key}</code>}
          </div>)}
        </div>
      </details>
    </>}
  </section>;
}
