import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, ShieldAlert, CheckCircle2, XCircle, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";

const money = (n) => `$${(n || 0).toFixed(2)}`;

// Fraud Control Panel — admin only
// Approve/deny canonical pending-review withdrawals; pause/unpause campaigns.
// Admin-attested external migration records have no reservation/payout destination
// and are intentionally excluded from this payout-action queue.
export default function FraudControlPanel() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [denyTarget, setDenyTarget] = useState(null);
  const [denyReason, setDenyReason] = useState("");
  const [freezeTarget, setFreezeTarget] = useState(null);
  const [freezeReason, setFreezeReason] = useState("");

  const load = async () => {
    const [w, c] = await Promise.all([
      base44.entities.Withdrawal.filter({ status: "under_review" }),
      base44.entities.Campaign.filter({ status: "paused" }),
    ]);
    setWithdrawals((w || []).filter((row) => !!row.canonical_reservation_id && !!row.paypal_email));
    setCampaigns(c || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const msg = (ok, text) => {
    if (ok) { setSuccess(text); setError(""); }
    else { setError(text); setSuccess(""); }
  };

  const approve = async (w) => {
    try {
      const { data } = await base44.functions.invoke("requestWithdrawal", { action: "approve", withdrawal_id: w.id });
      if (data?.ok !== true || !["paid", "reconciliation_pending", "provider_status_unknown"].includes(data?.status)) throw new Error("approval not confirmed");
      msg(true, data.status === "paid" ? `Approved — ${money(w.net_amount)} payout confirmed paid.` : "Payout submitted; provider reconciliation is still required.");
      load();
    } catch (e) { console.error("Fraud control approval failed:", e?.name || "UnknownError"); msg(false, "Approval could not be completed safely."); }
  };

  const deny = async (w) => {
    if (!denyReason) { msg(false, "Reason required to deny payout."); return; }
    try {
      const { data } = await base44.functions.invoke("requestWithdrawal", { action: "release_reservation", withdrawal_id: w.id, confirm_not_paid: true, admin_note: denyReason });
      if (data?.ok !== true || data?.status !== "cancelled") throw new Error("release not confirmed");
      msg(true, "Payout denied. The canonical reservation was released.");
      setDenyTarget(null);
      setDenyReason("");
      load();
    } catch (e) { console.error("Payout denial failed:", e?.name || "UnknownError"); msg(false, "Denial could not be completed safely; funds remain reserved until confirmed otherwise."); }
  };

  const unfreeze = async (c) => {
    try {
      const { data } = await base44.functions.invoke("adminCampaignControl", { action: "restore", campaign_id: c.id });
      if (data?.ok !== true || data?.status !== "active") throw new Error("restore not confirmed");
      msg(true, `Campaign "${c.title}" restored to active.`);
      load();
    } catch (e) { console.error("Campaign restore failed:", e?.name || "UnknownError"); msg(false, "Campaign restore failed safely; no change was confirmed."); }
  };

  const freeze = async (campaignId, title) => {
    if (!freezeReason) { msg(false, "Reason required to pause campaign."); return; }
    try {
      const { data } = await base44.functions.invoke("adminCampaignControl", { action: "pause", campaign_id: campaignId, reason: freezeReason });
      if (data?.ok !== true || data?.status !== "paused") throw new Error("pause not confirmed");
      msg(true, `Campaign "${title}" paused.`);
      setFreezeTarget(null);
      setFreezeReason("");
      load();
    } catch (e) { console.error("Campaign pause failed:", e?.name || "UnknownError"); msg(false, "Campaign pause failed safely; no change was confirmed."); }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-rose-500" />
        <h2 className="font-display text-xl text-stone-900">Fraud Control</h2>
      </div>

      {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{error}</p>}
      {success && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">{success}</p>}

      {/* Payout Review Queue */}
      <section>
        <h3 className="font-medium text-stone-800 mb-3">Payout Review Queue ({withdrawals.length})</h3>
        {withdrawals.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-400 text-sm">
            No withdrawals pending review.
          </div>
        ) : (
          <div className="space-y-3">
            {withdrawals.map((w) => (
              <div key={w.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-stone-900">{money(w.gross_amount)} gross → <span className="text-emerald-700 font-semibold">{money(w.net_amount)} net</span></p>
                    <p className="text-xs text-stone-500 mt-0.5">{w.campaign_title || w.campaign_id} · {w.paypal_email}</p>
                    {w.review_note && <p className="text-xs text-amber-600 mt-1">{w.review_note}</p>}
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold uppercase">Under Review</span>
                </div>

                {denyTarget !== w.id ? (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" variant="ghost" onClick={() => approve(w)}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Approve
                    </Button>
                    <Button size="sm" className="flex-1 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100" variant="ghost" onClick={() => setDenyTarget(w.id)}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Deny
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <input
                      type="text"
                      placeholder="Reason for denial (required)"
                      value={denyReason}
                      onChange={(e) => setDenyReason(e.target.value)}
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" className="flex-1 text-stone-500" onClick={() => { setDenyTarget(null); setDenyReason(""); }}>Cancel</Button>
                      <Button size="sm" className="flex-1 bg-rose-600 text-white hover:bg-rose-700" onClick={() => deny(w)} disabled={!denyReason}>Confirm Denial</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Paused / Frozen Campaigns */}
      <section>
        <h3 className="font-medium text-stone-800 mb-3">Paused Campaigns ({campaigns.length})</h3>
        {campaigns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-400 text-sm">
            No campaigns paused.
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-stone-900">{c.title}</p>
                  <p className="text-xs text-stone-500">Raised: {money(c.raised_amount)}</p>
                </div>
                <Button size="sm" variant="ghost" className="bg-emerald-50 text-emerald-700 border border-emerald-200" onClick={() => unfreeze(c)}>
                  <Unlock className="w-3.5 h-3.5 mr-1" /> Restore
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Freeze a campaign by ID */}
      <section className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
        <h3 className="font-medium text-stone-800 mb-3 flex items-center gap-2">
          <Lock className="w-4 h-4 text-rose-500" /> Pause a Campaign
        </h3>
        {freezeTarget === null ? (
          <Button variant="ghost" size="sm" className="text-rose-600 border border-rose-200 bg-rose-50" onClick={() => setFreezeTarget("")}>
            Enter campaign ID to pause…
          </Button>
        ) : (
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Campaign ID"
              value={freezeTarget}
              onChange={(e) => setFreezeTarget(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-rose-300"
            />
            <input
              type="text"
              placeholder="Reason for pause (required)"
              value={freezeReason}
              onChange={(e) => setFreezeReason(e.target.value)}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-800 outline-none focus:ring-2 focus:ring-rose-300"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1 text-stone-500" onClick={() => { setFreezeTarget(null); setFreezeReason(""); }}>Cancel</Button>
              <Button size="sm" className="flex-1 bg-rose-600 text-white hover:bg-rose-700" disabled={!freezeTarget || !freezeReason} onClick={() => freeze(freezeTarget, freezeTarget)}>
                Pause Campaign
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
