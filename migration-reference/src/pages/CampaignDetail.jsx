import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Image } from "@/components/ui/image";
import { Badge } from "@/components/ui/badge";
import DonateDialog from "@/components/campaigns/DonateDialog";
import CampaignFundingCard from "@/components/campaigns/CampaignFundingCard";
import ShareCampaignKit from "@/components/campaigns/ShareCampaignKit";
import CrossPlatformTotals from "@/components/campaigns/CrossPlatformTotals";
import CashAppSettings from "@/components/campaigns/CashAppSettings";
import CampaignHealth from "@/components/campaigns/CampaignHealth";
import AICoach from "@/components/campaigns/AICoach";
import UpdatesSection from "@/components/campaigns/UpdatesSection";
import EditAIInstructionsDialog from "@/components/campaigns/EditAIInstructionsDialog";
import OutreachAgentPanel from "@/components/campaigns/OutreachAgentPanel";
import DistributionPanel from "@/components/distribution/DistributionPanel";
import FollowButton from "@/components/campaigns/FollowButton";
import { FALLBACK_IMAGE } from "@/components/brand/brand";
import CampaignCard, { categoryLabels } from "@/components/campaigns/CampaignCard";
import { Loader2, Heart, MapPin } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";

const isVideo = (url = "") => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [donations, setDonations] = useState([]);
  const [user, setUser] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [related, setRelated] = useState([]);

  const load = useCallback(async () => {
    const [c, u, d] = await Promise.all([
      base44.entities.Campaign.filter({ id }),
      base44.entities.CampaignUpdate.filter({ campaign_id: id }, "-created_date"),
      base44.entities.Donation.filter({ campaign_id: id }, "-created_date", 10),
    ]);
    if (!c.length) { setNotFound(true); return; }
    setCampaign(c[0]);
    setUpdates(u);
    setDonations(d);
    const rel = await base44.entities.Campaign.filter({ category: c[0].category, status: "active" }, "-raised_amount", 6);
    setRelated(rel.filter((r) => r.id !== id).slice(0, 3));
  }, [id]);

  useEffect(() => {
    load();
    base44.auth.me().then(setUser).catch(() => {});
  }, [load]);

  if (notFound) return <div className="text-center py-24 text-stone-500">Campaign not found.</div>;
  if (!campaign) return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const isOwner = user && campaign.created_by_id === user.id;
  const justDonated = new URLSearchParams(window.location.search).get("donation") === "success";

  return (
    <PullToRefresh onRefresh={load} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      {justDonated && (
        <div className="mb-6 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          Thank you for your donation! It may take a moment to appear on the campaign.
        </div>
      )}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {isVideo(campaign.cover_image_url) ? (
            <video src={campaign.cover_image_url} controls className="w-full h-56 sm:h-80 rounded-2xl object-cover" />
          ) : (
            <Image src={campaign.cover_image_url || FALLBACK_IMAGE} alt={campaign.title} className="w-full h-56 sm:h-80 rounded-2xl object-cover" />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">{categoryLabels[campaign.category] || "Other"}</Badge>
              {campaign.location && <Badge variant="outline" className="border-stone-200 text-stone-600"><MapPin className="w-3 h-3 mr-1" />{campaign.location}</Badge>}
              {campaign.status !== "active" && <Badge variant="outline" className="capitalize">{campaign.status}</Badge>}
            </div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-3xl sm:text-4xl text-stone-900 leading-tight">{campaign.title}</h1>
              {!isOwner && <FollowButton campaign={campaign} />}
            </div>
            {campaign.summary && <p className="text-stone-600 mt-2 text-lg">{campaign.summary}</p>}
          </div>
          {/* Phones: funding progress + Donate Now sit directly under the title,
              so the primary action is visible without scrolling. */}
          <CampaignFundingCard campaign={campaign} onDonate={() => setDonateOpen(true)} className="lg:hidden" />
          {campaign.story && (
            <div className="bg-white rounded-2xl border border-stone-200/70 p-6 shadow-sm">
              <h3 className="font-display text-xl text-stone-900 mb-3">The story</h3>
              <p className="text-stone-600 leading-relaxed whitespace-pre-wrap">{campaign.story}</p>
            </div>
          )}
          <UpdatesSection campaignId={campaign.id} updates={updates} isOwner={isOwner} onPosted={load} />
          {isOwner && <DistributionPanel campaign={campaign} />}
        </div>

        {/* Sidebar */}
        <div className="space-y-5 lg:sticky lg:top-8 self-start">
          <CampaignFundingCard campaign={campaign} onDonate={() => setDonateOpen(true)} className="hidden lg:block" />

          <ShareCampaignKit campaign={campaign} />

          {isOwner && <CrossPlatformTotals campaign={campaign} />}

          {donations.length > 0 && (
            <div className="bg-white rounded-2xl border border-stone-200/70 p-5 shadow-sm">
              <h3 className="font-display text-lg text-stone-900 mb-3">Recent supporters</h3>
              <ul className="space-y-3">
                {donations.map((d) => (
                  <li key={d.id} className="text-sm">
                    <p className="text-stone-800"><span className="font-medium">{d.donor_name || "Anonymous"}</span> · <span className="text-primary font-semibold">${d.amount.toLocaleString()}</span>{d.is_recurring && <span className="text-stone-400 text-xs"> /mo</span>}</p>
                    {d.message && <p className="text-stone-500 text-xs mt-0.5">"{d.message}"</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isOwner && <CashAppSettings campaign={campaign} onSaved={load} />}
          {isOwner && <EditAIInstructionsDialog campaign={campaign} onSaved={load} />}
          {isOwner && <OutreachAgentPanel campaign={campaign} />}
          {isOwner && <CampaignHealth campaign={campaign} updatesCount={updates.length} />}
          {isOwner && <AICoach campaign={campaign} updatesCount={updates.length} />}
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
        aria-label="Donate"
      >
        <Heart className="w-5 h-5" /> Donate
      </button>
      )}
      <DonateDialog campaign={campaign} onDonated={load} hideTrigger open={donateOpen} onOpenChange={setDonateOpen} />
    </PullToRefresh>
  );
}