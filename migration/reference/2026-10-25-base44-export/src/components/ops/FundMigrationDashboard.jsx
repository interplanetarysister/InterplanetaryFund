import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRightLeft, Plus, X, CheckCircle2, AlertCircle } from "lucide-react";

const fmt = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyEntry = () => ({ campaignId: "", campaignTitle: "", sourcePlatform: "GoFundMe", grossAmount: "" });

// Fund Migration Dashboard — records admin-attested external amounts for
// reconciliation. It never chooses a payout destination or represents an
// external balance as IFund-held money. The campaign owner withdraws only after
// a verified settlement reaches the IFund holding account.
export default function FundMigrationDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [pending, setPending] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [campaignSearch, setCampaignSearch] = useState("");

  const [step, setStep] = useState("entries"); // entries | confirm | result
  const [migrations, setMigrations] = useState([emptyEntry()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [reconciling, setReconciling] = useState(false);
  const [reconcileResult, setReconcileResult] = useState(null);

  // An admin click launches one bounded, auditable all-campaign observation.
  // This is not permission for scheduled, agent, or background synchronization.
  const reconcile = async () => {
    setReconciling(true);
    setReconcileResult(null);
    try {
      const { data } = await base44.functions.invoke("syncExternalFunds", { scope: "all", initiator_type: "admin", request_id: crypto.randomUUID() });
      setReconcileResult(data);
      const c = await base44.entities.Campaign.list("-raised_amount", 100);
      setCampaigns(c || []);
    } catch (e) {
      setReconcileResult({ error: "Reconciliation failed. Please try again." });
    }
    setReconciling(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        if (me?.role !== "admin") {
          setError("Admin access required.");
          setLoadingCampaigns(false);
          return;
        }

        const [c, w] = await Promise.all([
          base44.entities.Campaign.list("-raised_amount", 100),
          base44.entities.ExternalFundMigrationRecord.filter({ state: "recorded" }),
        ]);
        setCampaigns(c || []);
        setPending(w || []);
      } catch (e) {
        setError("Unable to load migration data.");
      } finally {
        setLoadingCampaigns(false);
      }
    })();
  }, []);

  const addRow = () => setMigrations((m) => [...m, emptyEntry()]);
  const removeRow = (i) => setMigrations((m) => m.filter((_, idx) => idx !== i));
  const updateRow = (i, field, value) => {
    setMigrations((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === "campaignId") {
        const camp = campaigns.find((c) => c.id === value);
        if (camp) next[i].campaignTitle = camp.title;
      }
      return next;
    });
  };

  const visibleCampaigns = campaigns.filter((c) => {
    const q = campaignSearch.trim().toLowerCase();
    if (!q) return true;
    return `${c.title || ""} ${c.id || ""}`.toLowerCase().includes(q);
  });

  const billable = migrations.filter((m) => parseFloat(m.grossAmount) > 0);
  const totalGross = billable.reduce((s, m) => s + (parseFloat(m.grossAmount) || 0), 0);
  // Approved Interplanetary Fund fee is 3% (not 5%). Processing fees are covered
  // by Interplanetary Fund and shown for transparency only — never deducted from
  // the recipient's net, matching the approved fee policy.
  const totalPlatformFee = totalGross * 0.03;
  const totalNet = totalGross - totalPlatformFee;

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const valid = migrations.filter(
        (m) => m.campaignId && m.campaignTitle && m.sourcePlatform && parseFloat(m.grossAmount) > 0
      );
      if (!valid.length) { setError("Fill in at least one migration entry."); setSubmitting(false); return; }

      // Record each migration through the authenticated server boundary. A migration
      // remains under review until independently reconciled; the UI never marks a
      // provider payout paid merely because an admin entered an amount.
      const created = [];
      for (const m of valid) {
        const requestId = crypto.randomUUID();
        const { data } = await base44.functions.invoke("recordExternalFundMigration", {
          campaign_id: m.campaignId,
          source_platform: m.sourcePlatform,
          gross_amount: Number(m.grossAmount),
          request_id: requestId,
        });
        if (data?.ok !== true) throw new Error("Migration could not be recorded safely.");
        created.push(data);
      }
      setResult({ created: created.length, totalGross, totalNet });
      setStep("result");
    } catch (e) {
      setError("Migration failed. Please try again.");
    }
    setSubmitting(false);
  };

  if (step === "result") {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
        <p className="font-display text-lg text-slate-100 mb-1">Migration queued for reconciliation</p>
        <p className="text-sm text-slate-400">
          {result.created} reconciliation record{result.created !== 1 ? "s" : ""} created ·{" "}
          {fmt(result.totalGross)} reported · prospective net {fmt(result.totalNet)} only if later verified, settled, and withdrawn
        </p>
        <Button
          variant="ghost"
          className="mt-5 text-cyan-400 hover:text-cyan-300"
          onClick={() => { setStep("entries"); setMigrations([emptyEntry()]); setResult(null); }}
        >
          New migration
        </Button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">Review reconciliation record</h3>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm">
          {migrations.filter((m) => parseFloat(m.grossAmount) > 0).map((m, i) => (
            <div key={i} className="flex justify-between text-slate-300">
              <span>{m.campaignTitle || m.campaignId} · {m.sourcePlatform}</span>
              <span className="font-semibold">{fmt(parseFloat(m.grossAmount))}</span>
            </div>
          ))}
          <div className="pt-2 border-t border-white/10 space-y-1">
            <div className="flex justify-between text-xs text-slate-400"><span>Interplanetary Fund fee (3%)</span><span>− {fmt(totalPlatformFee)}</span></div>
            <div className="flex justify-between font-bold text-slate-100"><span>Net to owner</span><span>{fmt(totalNet)}</span></div>
          </div>
          <div className="pt-2 border-t border-white/10 text-xs text-slate-400">
            Reconciliation record only. No payout destination is stored or selected here. The campaign owner uses the normal withdrawal flow after IFund independently verifies settlement.
          </div>
        </div>
        {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 text-slate-400" onClick={() => setStep("entries")} disabled={submitting}>Back</Button>
          <Button className="flex-1 bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Queue for reconciliation"}
          </Button>
        </div>
      </div>
    );
  }

  // Step: entries
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4 text-cyan-400" /> Fund Migration
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Record an external amount → independently reconcile it → only verified settled funds enter IFund custody
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={reconcile} disabled={reconciling} className="rounded-lg border-white/10 text-slate-200 shrink-0">
          {reconciling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />} Sync Linked Platforms
        </Button>
      </div>
      {reconcileResult && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs">
          {reconcileResult.error ? <p className="text-rose-400">{reconcileResult.error}</p> : (
            <p className="text-slate-300">Reconciled {reconcileResult.campaigns_covered} campaigns · discovered ${((reconcileResult.total_discovered) || 0).toLocaleString()} · status {reconcileResult.overall_status}</p>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
          <p className="text-xs font-semibold text-amber-300">
            {pending.length} external reconciliation record{pending.length > 1 ? "s" : ""} awaiting independent matching
          </p>
        </div>
      )}

      {loadingCampaigns ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-cyan-400 animate-spin" /></div>
      ) : (
        <>
          {migrations.map((m, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300">External record #{i + 1}</span>
                {migrations.length > 1 && (
                  <button onClick={() => removeRow(i)} className="text-rose-400 hover:text-rose-300 p-1">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <input
                type="search"
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                placeholder="Search campaigns…"
                className="w-full rounded-lg bg-black/30 border border-white/10 text-slate-200 px-3 py-2 text-sm placeholder:text-slate-600"
              />
              <select
                value={m.campaignId}
                onChange={(e) => updateRow(i, "campaignId", e.target.value)}
                className="w-full rounded-lg bg-black/30 border border-white/10 text-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select campaign…</option>
                {visibleCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
              <select
                value={m.sourcePlatform}
                onChange={(e) => updateRow(i, "sourcePlatform", e.target.value)}
                className="w-full rounded-lg bg-black/30 border border-white/10 text-slate-200 px-3 py-2 text-sm"
              >
                {["GoFundMe", "Kickstarter", "Indiegogo", "Facebook", "GiveSendGo", "CashApp", "PayPal", "Other"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Gross amount"
                  value={m.grossAmount}
                  onChange={(e) => updateRow(i, "grossAmount", e.target.value)}
                  className="flex-1 rounded-lg bg-black/30 border border-white/10 text-slate-200 px-3 py-2 text-sm placeholder:text-slate-600"
                />
              </div>
              {parseFloat(m.grossAmount) > 0 && (
                <p className="text-[11px] text-slate-500">
                  Prospective net ≈ {fmt(parseFloat(m.grossAmount) * 0.97)} after the 3% IFund withdrawal fee, only if this amount later becomes verified settled funds.
                </p>
              )}
            </div>
          ))}

          <button
            onClick={addRow}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 py-1"
          >
            <Plus className="w-3 h-3" /> Add another withdrawal
          </button>

          {totalGross > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs space-y-1">
              <div className="flex justify-between text-slate-300"><span>Total gross</span><span className="font-semibold">{fmt(totalGross)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Interplanetary Fund fee (3%)</span><span>− {fmt(totalPlatformFee)}</span></div>
              <div className="flex justify-between text-emerald-400 font-bold"><span>Prospective net if later withdrawn</span><span>{fmt(totalNet)}</span></div>
            </div>
          )}

          {error && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}

          <Button
            className="w-full bg-cyan-400/20 border border-cyan-400/30 text-cyan-300 hover:bg-cyan-400/30 rounded-xl h-11"
            onClick={() => setStep("confirm")}
            disabled={totalGross <= 0}
          >
            Review reconciliation record →
          </Button>
        </>
      )}
    </div>
  );
}