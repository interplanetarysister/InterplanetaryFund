import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Wallet, ShieldCheck, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image } from "@/components/ui/image";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { useToast } from "@/components/ui/use-toast";
import WithdrawalDialog from "@/components/withdrawals/WithdrawalDialog";
import CollectAndWithdrawDialog from "@/components/withdrawals/CollectAndWithdrawDialog";
import { useSearchParams } from "react-router-dom";
import PageError from "@/components/PageError";

const CLEARING_DAYS = 7;
const money = (n) => (n || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

const STATUS_STYLE = {
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  under_review: "bg-amber-100 text-amber-700 border-amber-200",
  processing: "bg-cyan-100 text-cyan-700 border-cyan-200",
  failed: "bg-rose-100 text-rose-700 border-rose-200",
  pending: "bg-stone-100 text-stone-600 border-stone-200",
};

export default function Withdrawals() {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [history, setHistory] = useState([]);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [collectCampaign, setCollectCampaign] = useState(null);
  const [collectAll, setCollectAll] = useState(false);
  const [payoutEnabled, setPayoutEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // The open withdrawal sheet lives in the URL (?withdraw=<campaignId>) so the
  // Android back button dismisses it rather than leaving the page.
  const [searchParams, setSearchParams] = useSearchParams();
  const activeId = searchParams.get("withdraw");
  const setActive = (campaign) => {
    const params = new URLSearchParams(searchParams);
    if (campaign) { params.set("withdraw", campaign.id); setSearchParams(params); }
    else { params.delete("withdraw"); setSearchParams(params, { replace: true }); }
  };

  const load = async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const [availability, paymentCapabilities] = await Promise.all([
        base44.functions.invoke("getFeatureAvailability", {}).catch(() => ({ data: null })),
        base44.functions.invoke("getPaymentCapabilities", {}).catch(() => ({ data: null })),
      ]);
      setPayoutEnabled(availability?.data?.available?.outbound_payout_execution === true && paymentCapabilities?.data?.paypal?.payout_api_live === true);
      const owned = await base44.entities.Campaign.filter({ created_by_id: me.id });
      const enriched = [];
      for (const c of owned) {
        const balanceRes = await base44.functions.invoke("getCampaignWithdrawalBalance", { campaign_id: c.id });
        const balance = balanceRes?.data || {};
        enriched.push({
          ...c,
          available: Number(balance.available || 0),
          inClearing: Number(balance.in_clearing || 0),
          withdrawn: Number(balance.withdrawn || 0),
          ifundAvailable: Number(balance.ifund_donations_available || 0),
          externalSettledAvailable: Number(balance.external_settled_available || 0),
        });
      }
      setCampaigns(enriched);

      const w = await base44.entities.Withdrawal.filter({ owner_user_id: me.id });
      setHistory((w || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));

      if (me.role === "admin") {
        const rq = await base44.entities.Withdrawal.filter({ status: "under_review" });
        setReviewQueue(rq || []);
      }
    } catch (e) {
      console.error("Withdrawals load failed:", e?.name || "UnknownError");
      setError("We couldn't load your withdrawals. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try {
      const res = await base44.functions.invoke("requestWithdrawal", { action: "approve", withdrawal_id: id });
      if (res.data?.error) throw new Error("Server operation rejected");
      toast({ title: "Withdrawal approved & paid out" });
      load();
    } catch (e) {
      console.error("Withdrawal approval failed:", e?.name || "UnknownError");
      toast({ title: "Approval failed", description: "The payout could not be confirmed safely. Review the withdrawal status before retrying.", variant: "destructive" });
    }
  };

  if (error) {
    return <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setLoading(true); load(); }} /></div>;
  }
  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  const active = campaigns.find((c) => c.id === activeId) || null;
  const totalAvailable = campaigns.reduce((s, c) => s + c.available, 0);
  const totalClearing = campaigns.reduce((s, c) => s + c.inClearing, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-stone-900">Withdrawals</h1>
            <p className="text-sm text-stone-500">Withdraw IFund-held funds or collect supported balances from connected fundraising platforms into one withdrawal flow.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
            <p className="text-xs text-stone-500 uppercase tracking-wide">Available now</p>
            <p className="font-display text-2xl text-emerald-600">{money(totalAvailable)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
            <p className="text-xs text-stone-500 uppercase tracking-wide">In clearing (7-day hold)</p>
            <p className="font-display text-2xl text-amber-600">{money(totalClearing)}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-xs text-stone-600 bg-white rounded-xl border border-stone-200/70 p-3">
          <ShieldCheck className="w-4 h-4 mt-0.5 text-cyan-600 shrink-0" />
          <p>Fraud protection: a 7-day clearing hold on donations, one withdrawal per day without an active subscription, payouts only to the PayPal email you enter and confirm, and a 3% platform fee deducted at payout. Withdrawals over $1,000 get a manual review.</p>
        </div>
      </header>

      {!payoutEnabled && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">New payouts are temporarily paused while the live PayPal payout route is being verified. Your cleared balance remains recorded and reserved for you; no funds are lost.</div>}

      <div className="flex justify-end">
        <Button onClick={() => setCollectAll(true)} className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white">Collect & Withdraw everything</Button>
      </div>

      {/* Campaign balances */}
      <section className="space-y-3">
        <h2 className="font-display text-xl text-stone-900">Your campaigns</h2>
        {campaigns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
            You don't have any campaigns yet. Once supporters start giving, cleared funds will show up here.
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <Image src={c.cover_image_url || FALLBACK_IMAGE} alt={c.title} className="w-full sm:w-24 h-24 rounded-xl object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-stone-900 truncate">{c.title}</h3>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-stone-400">Available</p>
                      <p className="text-emerald-600 font-semibold">{money(c.available)}</p>
                      {c.externalSettledAvailable > 0 && <p className="text-[10px] text-cyan-600">Includes {money(c.externalSettledAvailable)} settled external funds</p>}
                    </div>
                    <div>
                      <p className="text-stone-400">In clearing</p>
                      <p className="text-amber-600 font-semibold">{money(c.inClearing)}</p>
                    </div>
                    <div>
                      <p className="text-stone-400">Withdrawn</p>
                      <p className="text-stone-700 font-semibold">{money(c.withdrawn)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:self-center">
                  <Button onClick={() => setCollectCampaign(c)} variant="outline" className="rounded-xl">Collect & Withdraw</Button>
                  <Button disabled={c.available <= 0 || !payoutEnabled} onClick={() => setActive(c)} className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0">
                    {!payoutEnabled ? "Payouts paused" : c.available > 0 ? `Withdraw ${money(c.available)}` : "No settled funds"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Admin review queue */}
      {user?.role === "admin" && reviewQueue.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h2 className="font-display text-xl text-stone-900">Review queue</h2>
          </div>
          <div className="space-y-2">
            {reviewQueue.map((w) => (
              <div key={w.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-stone-900">{money(w.net_amount)} → {w.paypal_email}</p>
                  <p className="text-xs text-stone-500">{w.campaign_title} · {fmtDate(w.created_date)}</p>
                  {w.review_note && <p className="text-xs text-amber-600 mt-1">{w.review_note}</p>}
                </div>
                <Button size="sm" disabled={!payoutEnabled} onClick={() => approve(w.id)} className="rounded-xl">{payoutEnabled ? "Approve & pay" : "Payouts paused"}</Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      <section className="space-y-3">
        <h2 className="font-display text-xl text-stone-900">Withdrawal history</h2>
        {history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-8 text-center text-stone-500">No withdrawals yet.</div>
        ) : (
          <div className="space-y-2">
            {history.map((w) => (
              <div key={w.id} className="bg-white rounded-xl border border-stone-200/70 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-stone-900 truncate">{w.campaign_title}</p>
                  <p className="text-xs text-stone-500">{fmtDate(w.created_date)} · {w.paypal_email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm text-emerald-600 font-medium">{money(w.net_amount)}</p>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_STYLE[w.status]}`}>{w.status.replace("_", " ")}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {collectAll && <CollectAndWithdrawDialog campaign={null} open={collectAll} onOpenChange={setCollectAll} />}
      {collectCampaign && <CollectAndWithdrawDialog campaign={collectCampaign} open={!!collectCampaign} onOpenChange={(o) => !o && setCollectCampaign(null)} />}

      {active && (
        <WithdrawalDialog
          campaign={active}
          open={!!active}
          onOpenChange={(o) => !o && setActive(null)}
          onDone={load}
        />
      )}
    </div>
  );
}