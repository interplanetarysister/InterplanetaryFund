/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */
import { useState } from "react";

export default function ThankYou({
  campaignTitle,
  amount,
  donorName,
  onBackToExplore,
  onViewCampaign,
}: {
  campaignTitle?: string;
  amount?: number;
  donorName?: string;
  onBackToExplore: () => void;
  onViewCampaign?: () => void;
}) {
  const [showShare, setShowShare] = useState(false);

  const shareText = `I just supported ${campaignTitle || "a campaign"} on Interplanetary Fund! Join me in fueling a cause today.`;
  const shareUrl = window.location.origin;

  const handleShare = async (platform: string) => {
    const urls: Record<string, string> = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`,
    };
    if (urls[platform]) window.open(urls[platform], "_blank");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10">
      {/* Success Animation */}
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-ifcyan to-ifaccent flex items-center justify-center mb-6 animate-pulse">
        <span className="text-4xl">✓</span>
      </div>

      <h1 className="text-2xl font-bold text-white text-center mb-2">
        Thank you{donorName ? `, ${donorName}` : ""}!
      </h1>

      <p className="text-ifmuted text-sm text-center max-w-xs mb-1">
        Your {amount ? `$${amount}` : "donation"} {amount ? "contribution" : ""} to
        {campaignTitle ? ` "${campaignTitle}"` : " this campaign"} is making a real difference.
      </p>

      <p className="text-ifmuted text-xs text-center max-w-xs mb-6">
        You're now part of the Interplanetary Fund community — a network of supporters fueling causes that matter.
      </p>

      {/* Impact Stats */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-6">
        <div className="bg-ifbg2 rounded-xl p-3 border border-ifborder text-center">
          <p className="text-ifcyan text-lg font-bold">$9,907</p>
          <p className="text-ifmuted text-[10px]">Total raised</p>
        </div>
        <div className="bg-ifbg2 rounded-xl p-3 border border-ifborder text-center">
          <p className="text-ifcyan text-lg font-bold">8</p>
          <p className="text-ifmuted text-[10px]">Supporters</p>
        </div>
        <div className="bg-ifbg2 rounded-xl p-3 border border-ifborder text-center">
          <p className="text-ifcyan text-lg font-bold">4</p>
          <p className="text-ifmuted text-[10px]">Campaigns</p>
        </div>
      </div>

      {/* Share Section */}
      <button
        onClick={() => setShowShare(!showShare)}
        className="text-ifcyan text-sm mb-3"
      >
        {showShare ? "Hide share options" : "Share your support →"}
      </button>

      {showShare && (
        <div className="flex gap-3 mb-6">
          <button onClick={() => handleShare("facebook")} className="w-10 h-10 rounded-full bg-[#1877F2]/20 flex items-center justify-center text-lg">f</button>
          <button onClick={() => handleShare("twitter")} className="w-10 h-10 rounded-full bg-ifbg flex items-center justify-center text-lg">𝕏</button>
          <button onClick={() => handleShare("whatsapp")} className="w-10 h-10 rounded-full bg-[#25D366]/20 flex items-center justify-center text-lg">💬</button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {onViewCampaign && (
          <button
            onClick={onViewCampaign}
            className="w-full bg-ifaccent text-white rounded-xl py-3 text-sm font-medium"
          >
            View Campaign
          </button>
        )}
        <button
          onClick={onBackToExplore}
          className="w-full bg-ifbg2 text-ifmuted border border-ifborder rounded-xl py-3 text-sm"
        >
          Back to Explore
        </button>
      </div>
    </div>
  );
}
