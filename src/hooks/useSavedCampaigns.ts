/*
 * useSavedCampaigns — Save/unsave campaigns hook
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState, useCallback } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export function useSavedCampaigns(userId?: string) {
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const saveMutation = useMutation(api.savedCampaigns.saveCampaign);
  const unsaveMutation = useMutation(api.savedCampaigns.unsaveCampaign);

  const savedCampaigns = useQuery(api.savedCampaigns.getSavedCampaigns, 
    userId ? { userId } : 'skip'
  );

  const toggleSave = useCallback(async (campaignId: string) => {
    if (!userId) return;
    
    const isSaved = savedIds.includes(campaignId);
    
    if (isSaved) {
      setSavedIds((prev) => prev.filter((id) => id !== campaignId));
      await unsaveMutation({ userId, campaignId });
    } else {
      setSavedIds((prev) => [...prev, campaignId]);
      await saveMutation({ userId, campaignId, campaignTitle: "" });
    }
  }, [userId, savedIds, saveMutation, unsaveMutation]);

  const isSaved = useCallback(
    (campaignId: string) => savedIds.includes(campaignId),
    [savedIds]
  );

  return {
    savedCampaigns,
    savedIds,
    toggleSave,
    isSaved,
    count: savedIds.length,
  };
}
