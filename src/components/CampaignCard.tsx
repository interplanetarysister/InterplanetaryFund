/*
 * Interplanetary Fund — Campaign Card Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * 
 * Reusable card for displaying campaign info across pages.
 * Supports both fundforge (snake_case) and Convex (camelCase) field names.
 */

interface CampaignCardProps {
  campaign: any;
  onClick?: () => void;
}

export default function CampaignCard({ campaign, onClick }: CampaignCardProps) {
  // Support both naming conventions
  const id = campaign._id || campaign.id;
  const imageUrl = campaign.image_url || campaign.coverImageUrl;
  const title = campaign.title;
  const organizerName = campaign.organizer_name || campaign.organizerName || "Unknown";
  const category = campaign.category || "other";
  const goal = campaign.goal || campaign.goalAmount || 0;
  const raised = campaign.raised || campaign.raisedAmount || 0;
  const isFeatured = campaign.is_featured || campaign.isFeatured;
  const isVerified = campaign.verified || campaign.isVerified;
  const deadline = campaign.deadline || campaign.endDate;

  const pct = goal ? Math.min(100, (raised / goal) * 100) : 0;
  const daysLeft = deadline ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000) : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl overflow-hidden border border-ifborder bg-ifcard hover:border-ifcyan/40 transition-colors active:scale-[0.98] transition-transform"
    >
      {/* Image */}
      <div className="h-36 bg-zinc-800 overflow-hidden relative">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">🪐</div>
        )}
        {isFeatured && (
          <span className="absolute top-2 left-2 text-[9px] px-2 py-0.5 rounded-full bg-ifcyan/90 text-black font-bold">
            FEATURED
          </span>
        )}
        {isVerified && (
          <span className="absolute top-2 right-2 text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/90 text-white font-bold">
            ✓ VERIFIED
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-[10px] text-ifcyan capitalize mb-0.5">{category.replace("-", " ")}</p>
        <h3 className="text-sm font-bold text-iftext line-clamp-1">{title}</h3>
        <p className="text-[10px] text-ifmuted line-clamp-1">by {organizerName}</p>
        
        {/* Progress */}
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-ifmuted mb-1">
            <span className="text-ifcyan font-semibold">${raised.toLocaleString()}</span>
            <span>of ${goal.toLocaleString()}</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-ifcyan to-ifaccent" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2">
          <span className="text-[9px] text-ifmuted">{pct.toFixed(0)}% funded</span>
          {daysLeft !== null && (
            <span className={`text-[9px] ${daysLeft < 7 ? "text-rose-400" : "text-ifmuted"}`}>
              {daysLeft > 0 ? `${daysLeft}d left` : "Ended"}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
