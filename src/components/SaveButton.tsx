/*
 * Interplanetary Fund — Save Button Component
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function SaveButton({
  campaignId,
  userId,
  className = "",
}: {
  campaignId: string;
  userId: string | null;
  className?: string;
}) {
  const isSaved = useQuery(
    api.savedCampaigns.isSaved,
    userId ? { campaignId, userId } : "skip"
  );
  const saveCampaign = useMutation(api.savedCampaigns.saveCampaign);
  const unsaveCampaign = useMutation(api.savedCampaigns.unsaveCampaign);

  const handleSave = async () => {
    if (!userId) return;
    if (isSaved) {
      await unsaveCampaign({ campaignId, userId });
    } else {
      await saveCampaign({ campaignId, userId, campaignTitle: "" });
    }
  };

  return (
    <button
      onClick={handleSave}
      disabled={!userId}
      className={className}
      title={userId ? (isSaved ? "Unsave" : "Save") : "Sign in to save"}
    >
      {isSaved ? "★" : "☆"}
    </button>
  );
}
