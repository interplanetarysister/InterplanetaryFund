import React, { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { getCampaignDetail, listRelatedCampaigns } from "@/api/publicData";
import { Image } from "@/components/ui/image";
import { Badge } from "@/components/ui/badge";
import CampaignFundingCard from "@/components/campaigns/CampaignFundingCard";
import CampaignShareTools from "@/components/campaigns/CampaignShareTools";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import CampaignCard, { categoryLabels } from "@/components/campaigns/CampaignCard";
import { Loader2, Heart, MapPin } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import PrelaunchNotice from "@/components/prelaunch/PrelaunchNotice";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import PageError from "@/components/PageError";

const isVideo = (url = "") => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);

// Public-site port of the Base44 CampaignDetail page. Owner and admin tools
// (editing, distribution, outreach agents, AI coach, translations, follow,
// share kit, supporter list, donation dialog) need a signed-in member and are
// not part of this slice. Campaign checkout stays disabled while campaign
// donations are paused.
export default function CampaignDetail() {
  const platformOnlyMode = !usePublicCampaignFundraising();
  const { id } = useParams();
  const location = useLocation();
  const [campaign, setCampaign] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState("");
  const requestVersion = React.useRef(0);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setError("");
    setNotFound(false);
    setCampaign(null);
    setRelated([]);
    try {
      const c = await getCampaignDetail(id);
      if (version !== requestVersion.current) return;
      if (!c) { setNotFound(true); setCampaign(null); return; }
      setNotFound(false);
      setCampaign(c);
      const rel = await listRelatedCampaigns(c.category, c.id).catch(() => []);
      if (version === requestVersion.current) setRelated(rel || []);
    } catch {
      if (version === requestVersion.current) setError("We couldn't load this campaign. Please try again.");
    }
  }, [id]);

  useEffect(() => { load(); return () => { requestVersion.current += 1; }; }, [load]);

  useEffect(() => {
    if (!campaign || !location.hash) return;
    const targetId = location.hash.slice(1);
    if (!/^campaign-[a-z-]+$/.test(targetId)) return;
    const frame = window.requestAnimationFrame(() => {
      const responsiveId = targetId === "campaign-funding"
        ? (window.matchMedia("(min-width: 1024px)").matches ? "campaign-funding-desktop" : "campaign-funding-mobile")
        : targetId;
      const section = document.getElementById(responsiveId);
      if (section) {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
        section.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [campaign?.id, location.hash, location.key]);

  if (error) return <PageError message={error} onRetry={load} />;
  if (notFound) return <div className="text-center py-24 text-stone-500">Campaign not found.</div>;
  if (!campaign) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const displayed = campaign;
  const textDirection = "auto";
  const scrollToFunding = () => {
    const section = document.getElementById("campaign-funding-mobile");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    section?.focus({ preventScroll: true });
  };

  return (
    <PullToRefresh onRefresh={load} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {platformOnlyMode && <PrelaunchNotice className="mb-6" />}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {isVideo(campaign.cover_image_url) ? (
            <video src={campaign.cover_image_url} controls className="w-full max-h-[36rem] rounded-2xl object-contain bg-slate-950" />
          ) : (
            <><Image src={campaign.cover_image_url || FALLBACK_IMAGE} alt={displayed.title} className="w-full max-h-[36rem] rounded-2xl object-contain bg-slate-950" /> {campaign.cover_image_is_ai && <p className="text-xs text-muted-foreground mt-2">AI-generated illustration · People shown may represent the campaign subjects.</p>}</>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">{categoryLabels[campaign.category] || "Other"}</Badge>
              {campaign.location && <Badge variant="outline" className="border-stone-200 text-stone-600"><MapPin className="w-3 h-3 mr-1" />{campaign.location}</Badge>}
              {campaign.status && campaign.status !== "active" && <Badge variant="outline" className="capitalize">{campaign.status}</Badge>}
              {campaign.preview_only && <Badge variant="outline" className="border-amber-300 text-amber-800">Preview</Badge>}
            </div>
            <div className="flex items-start justify-between gap-3">
              <h1 dir={textDirection} className="font-display text-3xl sm:text-4xl font-black text-slate-950 leading-tight drop-shadow-[0_1px_0_rgba(255,255,255,.75)]">{displayed.title}</h1>
            </div>
            {displayed.summary && <p dir={textDirection} className="text-slate-800 mt-2 text-lg font-medium leading-relaxed whitespace-pre-wrap">{displayed.summary}</p>}
          </div>
          {/* Phones: funding progress sits directly under the title. */}
          <div id="campaign-funding-mobile" tabIndex={-1} className="scroll-mt-24 lg:hidden">
            <CampaignFundingCard campaign={campaign} />
          </div>
          {displayed.story && (
            <div id="campaign-story" tabIndex={-1} className="scroll-mt-24 bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
              <h3 className="font-display text-xl text-stone-900 mb-3">The story</h3>
              <p dir={textDirection} className="text-stone-600 leading-relaxed whitespace-pre-wrap">{displayed.story}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5 lg:sticky lg:top-8 self-start">
          <div id="campaign-funding-desktop" tabIndex={-1} className="scroll-mt-24 hidden lg:block">
            <CampaignFundingCard campaign={campaign} />
          </div>
          <CampaignShareTools campaign={campaign} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-2xl text-stone-900 mb-4">Related campaigns</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {related.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </div>
        </section>
      )}

      {/* Mobile floating button keeps the original look; with checkout paused it
          scrolls to the funding card and its notice instead of opening checkout. */}
      <button
        onClick={scrollToFunding}
        className="lg:hidden fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 h-14 px-6 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 text-white font-semibold shadow-lg shadow-blue-500/30 flex items-center gap-2 active:scale-95 transition-transform"
        aria-label={platformOnlyMode ? "Campaign donations are paused. Show funding details" : "Donate"}
      >
        <span className="flex flex-col items-center leading-tight"><span className="flex items-center gap-2"><Heart className="w-5 h-5" /> {platformOnlyMode ? "Support IF" : "Donate"}</span>{platformOnlyMode && <span className="text-[10px] font-medium opacity-90">Platform, not campaign</span>}</span>
      </button>
    </PullToRefresh>
  );
}
