/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useState } from "react";
import { usePaginatedQuery, useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];
const CASHAPP_TAG = "unrewound";
const CASHAPP_URL = `https://cash.app/$${CASHAPP_TAG}`;
const MIN_AMOUNT = 1;

export default function Explore() {
  // Paginated campaigns — loads 8 at a time, more on scroll
  const { results: campaigns, status: campaignStatus, loadMore } = usePaginatedQuery(
    api.campaigns.getCampaigns,
    { status: "active" },
    { initialNumItems: 8 }
  );
  // Lightweight stats query — just numbers, no campaign data
  const stats = useQuery(api.campaigns.getCampaignStats, {});
  const balances = useQuery(api.treasury.aggregateBalances, {});
  const recordDonation = useMutation(api.campaigns.recordDonation);
  const recordInteraction = useMutation(api.interactions.recordInteraction);

  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);
  const [donationAmount, setDonationAmount] = useState<string>("25");
  const [donorName, setDonorName] = useState("");
  const [donationMessage, setDonationMessage] = useState("");
  const [donationStep, setDonationStep] = useState<"amount" | "info" | "processing" | "done">("amount");
  const [viewedCampaigns, setViewedCampaigns] = useState<Set<string>>(new Set());

  if (campaignStatus === "LoadingFirstPage" || !stats || !balances) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Stats come from lightweight query, not from loading all campaigns
  const totalRaised = balances.grandTotal?.raised || 0;
  const totalDonors = balances.grandTotal?.donors || 0;
  const activeCount = stats.activeCount || 0;

  const numericAmount = parseFloat(donationAmount) || 0;
  const isValidAmount = numericAmount >= MIN_AMOUNT;

  const handleCampaignView = (campaign: any) => {
    const campaignKey = campaign.ifCampaignId;
    if (!viewedCampaigns.has(campaignKey)) {
      setViewedCampaigns(prev => new Set([...prev, campaignKey]));
      recordInteraction({
        campaignId: campaign.ifCampaignId,
        campaignTitle: campaign.title,
        interactionType: "view",
      }).catch(() => {});
    }
  };

  const handleSupport = (campaign: any) => {
    handleCampaignView(campaign);
    recordInteraction({
      campaignId: campaign.ifCampaignId,
      campaignTitle: campaign.title,
      interactionType: "click",
    }).catch(() => {});

    setSelectedCampaign(campaign);
    setDonationAmount("25");
    setDonorName("");
    setDonationMessage("");
    setDonationStep("amount");
  };

  const handleCloseModal = () => {
    setSelectedCampaign(null);
    setDonationStep("amount");
  };

  const handleShare = (campaign: any) => {
    recordInteraction({
      campaignId: campaign.ifCampaignId,
      campaignTitle: campaign.title,
      interactionType: "share",
    }).catch(() => {});

    if (navigator.share) {
      navigator.share({
        title: campaign.title,
        text: `Support "${campaign.title}" on Interplanetary Fund!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href).catch(() => {});
    }
  };

  const handleCompleteDonation = async () => {
    if (!selectedCampaign || !isValidAmount) return;
    setDonationStep("processing");
    try {
      await recordDonation({
        campaignId: selectedCampaign.ifCampaignId,
        campaignTitle: selectedCampaign.title,
        amount: numericAmount,
        donorName: donorName || "Anonymous",
        message: donationMessage || undefined,
        paymentMethod: "cashapp",
      });

      const cashappPayUrl = `${CASHAPP_URL}/${numericAmount}`;
      window.open(cashappPayUrl, "_blank");

      setDonationStep("done");
    } catch (e) {
      setDonationStep("amount");
      alert("Something went wrong. Please try again.");
    }
  };

  return (
    <div className="space-y-5">
      {/* Hero Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-ifaccent/20 to-ifcyan/10 border border-ifborder p-5">
        <h2 className="text-xl font-bold text-iftext">Together we can</h2>
        <p className="text-sm text-ifmuted mt-1">
          ${totalRaised.toLocaleString()} raised by {totalDonors} supporters
        </p>
        <div className="mt-3 flex gap-2">
          <div className="flex-1 h-1.5 bg-ifborder rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-ifaccent to-ifcyan rounded-full"
              style={{ width: `${totalRaised > 0 ? 68 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Campaign Cards */}
      <div>
        <h3 className="text-sm font-semibold text-iftext mb-3">Active Campaigns</h3>
        <div className="space-y-4">
          {campaigns.length === 0 && (
            <div className="card text-center py-8">
              <p className="text-sm text-ifmuted">New campaigns coming soon!</p>
            </div>
          )}

          {campaigns.map((c: any) => {
            const progress = c.goalAmount > 0
              ? Math.min(100, Math.round((c.raisedAmount / c.goalAmount) * 100))
              : 0;

            return (
              <div key={c._id} className="card overflow-hidden">
                <div className="h-40 -mx-4 -mt-4 mb-3 overflow-hidden relative">
                  {c.coverImageUrl ? (
                    <img
                      src={c.coverImageUrl}
                      alt={c.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-ifaccent/30 to-ifcyan/20 flex items-center justify-center">
                      <span className="text-3xl font-bold text-ifaccent/60">{c.category}</span>
                    </div>
                  )}
                </div>

                <h4 className="text-sm font-semibold text-iftext">{c.title}</h4>
                {c.summary && (
                  <p className="text-xs text-ifmuted mt-1 line-clamp-2">{c.summary}</p>
                )}

                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-iftext font-medium">
                      ${c.raisedAmount.toLocaleString()}
                    </span>
                    <span className="text-ifmuted">
                      of ${c.goalAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-ifborder rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-ifaccent to-ifcyan rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-ifmuted mt-1">
                    <span>{progress}% funded</span>
                    <span>{c.donorCount} supporters</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleSupport(c)}
                    className="flex-1 py-2.5 rounded-xl bg-ifaccent text-white text-sm font-semibold active:scale-[0.98] transition-transform"
                  >
                    Support
                  </button>
                  <button
                    onClick={() => handleShare(c)}
                    className="px-3 py-2.5 rounded-xl bg-ifborder text-iftext text-sm font-semibold active:scale-[0.98] transition-transform"
                  >
                    Share
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Load more campaigns */}
      {campaignStatus === "CanLoadMore" && (
        <button
          onClick={() => loadMore(8)}
          className="w-full py-3 rounded-xl border border-ifborder text-sm text-iftext font-semibold active:scale-[0.98] transition-transform"
        >
          Load more campaigns
        </button>
      )}
      {campaignStatus === "LoadingMore" && (
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Impact stats */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="card text-center">
          <p className="text-2xl font-bold text-ifcyan">{activeCount}</p>
          <p className="text-[10px] text-ifmuted mt-1">Active campaigns</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-ifgreen">{totalDonors}</p>
          <p className="text-[10px] text-ifmuted mt-1">Total supporters</p>
        </div>
      </div>

      <div className="text-center py-4">
        <p className="text-[10px] text-ifmuted">Every dollar makes a difference</p>
      </div>

      {/* Donation Modal */}
      {selectedCampaign && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={handleCloseModal}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <div
            className="relative w-full max-w-md bg-ifcard rounded-t-3xl sm:rounded-3xl border border-ifborder p-6 space-y-4 animate-in max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseModal}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-ifborder flex items-center justify-center text-ifmuted text-lg"
            >
              x
            </button>

            {/* Amount step */}
            {donationStep === "amount" && (
              <>
                <div>
                  <h3 className="text-base font-bold text-iftext">Support "{selectedCampaign.title}"</h3>
                  <p className="text-xs text-ifmuted mt-1">Enter any amount to donate</p>
                </div>

                {/* Big amount display */}
                <div className="text-center py-4">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-3xl font-bold text-ifmuted">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={donationAmount}
                      onChange={(e) => setDonationAmount(e.target.value)}
                      className="w-32 bg-transparent text-4xl font-bold text-iftext text-center outline-none"
                      placeholder="25"
                      autoFocus
                    />
                  </div>
                  {isValidAmount && (
                    <p className="text-xs text-ifgreen mt-2">
                      ${numericAmount.toLocaleString()} donation
                    </p>
                  )}
                  {!isValidAmount && donationAmount !== "" && (
                    <p className="text-xs text-red-400 mt-2">
                      Minimum donation is $1
                    </p>
                  )}
                </div>

                {/* Quick select chips */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setDonationAmount(String(amt))}
                      className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                        donationAmount === String(amt)
                          ? "bg-ifaccent text-white"
                          : "bg-ifborder text-iftext"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setDonationStep("info")}
                  disabled={!isValidAmount}
                  className="w-full py-3 rounded-xl bg-ifaccent text-white text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  Continue
                </button>
              </>
            )}

            {/* Info step */}
            {donationStep === "info" && (
              <>
                <div>
                  <h3 className="text-base font-bold text-iftext">Almost there!</h3>
                  <p className="text-xs text-ifmuted mt-1">
                    Donating ${numericAmount.toLocaleString()} to "{selectedCampaign.title}"
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-ifmuted">Your name (optional)</label>
                    <input
                      type="text"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      className="mt-1 w-full bg-ifborder rounded-xl px-3 py-2.5 text-iftext text-sm outline-none"
                      placeholder="Anonymous"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ifmuted">Message (optional)</label>
                    <textarea
                      value={donationMessage}
                      onChange={(e) => setDonationMessage(e.target.value)}
                      className="mt-1 w-full bg-ifborder rounded-xl px-3 py-2.5 text-iftext text-sm outline-none resize-none"
                      rows={2}
                      placeholder="Words of support..."
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-ifborder">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <span className="text-sm">$$</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-iftext">Pay with CashApp</p>
                      <p className="text-[10px] text-ifmuted">Tapping donate opens CashApp to complete payment</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCompleteDonation}
                    className="w-full py-3 rounded-xl bg-green-600 text-white text-sm font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  >
                    Donate ${numericAmount.toLocaleString()} via CashApp
                  </button>
                </div>
              </>
            )}

            {/* Processing step */}
            {donationStep === "processing" && (
              <div className="py-8 text-center">
                <div className="w-10 h-10 border-2 border-ifaccent border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-ifmuted mt-3">Opening CashApp...</p>
              </div>
            )}

            {/* Done step */}
            {donationStep === "done" && (
              <div className="py-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-ifgreen/20 flex items-center justify-center mx-auto">
                  <span className="text-3xl">✓</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-iftext">Thank you!</h3>
                  <p className="text-sm text-ifmuted mt-1">
                    Your ${numericAmount.toLocaleString()} donation to "{selectedCampaign.title}" has been recorded.
                  </p>
                  <p className="text-[10px] text-ifmuted mt-2">
                    Complete your payment in CashApp if it didn't open automatically.
                  </p>
                </div>
                <a
                  href={`${CASHAPP_URL}/${numericAmount}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 rounded-xl bg-green-600 text-white text-sm font-semibold text-center"
                >
                  Open CashApp
                </a>
                <button
                  onClick={handleCloseModal}
                  className="w-full py-3 rounded-xl bg-ifborder text-iftext text-sm font-semibold"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
