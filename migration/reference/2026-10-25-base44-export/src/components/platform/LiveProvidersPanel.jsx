import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Loader2, ExternalLink, ShieldAlert } from "lucide-react";

// Live readiness is returned from the server, not inferred from the UI,
// stored credentials, a user-supplied wallet, or an OAuth redirect.
const HELP = [
  { label: "Reown wallet connections", url: "https://dashboard.reown.com" },
  { label: "NOWPayments merchant setup", url: "https://nowpayments.io/api" },
];
const PROVIDER_NAMES = {
  paypal_checkout: "PayPal checkout",
  paypal_payouts: "PayPal withdrawals",
  nowpayments: "Crypto settlement provider",
  reown: "Crypto wallet connections",
  openai: "AI provider",
};
const STATE_LABELS = {
  ready_off: "Ready, switched off",
  live_enabled: "Enabled and provider verified",
  switch_missing: "Switch not set up",
  setup_needed: "Provider needs setup",
  not_implemented: "Not yet connected to a live backend",
  configuration_conflict: "Existing switch needs scope or duplicate repair",
};
export default function LiveProvidersPanel() {
  const [snapshot, setSnapshot] = useState(null);
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await base44.functions.invoke("getLiveProviderStatus", {});
      if (data?.ok !== true || !Array.isArray(data.features)) throw new Error("Invalid readiness");
      setSnapshot(data);
    } catch { setError("Live provider checks are unavailable. No settings have changed."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const createSwitch = async (feature) => {
    if (!feature.scope) return;
    setBusy(feature.key); setError("");
    try {
      const { data } = await base44.functions.invoke("manageFeatureFlag", {
        key: feature.key, label: feature.label, scope: feature.scope,
        description: "Administrator controlled live feature; provider verification required before enabling.",
      });
      if (!data?.flag?.id) throw new Error("Switch creation failed");
      await refresh();
    } catch { setError("Could not add the switch. Check the existing configuration."); }
    finally { setBusy(""); }
  };
  const toggle = async (feature, enabled) => {
    if (enabled && !feature.provider_ready) return;
    if (enabled && ["payment_checkout_enabled", "public_campaign_fundraising", "outbound_payout_execution"].includes(feature.key)
      && !window.confirm("Live money can move when this is enabled. Confirm verified test donations, account ownership, reconciliation, and authorized payouts before continuing.")) return;
    setBusy(feature.key); setError("");
    try {
      const { data } = await base44.functions.invoke("manageFeatureFlag", { id: feature.flag_id, enabled });
      if (data?.flag?.enabled !== enabled) throw new Error(data?.detail || "Backend rejected this change");
      window.dispatchEvent(new Event("ifund:fundraising-mode-changed"));
      await refresh();
    } catch { setError("The server did not accept the new live setting. The prior switch state is unchanged."); }
    finally { setBusy(""); }
  };

  return <div className="space-y-5">
    <div className="bg-white rounded-2xl border border-stone-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl text-stone-900">Live features and providers</h2>
          <p className="text-xs text-stone-600 mt-1">Connected means verified working. An admin switch cannot bypass missing provider approval or transaction verification.</p>
        </div>
        <Button type="button" variant="outline" onClick={refresh} disabled={loading || !!busy} className="rounded-xl">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />} Refresh
        </Button>
      </div>
      {snapshot?.checked_at && <p className="text-[11px] text-stone-500 mt-2">Checked {new Date(snapshot.checked_at).toLocaleString()}</p>}
      {error && <p role="alert" className="text-sm text-red-700 mt-3">{error}</p>}
    </div>
    {snapshot && <section className="bg-white border border-stone-200 rounded-2xl p-5 space-y-3">
      <h3 className="font-semibold text-stone-900">Verified provider routes</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {Object.entries(snapshot.providers || {}).filter(([key]) => key !== "stripe_checkout").map(([key, status]) =>
          <div key={key} className="rounded-xl border border-stone-200 p-3">
            <div className="flex justify-between items-center gap-3">
              <p className="text-sm font-medium text-stone-900">{PROVIDER_NAMES[key] || key}</p>
              <span className={status.ready ? "text-xs font-semibold text-emerald-700" : "text-xs font-semibold text-amber-800"}>{status.ready ? "Verified" : "Setup needed"}</span>
            </div>
            <p className="text-xs text-stone-600 mt-1">{status.explanation}</p>
          </div>)}
      </div>
      <p className="text-xs text-stone-600">Provider setup and verification links:</p>
      <div className="flex gap-3 flex-wrap">
        {HELP.map(item => <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-700 underline">{item.label}<ExternalLink className="w-3 h-3" /></a>)}
        <a href="/admin/integrations" className="text-xs text-blue-700 underline">IFund integration health</a>
      </div>
    </section>}
    {snapshot?.connections?.length > 0 && <details className="bg-white border border-stone-200 rounded-2xl p-4">
      <summary className="text-sm font-semibold text-stone-900 cursor-pointer">Connected account diagnostics ({snapshot.connections.length})</summary>
      <p className="text-xs text-stone-600 mt-2">OAuth configuration is not proof that a provider action works. Run integration health checks in the IFund admin console.</p>
      <div className="divide-y divide-stone-100 mt-2 max-h-72 overflow-y-auto">{snapshot.connections.map((r, i) => <div key={`${r.platform}-${i}`} className="flex justify-between gap-3 py-2 text-xs"><span className="text-stone-800">{r.platform}</span><span className={r.live_verified ? "text-emerald-700" : "text-amber-800"}>{r.live_verified ? "Verified" : r.state === "ACTIVE" ? "Recheck required" : r.state}</span></div>)}</div>
    </details>}
    {snapshot && <section className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100">
      <div className="p-5">
        <h3 className="font-semibold text-stone-900">Administrator live switches</h3>
        <p className="text-xs text-stone-600 mt-1">Unavailable routes stay locked. Existing payment reconciliation and account access always remain on.</p>
      </div>
      {(snapshot.features || []).filter(f => f.key !== "stripe_checkout" && f.key !== "recurring_donations").map(f => <div key={f.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-900">{f.label}</p>
          <p className="text-xs text-stone-600 mt-1">{f.detail}</p>
          <p className="text-[11px] text-stone-500 mt-1">{STATE_LABELS[f.state] || f.state}</p>
        </div>
        {f.flag_id && f.code_connected
          ? <Switch checked={f.enabled} onCheckedChange={v => toggle(f, v)}
              disabled={!!busy || (loading && !snapshot) || (!f.provider_ready && !f.enabled)}
              aria-label={`Live ${f.label}`} />
          : !f.flag_id && f.code_connected && f.state === "switch_missing"
            ? <Button size="sm" variant="outline" disabled={!!busy || loading} onClick={() => createSwitch(f)}>
                {busy === f.key ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add off switch"}
              </Button>
            : <span className="text-xs text-stone-500 inline-flex items-center gap-1"><ShieldAlert className="w-4 h-4" /> Locked</span>}
      </div>)}
    </section>}
    {!snapshot && loading && <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>}
  </div>;
}
