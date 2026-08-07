/*
 * Interplanetary Fund — Unified Platform Dashboard
 * Copyright © 2026 Michelle Rogers. All Rights Reserved.
 *
 * "Connected Stations" — Monitor all crowdfunding platforms in one place.
 * Single-click publishing to all connected platforms.
 * Engagement metrics per platform. Post queue management.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const PLATFORM_INFO: Record<string, { name: string; icon: string; color: string }> = {
  facebook: { name: "Facebook", icon: "f", color: "#1877f2" },
  bluesky: { name: "Bluesky", icon: "☁", color: "#0085ff" },
  twitter: { name: "Twitter/X", icon: "𝕏", color: "#ffffff" },
  gofundme: { name: "GoFundMe", icon: "💚", color: "#4ade80" },
  instagram: { name: "Instagram", icon: "📷", color: "#e4405f" },
  kickstarter: { name: "Kickstarter", icon: "KS", color: "#05ce78" },
  cashapp: { name: "CashApp", icon: "$", color: "#00d632" },
  paypal: { name: "PayPal", icon: "P", color: "#003087" },
};

export default function PlatformDashboard({ userId }: { userId: string }) {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<any>(null);

  // Fetch user campaigns
  const myCampaigns = useQuery(api.userCampaigns.getMyCampaigns, { userId });
  // Fetch all distributed posts
  const allPosts = useQuery(api.postContent.getDistributedPosts, {});
  // Fetch external platforms
  const externalPlatforms = useQuery(api.campaigns.getExternalPlatforms, {});

  const generatePosts = useMutation(api.aiCampaignGen.generatePlatformPosts);

  // Group posts by platform
  const postsByPlatform = (allPosts || []).reduce((acc: Record<string, any[]>, post: any) => {
    if (!acc[post.platform]) acc[post.platform] = [];
    acc[post.platform].push(post);
    return acc;
  }, {});

  // Connected platforms from both system and external
  const connectedPlatforms = new Set([
    ...Object.keys(postsByPlatform),
    ...(externalPlatforms || []).map((p: any) => p.platform),
  ]);

  const handlePublishAll = async () => {
    if (!selectedCampaign) return;
    setPublishing(true);
    setPublishResult(null);
    try {
      const campaign = myCampaigns?.find((c: any) => c._id === selectedCampaign);
      if (!campaign) return;

      const platforms = Array.from(connectedPlatforms);
      if (platforms.length === 0) {
        setPublishResult({ status: "error", message: "No connected platforms found" });
        return;
      }

      const result = await generatePosts({
        campaignId: selectedCampaign,
        campaignTitle: campaign.title,
        campaignSummary: campaign.summary || "",
        platforms,
      });

      setPublishResult(result);
    } catch (e) {
      setPublishResult({ status: "error", message: "Failed to generate posts" });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-iftext">Connected Stations</span>
        <span className="text-[10px] text-ifcyan ml-auto">
          {connectedPlatforms.size} platforms linked
        </span>
      </div>

      {/* Platform Status Grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from(connectedPlatforms).map((platform) => {
          const info = PLATFORM_INFO[platform] || { name: platform, icon: "📡", color: "#888" };
          const platformPosts = postsByPlatform[platform] || [];
          const posted = platformPosts.filter((p: any) => p.status === "posted");
          const pending = platformPosts.filter((p: any) => p.status === "pending");
          const totalReactions = posted.reduce((s: number, p: any) => s + (p.reactions || 0), 0);
          const totalComments = posted.reduce((s: number, p: any) => s + (p.comments || 0), 0);
          const totalShares = posted.reduce((s: number, p: any) => s + (p.shares || 0), 0);

          return (
            <div key={platform} className="card p-3">
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                  style={{ background: `${info.color}20`, color: info.color }}
                >
                  {info.icon}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-iftext">{info.name}</p>
                  <p className="text-[9px] text-ifmuted">
                    {posted.length} posted · {pending.length} pending
                  </p>
                </div>
                <div className={`w-2 h-2 rounded-full ${pending.length > 0 ? "bg-ifamber" : "bg-ifgreen"}`} />
              </div>
              {(totalReactions + totalComments + totalShares > 0) && (
                <div className="flex gap-2 text-[9px] text-ifmuted">
                  <span>❤️ {totalReactions}</span>
                  <span>💬 {totalComments}</span>
                  <span>↗ {totalShares}</span>
                </div>
              )}
            </div>
          );
        })}

        {connectedPlatforms.size === 0 && (
          <div className="col-span-2 card text-center py-6">
            <p className="text-xs text-ifmuted">No stations connected yet</p>
            <p className="text-[10px] text-ifmuted mt-1">Posts will appear here once campaigns are published</p>
          </div>
        )}
      </div>

      {/* Single-Click Publishing */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-iftext">Single-Click Broadcast</h3>
        <p className="text-[11px] text-ifmuted">Select a campaign and post to all connected platforms at once</p>

        <select
          value={selectedCampaign}
          onChange={(e) => setSelectedCampaign(e.target.value)}
          className="input-field"
        >
          <option value="">Select a campaign...</option>
          {(myCampaigns || []).map((c: any) => (
            <option key={c._id} value={c._id}>{c.title}</option>
          ))}
        </select>

        <button
          onClick={handlePublishAll}
          disabled={!selectedCampaign || publishing}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-ifaccent to-ifcyan text-white text-sm font-bold"
        >
          {publishing ? "Broadcasting to all stations..." : `📡 Post to All ${connectedPlatforms.size} Platforms`}
        </button>

        {publishResult && (
          <div className={`rounded-lg p-3 text-xs ${publishResult.status === "success" ? "bg-ifgreen/10 text-ifgreen" : "bg-ifred/10 text-ifred"}`}>
            {publishResult.status === "success" ? (
              <>
                <p className="font-semibold">✓ Broadcast sent to {publishResult.platforms.length} platforms</p>
                <div className="mt-2 space-y-1">
                  {Object.entries(publishResult.content).map(([platform, content]: [string, any]) => (
                    <div key={platform} className="bg-ifdark rounded p-2">
                      <p className="text-[10px] text-ifcyan font-semibold">{PLATFORM_INFO[platform]?.name || platform}</p>
                      <p className="text-[10px] text-ifmuted mt-0.5 whitespace-pre-wrap">{content.substring(0, 100)}...</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p>{publishResult.message}</p>
            )}
          </div>
        )}
      </div>

      {/* Recent Posts */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-iftext">Recent Broadcasts</h3>
        {(allPosts || [])
          .filter((p: any) => p.status !== "system" && p.platform !== "health_monitor")
          .slice(0, 10)
          .map((post: any) => (
            <div key={post._id} className="card p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-iftext">{post.campaignTitle}</span>
                <span className="text-[9px] text-ifmuted ml-auto">
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-ifcyan">{PLATFORM_INFO[post.platform]?.name || post.platform}</span>
                <span className={`text-[9px] px-2 py-0.5 rounded-full ${
                  post.status === "posted" ? "bg-ifgreen/10 text-ifgreen" :
                  post.status === "pending" ? "bg-ifamber/10 text-ifamber" :
                  "bg-ifred/10 text-ifred"
                }`}>
                  {post.status}
                </span>
                {post.reactions ? (
                  <span className="text-[9px] text-ifmuted">❤️ {post.reactions} · 💬 {post.comments || 0} · ↗ {post.shares || 0}</span>
                ) : null}
              </div>
              <p className="text-[10px] text-ifmuted mt-1 whitespace-pre-wrap">
                {post.content?.substring(0, 120)}...
              </p>
            </div>
          ))}
        {(!allPosts || allPosts.filter((p: any) => p.status !== "system" && p.platform !== "health_monitor").length === 0) && (
          <div className="card text-center py-4">
            <p className="text-[11px] text-ifmuted">No broadcasts yet. Use Single-Click Broadcast above to publish.</p>
          </div>
        )}
      </div>
    </div>
  );
}
