import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/dashboard/StatCard";
import MissionControl from "@/components/dashboard/MissionControl";
import FollowFeed from "@/components/dashboard/FollowFeed";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import { CampaignGridSkeleton } from "@/components/mobile/Skeletons";
import CampaignCard from "@/components/campaigns/CampaignCard";
import BrandHero from "@/components/brand/BrandHero";
import { DollarSign, Users, Flame, PlusCircle, Loader2, Sparkles } from "lucide-react";

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState(null);
  const [user, setUser] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      const me = await base44.auth.me();
      setUser(me);
      const mine = await base44.entities.Campaign.filter({ created_by_id: me.id }, "-created_date");
      setCampaigns(mine);
    })();
  }, [refreshKey]);

  if (!campaigns) {
    return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><CampaignGridSkeleton count={4} /></div>;
  }

  const needsOnboarding = !user?.onboarding_completed;

  const totalRaised = campaigns.reduce((s, c) => s + (c.raised_amount || 0), 0);
  const totalDonors = campaigns.reduce((s, c) => s + (c.donor_count || 0), 0);
  const active = campaigns.filter((c) => c.status === "active").length;

  return (
    <PullToRefresh onRefresh={() => setRefreshKey((k) => k + 1)} className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <BrandHero firstName={user?.full_name ? user.full_name.split(" ")[0] : ""} />

      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-stone-500 mb-1">Every gift you receive, in one place</p>
          <h1 className="font-display text-3xl sm:text-4xl text-stone-900">Your Interplanetary Fund</h1>
        </div>
        <Link to="/create">
          <Button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/20 hover:opacity-90">
            <PlusCircle className="w-4 h-4 mr-2" /> New Campaign
          </Button>
        </Link>
      </div>

      {needsOnboarding && (
        <Link to="/onboarding" className="block mb-6">
          <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 text-white p-4">
            <span className="shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </span>
            <div className="flex-1">
              <p className="font-medium text-sm">Set up your intelligent fundraising OS</p>
              <p className="text-xs text-white/80">Connect platforms, activate the AI Growth Engine, and automate your fundraising.</p>
            </div>
            <PlusCircle className="w-5 h-5 shrink-0" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Raised" value={`$${totalRaised.toLocaleString()}`} icon={DollarSign} />
        <StatCard label="Supporters" value={totalDonors.toLocaleString()} icon={Users} />
        <StatCard label="Active Campaigns" value={active} icon={Flame} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="font-display text-xl text-stone-900 mb-4">Your campaigns</h2>
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-stone-300 p-10 text-center">
              <p className="font-display text-lg text-stone-700 mb-1">What if you started today?</p>
              <p className="text-sm text-stone-500 mb-5">Open your Interplanetary Fund and start receiving support now.</p>
              <Link to="/create"><Button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 hover:opacity-90">Start your own Interplanetary Fund</Button></Link>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
            </div>
          )}
        </div>
        <div>
          <FollowFeed />
          <MissionControl campaigns={campaigns} />
        </div>
      </div>
    </PullToRefresh>
  );
}