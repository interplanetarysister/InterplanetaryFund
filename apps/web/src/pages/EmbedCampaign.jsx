import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getCampaignDetail } from "@/api/publicData";
import { Image } from "@/components/ui/image";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { verifiedFundingProgress } from "@/lib/fundingTotals";

// Public iframe card for a real, active Supabase campaign only.
// No payment action runs in a third-party iframe.
export default function EmbedCampaign() {
  const { id } = useParams();
  const [view, setView] = useState({ phase: "loading", campaign: null });
  useEffect(() => {
    let live = true;
    setView({ phase: "loading", campaign: null });
    getCampaignDetail(id)
      .then(campaign => { if (live) setView({ phase: campaign ? "ready" : "missing", campaign }); })
      .catch(() => { if (live) setView({ phase: "error", campaign: null }); });
    return () => { live = false; };
  }, [id]);

  if (view.phase === "loading") return <main role="status" className="flex min-h-screen items-center justify-center bg-white text-stone-600">Loading campaign…</main>;
  if (view.phase !== "ready") return <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white p-6 text-stone-700"><p role={view.phase === "error" ? "alert" : undefined}>{view.phase === "missing" ? "Campaign unavailable." : "Unable to load this campaign."}</p><Link to="/discover" className="underline text-cyan-700">Browse campaigns</Link></main>;
  const campaign = view.campaign;
  const totals = verifiedFundingProgress(campaign);
  return <main className="mx-auto max-w-sm bg-transparent p-2">
    <a href={"/campaign/" + encodeURIComponent(campaign.id)} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg" aria-label={"View " + campaign.title + " on Interplanetary Fund in a new tab"}>
      <Image src={campaign.cover_image_url || FALLBACK_IMAGE} alt={campaign.title} className="h-40 w-full object-cover bg-stone-900" />
      <div className="space-y-3 p-4">
        <h1 className="font-display text-lg font-semibold leading-snug text-stone-900">{campaign.title}</h1>
        {campaign.summary && <p className="text-sm text-stone-600">{campaign.summary}</p>}
        {totals ? <p className="text-sm text-stone-600">${totals.raised.toLocaleString()} raised of ${totals.goal.toLocaleString()}</p> :
          <p className="text-sm text-stone-600">Verified fundraising totals are not available.</p>}
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Individual campaign donations are currently paused. Platform donations do not fund this campaign.</p>
        <span className="inline-block rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">View campaign</span>
      </div>
    </a>
    <p className="mt-2 text-center text-xs text-stone-500">Powered by Interplanetary Fund</p>
  </main>;
}
