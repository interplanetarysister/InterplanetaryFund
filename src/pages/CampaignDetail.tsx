/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import ShareModal from "../components/ShareModal";
import VerifiedBadge from "../components/VerifiedBadge";

type CampaignDetailProps = {
  campaignId: string;
  userId: string | null;
  onBack: () => void;
  onLogin: () => void;
};

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];
const MIN_AMOUNT = 1;

export default function CampaignDetail({ campaignId, userId, onBack, onLogin }: CampaignDetailProps) {
  const campaign = useQuery(api.userCampaigns.getCampaign, { campaignId });
  const updates = useQuery(api.userCampaigns.getCampaignUpdates, { campaignId });
  const donations = useQuery(api.paypalCheckout.getDonations, { campaignId });
  const followed = useQuery(
    api.userCampaigns.getFollowedCampaigns,
    userId ? { userId } : "skip"
  );

  const followCampaign = useMutation(api.userCampaigns.followCampaign);
  const unfollowCampaign = useMutation(api.userCampaigns.unfollowCampaign);
  const createCheckout = useMutation(api.paypalCheckout.createCheckoutSession);
  const recordDonation = useMutation(api.userCampaigns.recordDonation);

  const [showDonate, setShowDonate] = useState(false);
  const [donationAmount, setDonationAmount] = useState("25");
  const [donorName, setDonorName] = useState("");
  const [donationMessage, setDonationMessage] = useState("");
  const [donationStep, setDonationStep] = useState<"amount" | "info" | "processing" | "done">("amount");
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentName, setCommentName] = useState("");
  const [showComments, setShowComments] = useState(false);
  const comments = useQuery(api.comments.getComments, { campaignId });
  const isSaved = useQuery(api.savedCampaigns.isSaved, userId ? { campaignId, userId } : "skip");
  const addComment = useMutation(api.comments.addComment);
  const saveCampaign = useMutation(api.savedCampaigns.saveCampaign);
  const unsaveCampaign = useMutation(api.savedCampaigns.unsaveCampaign);

  const isFollowing = useMemo(() => {
    if (!followed || !userId) return false;
    return followed.some((f: any) => f.campaignId === campaignId);
  }, [followed, userId, campaignId]);

  if (campaign === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (campaign === null) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-iftext text-lg font-semibold">Campaign not found</p>
        <p className="text-ifmuted text-sm">This campaign may have been removed.</p>
        <button onClick={onBack} className="px-4 py-2 rounded-full bg-ifaccent text-ifwhite text-sm font-medium">
          Back to Launch Pads
        </button>
      </div>
    );
  }

  const progress = campaign.goalAmount > 0 ? Math.min((campaign.raisedAmount / campaign.goalAmount) * 100, 100) : 0;
  const numericAmount = parseFloat(donationAmount) || 0;
  const isValidAmount = numericAmount >= MIN_AMOUNT;

  const handleFollow = async () => {
    if (!userId) {
      onLogin();
      return;
    }
    if (isFollowing) {
      await unfollowCampaign({ userId, campaignId });
    } else {
      await followCampaign({ userId, campaignId });
    }
  };

  const handleShare = () => {
    setShowShare(true);
  };

  const handleSave = async () => {
    if (!userId) { onLogin(); return; }
    if (isSaved) {
      await unsaveCampaign({ campaignId, userId });
    } else {
      await saveCampaign({ campaignId, userId });
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !commentName.trim()) return;
    await addComment({
      campaignId,
      authorName: commentName,
      authorId: userId || undefined,
      body: commentText,
    });
    setCommentText("");
    setCommentName("");
  };

  const handleDonate = async () => {
    if (!isValidAmount || donationStep === "processing") return;

    if (donationStep === "amount") {
      setDonationStep("info");
      return;
    }

    if (donationStep === "info") {
      setDonationStep("processing");
      try {
        const result = await createCheckout({
          campaignId,
          campaignTitle: campaign.title,
          amount: numericAmount,
          donorName: donorName || "Anonymous",
          message: donationMessage,
        });

        // Record donation locally for instant feedback
        await recordDonation({
          campaignId,
          amount: numericAmount,
          donorName: donorName || "Anonymous",
          message: donationMessage,
        });

        // Redirect to PayPal
        if (result?.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          setDonationStep("done");
        }
      } catch (e) {
        setDonationStep("info");
      }
    }
  };

  const cashappUrl = campaign.cashappTag
    ? "https://cash.app/$" + campaign.cashappTag
    : null;

  return (
    <div className="space-y-4 pb-20">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-ifmuted text-xs hover:text-iftext transition-colors">
        <span>← Back</span>
      </button>

      {/* Cover image */}
      {campaign.coverImageUrl && (
        <div className="relative rounded-2xl overflow-hidden h-48 bg-ifcard">
          <img
            src={campaign.coverImageUrl}
            alt={campaign.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ifdark via-transparent to-transparent" />
        </div>
      )}

      {/* Campaign header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-ifaccent/20 text-ifaccent text-[10px] font-medium">
            {campaign.category}
          </span>
          {campaign.location && (
            <span className="text-ifmuted text-[10px]">📍 {campaign.location}</span>
          )}
        </div>
        <h1 className="text-xl font-bold text-iftext font-display leading-tight">{campaign.title}</h1>
        <p className="text-sm text-ifmuted leading-relaxed">{campaign.summary}</p>
      </div>

      {/* Progress card */}
      <div className="bg-ifcard rounded-2xl p-4 space-y-3 border border-ifborder">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-iftext font-display">
              ${campaign.raisedAmount.toLocaleString()}
            </p>
            <p className="text-[10px] text-ifmuted">
              raised of ${campaign.goalAmount.toLocaleString()} goal
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-ifcyan">{campaign.donorCount}</p>
            <p className="text-[10px] text-ifmuted">supporters</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2.5 rounded-full bg-ifborder overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ifcyan to-ifaccent transition-all duration-700"
            style={{ width: progress + "%" }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-ifmuted">
          <span>{progress.toFixed(0)}% funded</span>
          {campaign.endDate && (
            <span>Ends {new Date(campaign.endDate).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => { setShowDonate(!showDonate); setDonationStep("amount"); }}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-ifcyan to-ifaccent text-ifwhite font-semibold text-sm shadow-glow-purple"
        >
          Support This Mission
        </button>
        <button
          onClick={handleFollow}
          className={"px-4 py-3 rounded-xl font-medium text-sm transition-colors " + (
            isFollowing
              ? "bg-ifaccent/20 text-ifaccent border border-ifaccent/40"
              : "bg-ifcard text-iftext border border-ifborder"
          )}
        >
          {isFollowing ? "✓ Following" : "Follow"}
        </button>
        <button
          onClick={handleSave}
          className={"px-4 py-3 rounded-xl font-medium text-sm transition-colors " + (
            isSaved
              ? "bg-ifaccent/20 text-ifaccent border border-ifaccent/40"
              : "bg-ifcard text-iftext border border-ifborder"
          )}
        >
          {isSaved ? "★ Saved" : "☆ Save"}
        </button>
        <button
          onClick={handleShare}
          className="px-4 py-3 rounded-xl bg-ifcard text-iftext border border-ifborder font-medium text-sm"
        >
          {"Share"}
        </button>
      </div>

      {/* Donation flow */}
      {showDonate && (
        <div className="bg-ifcard rounded-2xl p-4 space-y-3 border border-ifborder">
          {donationStep === "amount" && (
            <>
              <p className="text-sm font-semibold text-iftext">Choose amount</p>
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setDonationAmount(amt.toString())}
                    className={"py-2 rounded-lg text-sm font-medium transition-colors " + (
                      donationAmount === amt.toString()
                        ? "bg-ifaccent text-ifwhite"
                        : "bg-ifborder text-iftext"
                    )}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ifmuted text-sm">$</span>
                <input
                  type="number"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  placeholder="Custom amount"
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-ifborder text-iftext text-sm focus:outline-none focus:ring-1 focus:ring-ifcyan"
                />
              </div>
              <button
                onClick={handleDonate}
                disabled={!isValidAmount}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-ifcyan to-ifaccent text-ifwhite font-semibold text-sm disabled:opacity-50"
              >
                Continue
              </button>
            </>
          )}

          {donationStep === "info" && (
            <>
              <p className="text-sm font-semibold text-iftext">Your details</p>
              <p className="text-lg font-bold text-ifcyan">${numericAmount.toFixed(2)}</p>
              <input
                type="text"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full px-3 py-2.5 rounded-lg bg-ifborder text-iftext text-sm focus:outline-none focus:ring-1 focus:ring-ifcyan"
              />
              <textarea
                value={donationMessage}
                onChange={(e) => setDonationMessage(e.target.value)}
                placeholder="Leave a message of support (optional)"
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-ifborder text-iftext text-sm focus:outline-none focus:ring-1 focus:ring-ifcyan resize-none"
              />
              <div className="space-y-2">
                <button
                  onClick={handleDonate}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-ifcyan to-ifaccent text-ifwhite font-semibold text-sm"
                >
                  Donate ${numericAmount.toFixed(2)} via PayPal
                </button>
                {cashappUrl && (
                  <a
                    href={cashappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 rounded-xl bg-[#00D632] text-white font-semibold text-sm text-center"
                  >
                    Donate via CashApp
                  </a>
                )}
                <button
                  onClick={() => setDonationStep("amount")}
                  className="w-full py-2 text-ifmuted text-xs"
                >
                  ← Change amount
                </button>
              </div>
            </>
          )}

          {donationStep === "processing" && (
            <div className="flex flex-col items-center py-6 space-y-3">
              <div className="w-8 h-8 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
              <p className="text-ifmuted text-sm">Processing your donation…</p>
            </div>
          )}

          {donationStep === "done" && (
            <div className="flex flex-col items-center py-6 space-y-3 text-center">
              <div className="w-12 h-12 rounded-full bg-ifgreen/20 flex items-center justify-center text-2xl">✓</div>
              <p className="text-iftext font-semibold text-sm">Thank you for your support!</p>
              <p className="text-ifmuted text-xs">Your donation of ${numericAmount.toFixed(2)} has been recorded.</p>
              <button onClick={() => setShowDonate(false)} className="px-4 py-2 rounded-full bg-ifcard text-iftext text-xs border border-ifborder">
                Close
              </button>
            </div>
          )}
        </div>
      )}

      {/* Story */}
      {campaign.story && (
        <div className="bg-ifcard rounded-2xl p-4 border border-ifborder">
          <h2 className="text-sm font-semibold text-iftext mb-2">The Story</h2>
          <div className="text-sm text-ifmuted leading-relaxed whitespace-pre-wrap">
            {campaign.story}
          </div>
        </div>
      )}

      {/* AI-Generated FAQ */}
      {campaign.aiFaq && (
        <div className="bg-ifcard rounded-2xl p-4 border border-ifborder">
          <h2 className="text-sm font-semibold text-iftext mb-3">FAQ</h2>
          <div className="space-y-3">
            {campaign.aiFaq.split("\n\n").filter((block: string) => block.startsWith("Q:")).map((block: string, i: number) => {
              const q = block.split("A:")[0]?.replace("Q:", "").trim();
              const a = block.split("A:")[1]?.trim();
              return (
                <div key={i}>
                  <p className="text-xs font-semibold text-ifcyan">{q}</p>
                  <p className="text-xs text-ifmuted mt-0.5 leading-relaxed">{a}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI-Generated Tags */}
      {campaign.aiTags && campaign.aiTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {campaign.aiTags.map((tag: string, i: number) => (
            <span key={i} className="text-[10px] bg-ifdark border border-ifborder rounded-full px-2 py-1 text-ifmuted">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Campaign updates */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-iftext px-1">Updates</h2>
        {updates === undefined ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : updates.length === 0 ? (
          <p className="text-ifmuted text-xs px-1">No updates yet. Follow to get notified when there's news.</p>
        ) : (
          <div className="space-y-2">
            {updates.map((update: any) => (
              <div key={update._id} className="bg-ifcard rounded-xl p-3 border border-ifborder space-y-1.5">
                <p className="text-sm font-semibold text-iftext">{update.title}</p>
                <p className="text-xs text-ifmuted leading-relaxed">{update.content}</p>
                {update.mediaUrl && (
                  <img
                    src={update.mediaUrl}
                    alt={update.title}
                    className="w-full rounded-lg mt-2"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <p className="text-[10px] text-ifmuted">
                  {new Date(update.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent supporters */}
      {donations && donations.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-iftext px-1">Recent Supporters</h2>
          <div className="space-y-1.5">
            {donations.slice(0, 10).map((d: any) => (
              <div key={d._id} className="flex items-center justify-between bg-ifcard rounded-lg px-3 py-2 border border-ifborder">
                <div>
                  <p className="text-xs font-medium text-iftext">{d.donorName}</p>
                  {d.message && <p className="text-[10px] text-ifmuted">{d.message}</p>}
                </div>
                <p className="text-xs font-semibold text-ifcyan">+${d.amount}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
