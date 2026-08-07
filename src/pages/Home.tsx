/*
 * Interplanetary Fund — Home / Mission Control
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * The landing page — features a glowing Earth on deep space background,
 * live stats, and quick actions. Implements the Interplanetary branding:
 * "Welcome to Mission Control — your interplanetary fundraising command center."
 */

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

import earthHero from "/earth-hero.png";

export default function Home({ onNavigate, userId, onViewCampaign }: { 
  onNavigate?: (view: string) => void;
  userId?: string | null;
  onViewCampaign?: (campaignId: string) => void;
}) {
  const stats = useQuery(api.campaigns.getCampaignStats, {});
  const balances = useQuery(api.treasury.aggregateBalances, {});
  const userCampaigns = useQuery(api.userCampaigns.getActiveCampaigns, {});

  const totalRaised = balances?.grandTotal?.raised || 0;
  const totalDonors = balances?.grandTotal?.donors || 0;
  const activeCount = stats?.activeCount || 0;
  const campaignCount = userCampaigns?.length || 0;



  return (
    <div className="space-y-5">
      {/* Hero — Glowing Earth on Deep Space */}
      <div className="relative rounded-2xl overflow-hidden border border-ifborder" style={{ height: "340px" }}>
        <img src={earthHero} alt="Earth from deep space" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ifdark via-ifdark/30 to-transparent" />
        
        {/* Overlay text */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 z-10">
          <div className="text-center px-4 bg-gradient-to-t from-ifdark/90 via-ifdark/40 to-transparent pt-16 w-full">
            <h1 className="text-2xl font-bold text-ifwhite" style={{ textShadow: "0 0 20px rgba(34, 211, 238, 0.5)" }}>
              Interplanetary Fund
            </h1>
            <p className="text-sm text-ifcyan mt-1" style={{ textShadow: "0 0 10px rgba(34, 211, 238, 0.3)" }}>
              Your interplanetary fundraising command center
            </p>
          </div>
        </div>
      </div>

      {/* Mission Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card text-center py-4">
          <p className="text-xl font-bold text-ifcyan" style={{ textShadow: "0 0 8px rgba(34, 211, 238, 0.3)" }}>
            ${totalRaised.toLocaleString()}
          </p>
          <p className="text-[10px] text-ifmuted mt-0.5">Total Fuel</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xl font-bold text-ifaccent" style={{ textShadow: "0 0 8px rgba(139, 92, 246, 0.3)" }}>
            {activeCount}
          </p>
          <p className="text-[10px] text-ifmuted mt-0.5">In Orbit</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-xl font-bold text-ifgreen">
            {totalDonors}
          </p>
          <p className="text-[10px] text-ifmuted mt-0.5">Pilots</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-iftext">Mission Control</h2>
        
        {userId ? (
          <button
            onClick={() => onNavigate?.("aiwizard")}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-ifaccent/20 to-ifcyan/10 border border-ifaccent/30 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-lg bg-ifaccent/20 flex items-center justify-center text-lg">
              🚀
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-iftext">Launch New Campaign</p>
              <p className="text-[10px] text-ifmuted">AI-powered campaign creation wizard</p>
            </div>
            <span className="text-ifcyan text-xs">→</span>
          </button>
        ) : (
          <button
            onClick={() => onNavigate?.("login")}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-ifaccent/20 to-ifcyan/10 border border-ifaccent/30 flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-lg bg-ifaccent/20 flex items-center justify-center text-lg">
              🚀
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-iftext">Start Your Mission</p>
              <p className="text-[10px] text-ifmuted">Sign in to create and manage campaigns</p>
            </div>
            <span className="text-ifcyan text-xs">→</span>
          </button>
        )}

        <button
          onClick={() => onNavigate?.("explore")}
          className="w-full p-4 rounded-xl bg-ifcard border border-ifborder flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-lg bg-ifcyan/10 flex items-center justify-center text-lg">
            🔍
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-iftext">Discover Campaigns</p>
            <p className="text-[10px] text-ifmuted">{campaignCount} active launch pads across the universe</p>
          </div>
          <span className="text-ifmuted text-xs">→</span>
        </button>

        <button
          onClick={() => onNavigate?.("globe")}
          className="w-full p-4 rounded-xl bg-ifcard border border-ifborder flex items-center gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="w-10 h-10 rounded-lg bg-ifblue/10 flex items-center justify-center text-lg">
            🌍
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold text-iftext">Live Earth View</p>
            <p className="text-[10px] text-ifmuted">Interactive 3D globe — NASA Blue Marble</p>
          </div>
          <span className="text-ifmuted text-xs">→</span>
        </button>

        {userId && (
          <button
            onClick={() => onNavigate?.("platforms")}
            className="w-full p-4 rounded-xl bg-ifcard border border-ifborder flex items-center gap-3 active:scale-[0.98] transition-transform"
          >
            <div className="w-10 h-10 rounded-lg bg-ifaccent/10 flex items-center justify-center text-lg">
              📡
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-iftext">Connected Stations</p>
              <p className="text-[10px] text-ifmuted">Monitor and post to all crowdfunding platforms</p>
            </div>
            <span className="text-ifmuted text-xs">→</span>
          </button>
        )}
      </div>

      {/* Mission Brief */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-iftext mb-2">Mission Brief</h3>
        <p className="text-xs text-ifmuted leading-relaxed">
          Interplanetary Fund is an AI-powered fundraising platform that unifies all your
          crowdfunding campaigns in one command center. Create campaigns with AI assistance,
          auto-generate content for every platform, and post to all connected stations with
          a single click. Every contribution gets us closer to orbit.
        </p>
      </div>

      {/* Footer */}
      <div className="text-center pt-2 pb-4">
        <p className="text-[10px] text-ifmuted">
          Fuel the mission. Every contribution gets us closer to orbit.
        </p>
        <p className="text-[9px] text-ifmuted mt-1">
          © 2026 Michelle Rogers. All Rights Reserved.
        </p>
      </div>
    </div>
  );
}
