/*
 * Interplanetary Fund — Campaign Card Skeleton
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 */

export default function CampaignCardSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden border border-ifborder bg-ifcard animate-pulse">
      <div className="h-36 bg-zinc-800" />
      <div className="p-3">
        <div className="h-3 w-16 bg-zinc-800 rounded mb-2" />
        <div className="h-4 w-full bg-zinc-800 rounded mb-1" />
        <div className="h-3 w-20 bg-zinc-800 rounded mb-3" />
        <div className="h-1.5 w-full bg-zinc-800 rounded-full mb-2" />
        <div className="flex justify-between">
          <div className="h-2 w-12 bg-zinc-800 rounded" />
          <div className="h-2 w-8 bg-zinc-800 rounded" />
        </div>
      </div>
    </div>
  );
}
