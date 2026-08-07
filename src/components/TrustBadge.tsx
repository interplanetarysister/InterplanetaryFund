/*
 * Interplanetary Fund — Trust Badge Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Shows trust level based on donor count — inspired by fundforge TrustBadge.
 */

export default function TrustBadge({ donorCount }: { donorCount: number }) {
  if (donorCount < 5) return null;

  const level = donorCount >= 100 ? "gold" : donorCount >= 25 ? "silver" : "bronze";
  const styles: Record<string, string> = {
    gold: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    silver: "bg-slate-300/15 text-slate-300 border-slate-300/30",
    bronze: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  };
  const labels: Record<string, string> = {
    gold: "Trusted",
    silver: "Trusted",
    bronze: "Trusted",
  };

  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full border ${styles[level]}`}>
      ✓ {labels[level]}
    </span>
  );
}
