import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import ActivityFeedCard from "./ActivityFeedCard";
import { Loader2 } from "lucide-react";
import PageError from "@/components/PageError";

// Live Community activity feed. Loaded from the getCommunityFeed backend
// function, which applies server-side privacy filtering (guests see public
// events only) and returns sanitized display fields. Supports cursor
// pagination via "Load more". Works for both guests and signed-in users.
export default function ActivityFeed() {
  const [items, setItems] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await base44.functions.invoke("getCommunityFeed", { limit: 20 });
      const data = res.data || {};
      setItems(data.items || []);
      setCursor(data.next_cursor || null);
      setHasMore(!!data.next_cursor);
    } catch (e) {
      console.error("Activity feed load failed:", e?.name || "UnknownError");
      setError("We couldn't load the feed. Please try again.");
      setItems([]);
    }
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await base44.functions.invoke("getCommunityFeed", { limit: 20, before: cursor });
      const data = res.data || {};
      setItems((prev) => [...prev, ...(data.items || [])]);
      setCursor(data.next_cursor || null);
      setHasMore(!!data.next_cursor);
    } catch (e) { /* keep existing items */ }
    setLoadingMore(false);
  };

  if (error && (!items || items.length === 0)) {
    return <PageError message={error} onRetry={() => { setError(null); setItems(null); setRefreshKey((k) => k + 1); }} />;
  }
  if (!items) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }
  if (items.length === 0) {
    return <p className="text-sm text-stone-400 text-center py-16">No activity yet — be the first to start a campaign or post an update!</p>;
  }
  return (
    <div>
      <div className="space-y-3">
        {items.map((e) => <ActivityFeedCard key={e.id} event={e} />)}
      </div>
      {hasMore && (
        <div className="flex justify-center mt-6">
          <button onClick={loadMore} disabled={loadingMore} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-70 disabled:bg-muted min-h-[44px]">
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}