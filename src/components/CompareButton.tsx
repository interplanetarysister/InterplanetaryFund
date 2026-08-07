/*
 * Interplanetary Fund — Compare Button Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState, useEffect } from "react";

export default function CompareButton({
  campaignId,
  campaignTitle,
  className = "",
  onNavigate,
}: {
  campaignId: string;
  campaignTitle?: string;
  className?: string;
  onNavigate?: (view: string) => void;
}) {
  const [inCompare, setInCompare] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("compareList") || "[]");
      setInCompare(stored.includes(campaignId));
    } catch {
      setInCompare(false);
    }
  }, [campaignId]);

  const toggleCompare = () => {
    try {
      let stored: string[] = JSON.parse(localStorage.getItem("compareList") || "[]");
      if (stored.includes(campaignId)) {
        stored = stored.filter((x) => x !== campaignId);
      } else {
        if (stored.length >= 3) return; // Max 3
        stored = [...stored, campaignId];
      }
      localStorage.setItem("compareList", JSON.stringify(stored));
      setInCompare(stored.includes(campaignId));
    } catch {}
  };

  return (
    <button
      onClick={toggleCompare}
      className={className}
      title="Add to comparison"
    >
      {inCompare ? "⚖️" : "📊"}
    </button>
  );
}
