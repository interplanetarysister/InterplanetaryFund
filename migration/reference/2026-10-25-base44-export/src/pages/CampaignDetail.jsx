import React, { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Badge } from "@/components/ui/badge";
import DonateDialog from "@/components/campaigns/DonateDialog";
import CampaignTranslation from "@/components/campaigns/CampaignTranslation";
import CampaignFundingCard from "@/components/campaigns/CampaignFundingCard";
import ShareCampaignKit from "@/components/campaigns/ShareCampaignKit";
import CrossPlatformTotals from "@/components/campaigns/CrossPlatformTotals";
import CashAppSettings from "@/components/campaigns/CashAppSettings";
import CryptoCampaignSettings from "@/components/campaigns/CryptoCampaignSettings";
import CampaignHealth from "@/components/campaigns/CampaignHealth";
import ImportedCampaignSync from "@/components/campaigns/ImportedCampaignSync";
import AICoach from "@/components/campaigns/AICoach";
import UpdatesSection from "@/components/campaigns/UpdatesSection";
import EditAIInstructionsDialog from "@/components/campaigns/EditAIInstructionsDialog";
import EditCampaignDetailsDialog from "@/components/campaigns/EditCampaignDetailsDialog";
import DeleteCampaignButton from "@/components/campaigns/DeleteCampaignButton";
import OutreachAgentPanel from "@/components/campaigns/OutreachAgentPanel";
import DistributionPanel from "@/components/distribution/DistributionPanel";
import FollowButton from "@/components/campaigns/FollowButton";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import CampaignCard, { categoryLabels } from "@/components/campaigns/CampaignCard";
import { Loader2, Heart, MapPin } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import PrelaunchNotice from "@/components/prelaunch/PrelaunchNotice";
import { usePublicCampaignFundraising } from "@/lib/useFundraisingMode";
import PageError from "@/components/PageError";

const isVideo = (url = "") => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);

export default function CampaignDetail() {
  const platformOnlyMode = !usePublicCampaignFundraising();
  const { id } = useParams();
  const location = useLocation();
  const [campaign, setCampaign] = useState(null);
  const [translation, setTranslation] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [donations, setDonations] = useState([]);
  const [user, setUser] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [related, setRelated] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [c, u, dRes] = await Promise.all([
        base44.entities.Campaign.filter({ id }),
        base44.entities.CampaignUpdate.filter({ campaign_id: id }, "-created_date"),
        base44.functions.invoke("getCampaignDonations", { campaign_id: id }),
      ]);
      if (!c.length) { setNotFound(true); setCampaign(null); return; }
      setNotFound(false);
      setCampaign(c[0]);
      setUpdates(Array.isArray(u) ? u : []);
      setDonations((dRes.data && dRes.data.donations) ? dRes.data.donations.slice(0, 10) : []);
      const rel = await base44.entities.Campaign.filter({ category: c[0].category, status: "active" }, "-raised_amount", 6).catch(() => []);
      setRelated((rel || []).filter((r) => r.id !== id).slice(0, 3));
    } catch {
      setError("We couldn't load this campaign. Please try again.");
    }
  }, [id]);

  useEffect(() => {
    load();
    base44.auth.me().then(setUser).catch(() => {});
  }, [load]);

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
        if (targetId !== "campaign-settings") section.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [campaign?.id, user?.id, location.hash, location.key]);

  if (error) return <PageError message={error} onRetry={load} />;
  if (notFound) return <div className="text-center py-24 text-stone-500">Campaign not found.</div>;
  if (!campaign) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const displayed = translation || campaign;
  const textDirection = translation?.language_code === "ar" ? "rtl" : "auto";
  const isOwner = user && campaign.created_by_id === user.id;
  // Embed/share controls are a management capability — visible only to the
  // authenticated campaign owner or an admin (authorized manager). Never shown
  // on the public donation experience.
  const canManage = !!user && (campaign.created_by_id === user.id || user.role === "admin");
  const justDonated = new URLSearchParams(window.location.search).get("donation") === "success";

  return (
    <PullToRefresh onRefresh={load} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {justDonated && (
        <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          "Thank you. Verified campaign donations are reflected in the campaign total; separate platform-support donations are not credited to this campaign."
        </div>
      )}
      {platformOnlyMode && <PrelaunchNotice className="mb-6" />}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {isVideo(campaign.cover_image_url) ? (
            <video src={campaign.cover_image_url} controls className="w-full max-h-[36rem] rounded-2xl object-contain bg-slate-950" />
          ) : (
<>             <Image src={campaign.cover_image_url || FALLBACK_IMAGE} alt={displayed.title} className="w-full max-h-[36rem] rounded-2xl object-contain bg-slate-950" /> {campaign.cover_image_is_ai && <p className="text-xs text-muted-foreground mt-2">AI-generated illustration · People shown may represent the campaign subjects.</p>}</>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">{categoryLabels[campaign.category] || "Other"}</Badge>
              {campaign.location && <Badge variant="outline" className="border-stone-200 text-stone-600"><MapPin className="w-3 h-3 mr-1" />{campaign.location}</Badge>}
              {campaign.status !== "active" && <Badge variant="outline" className="capitalize">{campaign.status}</Badge>}
            </div>
            <div className="mb-4"><CampaignTranslation campaign={campaign} canManage={canManage} onChange={setTranslation} /></div>
            <div className="flex items-start justify-between gap-3">
              <h1 dir={textDirection} className="font-display text-3xl sm:text-4xl font-black text-slate-950 leading-tight drop-shadow-[0_1px_0_rgba(255,255,255,.75)]">{displayed.title}</h1>
              {!isOwner && <FollowButton campaign={campaign} />}
            </div>
            {displayed.summary && <p dir={textDirection} className="text-slate-800 mt-2 text-lg font-medium leading-relaxed whitespace-pre-wrap">{displayed.summary}</p>}
          </div>
          {/* Phones: funding progress + Donate Now sit directly under the title,
              so the primary action is visible without scrolling. */}
          <div id="campaign-funding-mobile" tabIndex={-1} className="scroll-mt-24 lg:hidden">
            <CampaignFundingCard campaign={campaign} onDonate={() => setDonateOpen(true)} />
          </div>
          {displayed.story && (
            <div id="campaign-story" tabIndex={-1} className="scroll-mt-24 bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
              <h3 className="font-display text-xl text-stone-900 mb-3">The story</h3>
              <p dir={textDirection} className="text-stone-600 leading-relaxed whitespace-pre-wrap">{displayed.story}</p>
            </div>
          )}
          <section id="campaign-updates" tabIndex={-1} className="scroll-mt-24">
            <UpdatesSection campaign={campaign} campaignId={campaign.id} updates={updates} isOwner={isOwner} onPosted={load} />
          </section>
          {isOwner && <section id="campaign-distribution" tabIndex={-1} className="scroll-mt-24">
            <DistributionPanel campaign={campaign} />
          </section>}
        </div>

        {/* Sidebar */}
        <div className="space-y-5 lg:sticky lg:top-8 self-start">
          <div id="campaign-funding-desktop" tabIndex={-1} className="scroll-mt-24 hidden lg:block">
            <CampaignFundingCard campaign={campaign} onDonate={() => setDonateOpen(true)} />
          </div>

          {canManage && <div id="campaign-share" tabIndex={-1} className="scroll-mt-24">
            <ShareCampaignKit campaign={campaign} />
          </div>}

          {isOwner && <CrossPlatformTotals campaign={campaign} />}

          {donations.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
              <h3 className="font-display text-lg text-stone-900 mb-3">Recent supporters</h3>
              <ul className="space-y-3">
                {donations.map((d, i) => (
                  <li key={i} className="text-sm">
                    <p className="text-stone-800"><span className="font-medium">{d.donor_name || "Anonymous"}</span> · <span className="text-primary font-semibold">${d.amount.toLocaleString()}</span>{d.is_recurring && <span className="text-stone-400 text-xs"> /mo</span>}</p>
                    {d.message && <p className="text-stone-500 text-xs mt-0.5">"{d.message}"</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isOwner && <ImportedCampaignSync campaign={campaign} onSynced={load} />}
          {isOwner && <CashAppSettings campaign={campaign} onSaved={load} />}
          {canManage && <CryptoCampaignSettings campaign={campaign} onSaved={load} />}
          {canManage && <div id="campaign-settings" tabIndex={-1} className="scroll-mt-24">
            <EditCampaignDetailsDialog campaign={campaign} onSaved={load} />
          </div>}
          {isOwner && <div id="campaign-instructions" tabIndex={-1} className="scroll-mt-24">
            <EditAIInstructionsDialog campaign={campaign} onSaved={load} />
          </div>}
          {isOwner && <div id="campaign-outreach" tabIndex={-1} className="scroll-mt-24">
            <OutreachAgentPanel campaign={campaign} />
          </div>}
          {isOwner && <div id="campaign-health" tabIndex={-1} className="scroll-mt-24">
            <CampaignHealth campaign={campaign} updatesCount={updates.length} />
          </div>}
          {isOwner && <div id="campaign-ai" tabIndex={-1} className="scroll-mt-24">
            <AICoach campaign={campaign} updatesCount={updates.length} />
          </div>}
          {isOwner && <DeleteCampaignButton campaign={campaign} />}
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

      {/* Mobile floating donate button — hidden while the payment sheet is open
          so it never covers the donation dialog. */}
      {!donateOpen && (
      <button
        onClick={() => setDonateOpen(true)}
        className="lg:hidden fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 h-14 px-6 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 text-white font-semibold shadow-lg shadow-blue-500/30 flex items-center gap-2 active:scale-95 transition-transform"
        aria-label={platformOnlyMode ? "Support Interplanetary Fund (not this campaign)" : "Donate"}
      >
        <span className="flex flex-col items-center leading-tight"><span className="flex items-center gap-2"><Heart className="w-5 h-5" /> {platformOnlyMode ? "Support IF" : "Donate"}</span>{platformOnlyMode && <span className="text-[10px] font-medium opacity-90">Platform, not campaign</span>}</span>
      </button>
      )}
      <DonateDialog campaign={campaign} onDonated={load} hideTrigger open={donateOpen} onOpenChange={setDonateOpen} />
    </PullToRefresh>
  );
}