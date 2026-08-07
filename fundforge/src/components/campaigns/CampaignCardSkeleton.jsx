export default function CampaignCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="h-40 bg-white/[0.03] animate-pulse" />
      <div className="p-5 space-y-3">
        <div className="h-3 w-16 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-4 w-3/4 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-3 w-full bg-white/[0.04] rounded animate-pulse" />
        <div className="h-3 w-2/3 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-2 w-full bg-white/[0.04] rounded animate-pulse" />
        <div className="h-8 mt-2 bg-white/[0.04] rounded animate-pulse" />
      </div>
    </div>
  );
}