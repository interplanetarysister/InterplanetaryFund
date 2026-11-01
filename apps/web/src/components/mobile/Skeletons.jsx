import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Loading skeletons for the mobile experience — perceived performance that
// matches real content shapes instead of a bare spinner.
export function CampaignCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 overflow-hidden">
      <Skeleton className="w-full h-40 rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-2 w-full mt-2" />
        <div className="flex justify-between pt-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

export function CampaignGridSkeleton({ count = 4 }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => <CampaignCardSkeleton key={i} />)}
    </div>
  );
}

export function ListSkeleton({ count = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-stone-200/70 p-4 flex gap-3">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}