/*
 * useComparison — Campaign comparison hook
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

import { useState, useCallback } from 'react';

const STORAGE_KEY = 'if-comparison';

export function useComparison() {
  const [comparisonList, setComparisonList] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const toggleComparison = useCallback((campaignId: string) => {
    setComparisonList((prev) => {
      const next = prev.includes(campaignId)
        ? prev.filter((id) => id !== campaignId)
        : [...prev, campaignId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const removeFromComparison = useCallback((campaignId: string) => {
    setComparisonList((prev) => {
      const next = prev.filter((id) => id !== campaignId);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const clearComparison = useCallback(() => {
    setComparisonList([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const isInComparison = useCallback(
    (campaignId: string) => comparisonList.includes(campaignId),
    [comparisonList]
  );

  return {
    comparisonList,
    toggleComparison,
    removeFromComparison,
    clearComparison,
    isInComparison,
    count: comparisonList.length,
  };
}
