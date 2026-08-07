/*
 * Interplanetary Fund — User Profile Page
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * Based on fundforge/src/pages/Profile.jsx — adapted for Convex backend
 * with Interplanetary Fund branding.
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import CampaignCard from "../components/CampaignCard";
import EmptyState from "../components/EmptyState";

export default function Profile({
  userId,
  userName,
  onNavigate,
  onViewCampaign,
}: {
  userId: string | null;
  userName: string;
  onNavigate?: (view: string) => void;
  onViewCampaign?: (id: string) => void;
}) {
  const myCampaigns = useQuery(
    api.userCampaigns.getMyCampaigns,
    userId ? { userId } : "skip"
  );
  const allDonations = useQuery(api.campaigns.getDonations, {});

  if (!userId) {
    return (
      <div className="p-6 max-w-4xl mx-auto pb-20">
        <EmptyState
          icon="👤"
          title="Sign in to view your profile"
          subtitle="Your campaigns, donations, and impact will appear here."
          action={
            <button
              onClick={() => onNavigate?.("login")}
              className="px-4 py-2 rounded-full bg-ifaccent text-ifwhite text-sm font-medium"
            >
              Sign In
            </button>
          }
        />
      </div>
    );
  }

  // Calculate total donated by this user
  const myDonations = (allDonations || []).filter(
    (d: any) => d.userId === userId || d.donorName === userName
  );
  const totalDonated = myDonations.reduce((s: number, d: any) => s + (d.amount || 0), 0);
  const supportedIds = [...new Set(myDonations.map((d: any) => d.campaignId || d.campaign_id).filter(Boolean))];

  const allCampaigns = useQuery(api.userCampaigns.getActiveCampaigns, {});
  const supportedCampaigns = (allCampaigns || []).filter((c: any) =>
    supportedIds.includes(c._id)
  );

  const name = userName || "Interplanetary Pilot";
  const initials = name.slice(0, 1).toUpperCase();

  return (
    <div className="p-6 max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="rounded-2xl border border-ifborder bg-gradient-to-br from-ifcard to-ifdark p-6 mb-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-ifaccent/5 to-ifcyan/5 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-ifcyan to-ifaccent flex items-center justify-center text-2xl font-bold text-black border-2 border-ifcyan/30 shadow-lg">
              {initials}
            </div>
            <span className="absolute -bottom-1 -right-1 text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Online
            </span>
          </div>
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl font-bold text-iftext">{name}</h1>
            <p className="text-xs text-ifcyan mt-1">Interplanetary Pilot</p>
            <div className="flex gap-2 justify-center sm:justify-start mt-3">
              <button
                onClick={() => onNavigate?.("settings")}
                className="text-xs bg-ifcard border border-ifborder text-iftext px-3 py-1.5 rounded-full hover:border-ifcyan/30 transition-colors"
              >
                ⚙️ Edit Profile
              </button>
              <button
                onClick={() => onNavigate?.("aiwizard")}
                className="text-xs bg-ifaccent text-ifwhite px-3 py-1.5 rounded-full font-medium"
              >
                🚀 New Campaign
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-ifcyan">{myCampaigns?.length || 0}</p>
          <p className="text-[10px] text-ifmuted mt-0.5">Campaigns Posted</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-ifaccent">{supportedCampaigns.length}</p>
          <p className="text-[10px] text-ifmuted mt-0.5">Campaigns Supported</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-ifgreen">${totalDonated.toLocaleString()}</p>
          <p className="text-[10px] text-ifmuted mt-0.5">Total Donated</p>
        </div>
      </div>

      {/* Top Causes */}
      {supportedCampaigns.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-iftext mb-3">🌟 My Top Causes</h2>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {supportedCampaigns.slice(0, 6).map((c: any) => (
              <button
                key={c._id}
                onClick={() => onViewCampaign?.(c._id)}
                className="block text-center"
              >
                <div className="aspect-square rounded-lg overflow-hidden border border-ifborder bg-ifcard">
                  {c.coverImageUrl ? (
                    <img src={c.coverImageUrl} alt={c.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg">🪐</div>
                  )}
                </div>
                <p className="text-[9px] text-ifmuted line-clamp-1 mt-1">{c.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* My Campaigns */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-iftext mb-3">🚀 My Campaigns</h2>
        {myCampaigns === undefined ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : myCampaigns.length === 0 ? (
          <EmptyState
            icon="🚀"
            title="No campaigns yet"
            subtitle="Launch your first campaign to start raising funds."
            action={
              <button
                onClick={() => onNavigate?.("aiwizard")}
                className="px-4 py-2 rounded-full bg-ifaccent text-ifwhite text-sm font-medium"
              >
                🚀 Create Campaign
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {myCampaigns.map((c: any) => (
              <CampaignCard key={c._id} campaign={c} onClick={() => onViewCampaign?.(c._id)} />
            ))}
          </div>
        )}
      </div>

      {/* Campaigns I Support */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-iftext mb-3">❤️ Campaigns I Support</h2>
        {supportedCampaigns.length === 0 ? (
          <EmptyState
            icon="❤️"
            title="No donations yet"
            subtitle="Discover campaigns and make your first contribution."
            action={
              <button
                onClick={() => onNavigate?.("explore")}
                className="px-4 py-2 rounded-full bg-ifcyan text-black text-sm font-medium"
              >
                🔍 Discover Campaigns
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {supportedCampaigns.map((c: any) => (
              <CampaignCard key={c._id} campaign={c} onClick={() => onViewCampaign?.(c._id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
