/*
 * Interplanetary Fund — Share Bar Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState } from "react";

export default function ShareBar({ campaignId, campaignTitle }: { campaignId: string; campaignTitle?: string }) {
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/?campaign=${campaignId}` : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: campaignTitle || "Interplanetary Fund Campaign",
          text: `Support this campaign: ${campaignTitle || ""}`,
          url: shareUrl,
        });
      } catch {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleNativeShare}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-iftext hover:border-ifcyan/30 transition-colors"
      >
        📤 Share
      </button>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-iftext hover:border-ifcyan/30 transition-colors"
      >
        {copied ? "✓ Copied!" : "🔗 Copy Link"}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Support: ${campaignTitle || ""}`)}&url=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-iftext hover:border-ifcyan/30 transition-colors"
      >
        🐦
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-iftext hover:border-ifcyan/30 transition-colors"
      >
        📘
      </a>
    </div>
  );
}
