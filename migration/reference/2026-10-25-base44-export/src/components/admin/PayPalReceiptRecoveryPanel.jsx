import React, { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCcw, WalletCards } from "lucide-react";
import { getFrontendIdentity } from "@/lib/adminBootstrap";

export default function PayPalReceiptRecoveryPanel({ user }) {
  const superAdmin = getFrontendIdentity(user).superAdminOwner;
  const [receipts, setReceipts] = useState([]);
  const [lookbackDays, setLookbackDays] = useState(30);
  const [scanned, setScanned] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [otherSettledPayments, setOtherSettledPayments] = useState(0);
  const [otherPayments, setOtherPayments] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selection, setSelection] = useState({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!superAdmin) return;
    setLoading(true);
    setError("");
    setMessage("");
    setScanned(false);
    try {
      const [receiptResponse, campaignRows] = await Promise.all([
        base44.functions.invoke("listUntrackedPayPalReceipts", { lookback_days: lookbackDays }),
        base44.entities.Campaign.list("-created_date", 300),
      ]);
      const data = receiptResponse?.data || {};
      if (data.ok !== true || !Array.isArray(data.receipts)) {
        throw new Error("PayPal scan did not confirm a complete result");
      }
      const rows = data.receipts.filter((row) => row.tracked !== true);
      setReceipts(rows);
      setScannedCount(Number(data.checked_transactions) || 0);
      setOtherSettledPayments(Number(data.other_settled_payment_count) || 0);
      setOtherPayments(Array.isArray(data.other_payments) ? data.other_payments : []);
      setScanned(true);
      setSelection((current) => ({
        ...current,
        ...Object.fromEntries(rows.filter((row) => row.repair_required && row.allocation_campaign_id).map((row) => [row.transaction_id, row.allocation_campaign_id])),
      }));
      setCampaigns(Array.isArray(campaignRows) ? campaignRows : []);
    } catch (e) {
      console.error("PayPal receipt recovery load failed:", e?.name || "UnknownError");
      setReceipts([]);
      setOtherPayments([]);
      setError("PayPal could not confirm the receipt scan. No conclusion about missing donations can be drawn; please retry when the business account is available.");
    } finally {
      setLoading(false);
    }
  }, [superAdmin, lookbackDays]);

  useEffect(() => { load(); }, [load]);

  if (!superAdmin) return null;

  const recover = async (receipt) => {
    const campaignId = selection[receipt.transaction_id];
    if (!campaignId || busy) return;
    setBusy(receipt.transaction_id);
    setError("");
    setMessage("");
    try {
      const response = receipt.recovery_method === "ifund_checkout_order"
        ? await base44.functions.invoke("capturePayPalOrder", {
            reconcile_only: true,
            order_id: receipt.paypal_order_id,
            paypal_transaction_id: receipt.transaction_id,
            campaign_id: campaignId,
          })
        : await base44.functions.invoke("reconcileDirectPayPalCampaignDonation", {
            paypal_transaction_id: receipt.transaction_id,
            campaign_id: campaignId,
          });
      const data = response?.data || {};
      if (data.ok !== true) throw new Error("Recovery rejected");
      setReceipts((current) => current.filter((row) => row.transaction_id !== receipt.transaction_id));
      const confirmedGift = Number(data.campaign_gift ?? data.campaign_amount ?? data.amount);
      const amountLabel = Number.isFinite(confirmedGift) && confirmedGift > 0
        ? `$${confirmedGift.toFixed(2)}`
        : "the verified PayPal receipt";
      setMessage(data.duplicate
        ? "That PayPal receipt was already safely allocated."
        : data.repaired
          ? `Repaired the incomplete allocation for ${amountLabel}.`
          : `Recovered ${amountLabel} to the selected campaign.`);
    } catch (e) {
      console.error("PayPal receipt recovery failed:", e?.name || "UnknownError");
      setError("That receipt could not be assigned safely. It was left unchanged.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl text-slate-950">
            <WalletCards className="w-5 h-5 text-cyan-700" /> Untracked PayPal receipts
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-700">
            Find missing PayPal donations and completed IFund checkout payments. Select the campaign the provider receipt belongs to; checkout recovery independently checks the original PayPal order and capture. No new payment is created.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="paypal-recovery-range" className="text-xs font-semibold text-slate-700">Review period</label>
          <select id="paypal-recovery-range" className="min-h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950"
            value={lookbackDays} disabled={loading || !!busy}
            onChange={event => setLookbackDays(Number(event.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Button variant="outline" onClick={load} disabled={loading || !!busy} className="rounded-xl">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
            Scan PayPal
          </Button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      {!error && scanned && !loading && (
        <p role="status" className="mt-3 text-xs text-slate-600">
          Scan complete: {scannedCount} provider transaction{scannedCount === 1 ? "" : "s"} reviewed across {lookbackDays} days.
          Only verified settled donation receipts can be allocated.
          {otherSettledPayments > 0 && (
            <span className="block mt-1 text-amber-800">
              {otherSettledPayments} other settled PayPal payment{otherSettledPayments === 1 ? "" : "s"} found.
              These may require manual payment-channel investigation and are not automatically credited to campaigns.
            </span>
          )}
        </p>
      )}
      {loading ? (
        <div className="py-8 flex items-center justify-center text-sm text-slate-600">
          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking settled donation receipts…
        </div>
      ) : error ? (
        <p className="py-4 text-sm text-slate-600">The scan did not complete. Please retry to check provider receipts.</p>
      ) : receipts.length === 0 ? (
        <p className="py-6 text-sm text-slate-600">No untracked settled PayPal donation receipts matching the supported recovery criteria were found during this {lookbackDays}-day scan.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {receipts.map((receipt) => (
            <div key={receipt.transaction_id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">
                    ${Number(receipt.gross_amount || 0).toFixed(2)} PayPal donation
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      → ${Number(receipt.recoverable_amount || 0).toFixed(2)} campaign value
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500 break-all">
                    {receipt.occurred_at ? new Date(receipt.occurred_at).toLocaleString() : "Date unavailable"} · PayPal fee ${Number(receipt.fee_amount || 0).toFixed(2)} · {receipt.transaction_id}
                  </p>
                  {receipt.recovery_method === "ifund_checkout_order" && (
                    <p className="mt-1 text-xs font-medium text-blue-800">
                      Completed PayPal checkout payment. Verify the original IFund order and capture before restoring campaign credit. No new payment is made.
                    </p>
                  )}
                  {(receipt.subject || receipt.note) && (
                    <p className="mt-1 text-xs text-slate-600">{receipt.subject || receipt.note}</p>
                  )}
                  {receipt.repair_required && !receipt.allocation_conflict && <p className="mt-1 text-xs font-medium text-amber-700">Incomplete local allocation found. Recovery will repair its missing records.</p>}
                  {receipt.allocation_conflict && <p className="mt-1 text-xs font-medium text-red-700">Conflicting campaign allocations require manual financial review.</p>}
                </div>
                <select
                  aria-label="Campaign for PayPal receipt"
                  value={selection[receipt.transaction_id] || ""}
                  onChange={(event) => setSelection((current) => ({ ...current, [receipt.transaction_id]: event.target.value }))}
                  disabled={receipt.allocation_conflict || !!receipt.allocation_campaign_id}
                  className="min-h-10 min-w-0 lg:w-72 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
                >
                  <option value="">Choose campaign…</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.title || "Untitled campaign"}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={() => recover(receipt)}
                  disabled={receipt.allocation_conflict || !selection[receipt.transaction_id] || !!busy}
                  className="rounded-xl shrink-0"
                >
                  {busy === receipt.transaction_id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  {receipt.recovery_method === "ifund_checkout_order"
                    ? "Verify & restore payment"
                    : receipt.repair_required ? "Repair allocation" : "Add to campaign"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && !error && otherPayments.length > 0 && (
        <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-amber-900">
            {otherPayments.length} other settled merchant payment{otherPayments.length === 1 ? "" : "s"} — review only
          </summary>
          <p className="mt-2 text-xs text-amber-900">
            These may be sales, subscriptions, or donations made through unrelated links.
            They cannot be credited to a campaign without independent provider evidence.
          </p>
          <div className="mt-3 space-y-2">
            {otherPayments.map((payment) => (
              <div key={payment.transaction_id} className="rounded-lg border border-amber-200 bg-white p-3 text-xs text-slate-800">
                <span className="font-semibold">{"$" + Number(payment.gross_amount || 0).toFixed(2)}</span>
                <span className="ml-2">Type: {payment.transaction_event_code || "Unknown"}</span>
                <p className="mt-1 break-all text-slate-600">
                  {payment.transaction_id} · {payment.occurred_at ? new Date(payment.occurred_at).toLocaleString() : "Date unavailable"}
                </p>
                {payment.subject && <p className="mt-1 break-words text-slate-600">{payment.subject}</p>}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
