import React from "react";

// Reward banner tiers — earned by posting on the Interplanetary Fund social
// feed. Each tier unlocks a premium profile banner and top-feed placement.
const TIER_CONFIG = {
  none: { label: "New Explorer", gradient: "from-slate-500 to-slate-600", glow: "", icon: "✦" },
  bronze: { label: "Bronze Pioneer", gradient: "from-amber-600 to-orange-700", glow: "shadow-amber-500/30", icon: "🪐" },
  silver: { label: "Silver Voyager", gradient: "from-slate-300 to-slate-500", glow: "shadow-slate-400/40", icon: "🌙" },
  gold: { label: "Gold Navigator", gradient: "from-yellow-400 to-amber-600", glow: "shadow-yellow-500/40", icon: "⭐" },
  platinum: { label: "Platinum Commander", gradient: "from-cyan-300 via-blue-400 to-violet-500", glow: "shadow-cyan-400/50", icon: "🌠" },
};

export function getTierFromScore(score) {
  if (score >= 500) return "platinum";
  if (score >= 100) return "gold";
  if (score >= 50) return "silver";
  if (score >= 10) return "bronze";
  return "none";
}

export const TIER_THRESHOLDS = { bronze: 10, silver: 50, gold: 100, platinum: 500 };

// Compact badge — shown next to author names on posts and in nav.
export function BannerBadge({ tier = "none", className = "" }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.none;
  if (tier === "none") return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${cfg.gradient} px-2 py-0.5 text-[10px] font-semibold text-white shadow ${cfg.glow} ${className}`}
    >
      <span>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// Full profile banner — shown on the user's profile or the social feed sidebar.
export default function ProfileBanner({ tier = "none", socialScore = 0, username }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG.none;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${cfg.gradient} p-5 shadow-lg ${cfg.glow}`}>
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 30%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div className="relative flex items-center gap-3">
        <span className="text-3xl">{cfg.icon}</span>
        <div>
          <p className="text-white font-display text-lg leading-tight">{cfg.label}</p>
          {username && <p className="text-white/80 text-sm">@{username}</p>}
          <p className="text-white/70 text-xs mt-0.5">{socialScore} social points</p>
        </div>
      </div>
    </div>
  );
}