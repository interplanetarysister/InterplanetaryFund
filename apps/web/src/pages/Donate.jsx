import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CircleCheck, HandHeart, ShieldCheck, TrendingUp } from "lucide-react";
import { getCampaignDetail } from "@/api/publicData";
import CampaignDonationDialog from "@/components/payments/CampaignDonationDialog";
import PlatformSupportDonationDialog from "@/components/payments/PlatformSupportDonationDialog";
import { DONATE_TABS, tabFromParam, donateModeFromParams } from "@/lib/donatePage.mjs";

// Sprint 7 (2026-11-25): standalone Donate / Checkout page (40-page list,
// page 31). This page is an ADDITIONAL destination, not a replacement:
// Campaign Detail keeps its embedded Donate button and donation summary
// exactly as they are. All money movement reuses the existing PayPal
// infrastructure — CampaignDonationDialog (3-field hosted Card Fields:
// number, expiry, CVV only) and PlatformSupportDonationDialog — backed by
// PayPal Orders v2 and the signed ledger. No new payment engine, no new
// provider, no simulated payment. The Invest tab is informational only:
// no investment is offered through this page and no returns are guaranteed.
export default function Donate() {
  const [params, setParams] = useSearchParams();
  const tab = tabFromParam(params.get("tab"));
  const mode = donateModeFromParams(params);
  const [campaign, setCampaign] = useState(null);
  const [campaignPhase, setCampaignPhase] = useState("idle");
  const [campaignError, setCampaignError] = useState("");
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);
  const [paid, setPaid] = useState(null);

  function setTab(next) {
    const nextParams = new URLSearchParams(params);
    nextParams.set("tab", tabFromParam(next));
    setParams(nextParams, { replace: true });
  }

  const loadCampaign = useCallback(async (campaignId) => {
    setCampaignPhase("loading");
    setCampaignError("");
    setCampaign(null);
    try {
      // getCampaignDetail returns null for unknown, inactive or non-UUID
      // ids — never a fabricated campaign.
      const found = await getCampaignDetail(campaignId);
      if (!found) { setCampaignPhase("not-found"); return; }
      setCampaign(found);
      setCampaignPhase("ready");
    } catch {
      setCampaignPhase("error");
      setCampaignError("We couldn't load this campaign. Please try again.");
    }
  }, []);

  useEffect(() => {
    if (mode.mode !== "campaign") { setCampaignPhase("idle"); setCampaign(null); return; }
    loadCampaign(mode.campaignId);
  }, [mode.mode, mode.campaignId, loadCampaign]);

  const content = <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
    <header className="space-y-2">
      <h1 className="flex items-center gap-3 font-display text-3xl font-bold">
        <HandHeart aria-hidden="true" className="h-7 w-7 text-primary" />Donate / Checkout
      </h1>
      <p className="text-sm text-muted-foreground">Secure checkout by PayPal. Donations are live; withdrawals for campaign owners will be enabled shortly. You do not need an iFund account, and you can donate as a guest.</p>
    </header>

    <div role="tablist" aria-label="Donate and invest sections" className="flex flex-wrap gap-2">
      {DONATE_TABS.map((item) => <button key={item.id} type="button" role="tab"
        id={`donate-tab-${item.id}`} aria-selected={tab === item.id}
        aria-controls={`donate-panel-${item.id}`} onClick={() => setTab(item.id)}
        className={"min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold " + (tab === item.id
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card hover:border-primary/50")}>
        {item.label}
      </button>)}
    </div>

    {tab === "donate" && <section role="tabpanel" id="donate-panel-donate"
      aria-labelledby="donate-tab-donate" className="space-y-5">
      {paid === "campaign" && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CircleCheck className="mr-2 inline h-5 w-5" />Donation verified with PayPal and recorded. Thank you!
        {" "}<Link to="/giving" className="font-semibold underline">View My Giving</Link>
      </p>}
      {paid === "support" && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CircleCheck className="mr-2 inline h-5 w-5" />Support verified with PayPal and recorded. Thank you! This is platform support, not a campaign donation.
      </p>}

      {mode.mode === "campaign" ? <>
        {campaignPhase === "loading" && <p role="status">Loading campaign…</p>}
        {campaignPhase === "not-found" && <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Campaign not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">This donation link does not match an active campaign. No payment was started and no campaign was assumed.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/discover" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold">Discover campaigns</Link>
            <Link to="/donate?support=1" className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 py-2 text-sm font-semibold">Support Interplanetary Fund instead</Link>
          </div>
        </section>}
        {campaignPhase === "error" && <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold">Campaign could not be loaded</h2>
          <p role="alert" className="mt-2 text-sm text-muted-foreground">{campaignError}</p>
          <button type="button" onClick={() => loadCampaign(mode.campaignId)}
            className="mt-4 min-h-11 rounded-xl border border-border px-4 py-2 text-sm font-semibold">Retry</button>
        </section>}
        {campaignPhase === "ready" && campaign && <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <div>
            <h2 className="text-xl font-bold">{campaign.title}</h2>
            {campaign.summary && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{campaign.summary}</p>}
            <Link to={`/campaign/${campaign.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline">View campaign details</Link>
          </div>
          <div className="space-y-2 rounded-xl border border-border bg-background p-4 text-sm">
            <h3 className="font-semibold">How your donation is allocated</h3>
            <p className="text-muted-foreground">Choose your amount in secure checkout. You may add an optional 10% support for Interplanetary Fund, separate from the campaign donation. IFund covers payment processing costs; the 7% platform fee is deducted once from the organizer&apos;s eligible withdrawal, not added to your checkout amount.</p>
          </div>
          <button type="button" onClick={() => setCampaignDialogOpen(true)}
            className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
            Donate securely
          </button>
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Card, PayPal, or Google Pay — checkout and card fields securely provided by PayPal. Your payment details are never stored by IFund.</p>
        </section>}
      </> : <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="text-xl font-bold">Support Interplanetary Fund</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Optional support helps maintain the IFund platform. No portion of this payment is assigned to an individual fundraiser, and the 7% campaign-owner withdrawal fee does not apply to platform support.</p>
        </div>
        <button type="button" onClick={() => setSupportDialogOpen(true)}
          className="inline-flex min-h-12 items-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
          Support Interplanetary Fund
        </button>
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4" />Card, PayPal, or Google Pay — checkout and card fields securely provided by PayPal. Your payment details are never stored by IFund.</p>
        <p className="text-sm"><Link to="/discover" className="font-semibold text-primary underline">Donate to a campaign instead</Link></p>
      </section>}
    </section>}

    {tab === "invest" && <section role="tabpanel" id="donate-panel-invest"
      aria-labelledby="donate-tab-invest" className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-xl font-bold">
        <TrendingUp aria-hidden="true" className="h-5 w-5 text-primary" />Invest
      </h2>
      <p className="text-sm leading-relaxed text-muted-foreground">Investment is a different flow from donation checkout. An investment allocation shows how a commitment would be split across milestones — it is not a donation, and it does not fund a campaign.</p>
      <p role="note" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-semibold">
        No investment is currently offered through this page. Investments carry risk. No returns are guaranteed.
      </p>
      <div className="space-y-2 rounded-xl border border-border bg-background p-4 text-sm">
        <h3 className="font-semibold">Illustrative example — not a live investment offer</h3>
        <p className="text-muted-foreground">An investment allocation would show the commitment, the milestone split, and the status of each portion. Example only:</p>
        <dl className="space-y-1">
          <div className="flex justify-between gap-4"><dt>Example commitment</dt><dd className="font-semibold tabular-nums">$1,000</dd></div>
          <div className="flex justify-between gap-4"><dt>Milestone A</dt><dd className="font-semibold tabular-nums">50%</dd></div>
          <div className="flex justify-between gap-4"><dt>Milestone B</dt><dd className="font-semibold tabular-nums">30%</dd></div>
          <div className="flex justify-between gap-4"><dt>Reserve</dt><dd className="font-semibold tabular-nums">20%</dd></div>
        </dl>
        <p className="text-xs text-muted-foreground">Figures above are an illustrative example from the design review, not a real opportunity, price, or promise of any return.</p>
      </div>
      <p className="text-sm">To ask about future investment opportunities, <Link to="/contact" className="font-semibold text-primary underline">contact Interplanetary Fund</Link>. Nothing on this tab is an offer to sell securities.</p>
    </section>}
  </main>;

  // The dialogs render below the page shell and own every payment call.
  return <>
    {content}
    {campaign && <CampaignDonationDialog campaign={campaign}
      open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}
      onPaid={() => setPaid("campaign")} />}
    <PlatformSupportDonationDialog open={supportDialogOpen}
      onOpenChange={setSupportDialogOpen} onSupported={() => setPaid("support")} />
  </>;
}
