import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getCampaignDetail } from "@/api/publicData";
import { Image } from "@/components/ui/image";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import { verifiedCampaignProgress } from "@/lib/campaignProgress";
import { Loader2 } from "lucide-react";

// Public iframe card. The canonical public API returns active campaigns only.
// It never reads migration shadows, displays estimated donation totals, or
// initiates payment inside a third-party iframe.
export default function EmbedCampaign() {
  const { id } = useParams();
  const [state, setState] = useState({ status: "loading", campaign: null });
  useEffect(() => {
    let active = true;
    setState({ status: "loading", campaign: null });
    getCampaignDetail(id).then(campaign => {
      if (active) setState(campaign
        ? { status: "ready", campaign }
        : { status: "unavailable", campaign: null });
    }).catch(() => {
      if (active) setState({ status: "error", campaign: null });
    });
    return () => { active = false; };
  }, [id]);

  if (state.status === "loading") return (
    <main role="status" className="flex min-h-screen items-center justify-center bg-white text-slate-700">
      <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-cyan-600" />
      <span className="sr-only">Loading campaign</span>
    </main>
  );
  if (state.status !== "ready") return (
    <main className="flex min-h-screen items-center justify-center bg-white p-6 text-center text-sm text-stone-600">
      <div>
        <p role={state.status === "error" ? "alert" : undefined}>
          {state.status === "error" ? "Campaign details are temporarily unavailable." : "Campaign unavailable."}
        </p>
        <a href="/discover" target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-cyan-700 underline">
          Browse campaigns →
        </a>
      </div>
    </main>
  );

  const campaign = state.campaign;
  const progress = verifiedCampaignProgress(campaign);
  const href = `/campaign/${encodeURIComponent(campaign.id)}`;

  return (
    <main className="mx-auto w-full max-w-sm bg-transparent p-2 font-body">
      <a href={href} target="_blank" rel="noopener noreferrer"
        aria-label={`View ${campaign.title} on Interplanetary Fund (opens in a new tab)`}
        className="block overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
        <div className="relative h-40">
          <Image src={campaign.cover_image_url || FALLBACK_IMAGE} alt={campaign.title} className="h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
        <div className="space-y-3 p-4">
          <h1 className="line-clamp-2 font-display text-lg text-stone-900">{campaign.title}</h1>
          {campaign.summary && <p className="line-clamp-2 text-xs text-stone-600">{campaign.summary}</p>}
          {progress ? (
            <div>
              <p className="mb-1 flex justify-between gap-2 text-xs text-stone-700">
                <span>${progress.raised.toLocaleString()} raised</span>
                <span>{Math.round(progress.percent)}% of ${progress.goal.toLocaleString()}</span>
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-600" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-stone-600">Verified donation totals are not available.</p>
          )}
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            Campaign donations are paused. Viewing this campaign does not make a payment.
          </p>
          <span className="inline-flex min-h-11 items-center rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 px-4 py-2 text-sm font-semibold text-white">
            View campaign ↗
          </span>
        </div>
      </a>
      <p className="mt-2 text-center text-[10px] text-stone-500">Powered by Interplanetary Fund</p>
    </main>
  );
}
