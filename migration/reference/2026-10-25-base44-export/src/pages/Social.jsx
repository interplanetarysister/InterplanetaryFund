import React, { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Radio, Loader2, Link2, RefreshCw, Users, Newspaper } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PostComposer from "@/components/social/PostComposer";
import SocialFeed from "@/components/social/SocialFeed";
import ProfileBanner, { getTierFromScore } from "@/components/social/ProfileBanner";
import ShareToProfileDialog from "@/components/social/ShareToProfileDialog";
import AdminContentPanel from "@/components/social/AdminContentPanel";
import OfficialPublications from "@/components/social/OfficialPublications";
import ActivityFeed from "@/components/community/ActivityFeed";
import PageError from "@/components/PageError";
import { isUsableConnection } from "@/lib/connectionHealth";

export default function Social() {
  const location = useLocation();
  const imageStudioShare = location.state?.ifundImageStudio;
  const [user, setUser] = useState(null);
  const [connections, setConnections] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [providerCapabilities, setProviderCapabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(() => ["social", "community", "publications"].includes(searchParams.get("tab")) ? searchParams.get("tab") : "social");
  const [refreshKey, setRefreshKey] = useState(0);
  const [shareTarget, setShareTarget] = useState(null); // { sourceType, sourceId }

  const loadUser = useCallback(async () => {
    try {
      const maybeUser = await base44.auth.me().catch(() => null);
      if (!maybeUser) {
        // The public IFund social feed is readable without registration.
        // Composer, external connections and management remain signed-in.
        setUser(null);
        setConnections([]);
        setCampaigns([]);
        setProviderCapabilities([]);
        return;
      }
      const [u, connectionResponse, camps, capabilityResponse] = await Promise.all([
        Promise.resolve(maybeUser),
        base44.functions.invoke("listConnections", {}),
        base44.entities.Campaign.filter({}).catch(() => []),
        base44.functions.invoke("listFundraisingProviderCapabilities", {}).catch(() => ({ data: { providers: [] } })),
      ]);
      const conns = connectionResponse.data?.connections || [];
      setUser(u);
      setConnections(Array.isArray(conns) ? conns : []);
      setCampaigns(Array.isArray(camps) ? camps.filter((c) => c.status === "active" || c.status === "draft") : []);
      setProviderCapabilities(Array.isArray(capabilityResponse?.data?.providers) ? capabilityResponse.data.providers : []);
    } catch {
      setError("We couldn't load the social feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);
  useEffect(() => {
    const requested = searchParams.get("tab") || "social";
    if (["social", "community", "publications"].includes(requested)) setTab(requested);
  }, [searchParams]);

  const handlePosted = (_post, newScore, newTier) => {
    setUser((prev) => ({ ...prev, social_score: newScore, banner_tier: newTier }));
    setRefreshKey((k) => k + 1);
  };

  const handleShared = (_post, newScore, newTier) => {
    setUser((prev) => ({ ...prev, social_score: newScore, banner_tier: newTier }));
    setRefreshKey((k) => k + 1);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }
  if (error) return <PageError message={error} onRetry={() => { setError(""); setLoading(true); loadUser(); }} />;

  const currentTier = user?.banner_tier || getTierFromScore(user?.social_score || 0);
  const isAdmin = user?.role === "admin";
  // Users see only their own connections; admins see all (RLS enforces this).
  // For the sidebar, show only the user's own to keep the view clean.
  const userConnections = connections.filter((c) => c.created_by_id === user?.id);
  const connectedPlatforms = userConnections.filter(isUsableConnection);

  return (
    <div className="min-h-dvh w-full min-w-0 max-w-full overflow-x-hidden deep-space pb-24">
      <div className="w-full min-w-0 max-w-5xl mx-auto px-3 sm:px-4 py-6 pt-safe">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center glow-primary">
              <Radio className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl sm:text-2xl text-white">Interplanetary Social</h1>
              <p className="text-slate-400 text-xs">The Interplanetary Fund social universe</p>
            </div>
          </div>
          <button onClick={() => setRefreshKey((k) => k + 1)} className="text-slate-400 hover:text-cyan-300">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {/* One social hub for the feed, community, and finalized publications. */}
        <Tabs value={tab} onValueChange={(value) => { setTab(value); setSearchParams(value === "social" ? {} : { tab: value }); }} className="mb-6">
          <TabsList className="bg-white/5 border border-white/10 h-auto flex flex-wrap gap-1 p-1">
            <TabsTrigger value="social" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-200">
              <Radio className="w-3.5 h-3.5 mr-1.5" /> Social
            </TabsTrigger>
            <TabsTrigger value="community" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-200">
              <Users className="w-3.5 h-3.5 mr-1.5" /> Community
            </TabsTrigger>
            <TabsTrigger value="publications" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-200">
              <Newspaper className="w-3.5 h-3.5 mr-1.5" /> Publications
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_280px] gap-6">
          {/* Main content */}
          <div className="min-w-0 space-y-4">
            {tab === "social" ? (
              <>
                {user && (
                  <PostComposer
                    initialShare={imageStudioShare}
                    user={user}
                    connections={userConnections}
                    campaigns={campaigns}
                    providerCapabilities={providerCapabilities}
                    onPosted={handlePosted}
                  />
                )}
                {!user && <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm text-cyan-100">
                  Browse community posts below. <Link to="/login?returnTo=%2Fsocial" className="font-semibold underline">Sign in to share your own story.</Link>
                </div>}
                <SocialFeed
                  key={refreshKey}
                  user={user}
                  onShare={user ? (post) => setShareTarget({ sourceType: "social_post", sourceId: post.id }) : undefined}
                />
              </>
            ) : tab === "publications" ? (
              <OfficialPublications isAdmin={isAdmin} />
            ) : (
              <ActivityFeed />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {user && (
              <ProfileBanner tier={currentTier} socialScore={user.social_score || 0} username={user.username} />
            )}

            <div className="glass-panel rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-300 text-sm font-medium">Connected Platforms</p>
                <Link to="/connections" className="text-cyan-300 text-xs hover:underline">Manage</Link>
              </div>
              {connectedPlatforms.length === 0 ? (
                <div className="text-center py-4">
                  <Link2 className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-xs mb-3">Connect Instagram, TikTok, and more to cross-post.</p>
                  <Link to="/connections" className="text-cyan-300 text-xs font-medium hover:underline">
                    Connect platforms →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {connectedPlatforms.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {c.display_name || c.platform}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel rounded-2xl p-4">
              <p className="text-slate-300 text-sm font-medium mb-2">How Rewards Work</p>
              <div className="space-y-1.5 text-xs text-slate-400">
                <p>🪐 10 pts → Bronze banner</p>
                <p>🌙 50 pts → Silver banner</p>
                <p>⭐ 100 pts → Gold + top placement</p>
                <p>🌠 500 pts → Platinum commander</p>
              </div>
            </div>

            {/* Admin-only: AI Content Studio + all platform connections */}
            {isAdmin && (
              <>
                <AdminContentPanel onGenerated={() => setRefreshKey((k) => k + 1)} />
                <div className="glass-panel rounded-2xl p-4">
                  <p className="text-slate-300 text-sm font-medium mb-2">Admin: All Connections</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {connections.length === 0 ? (
                      <p className="text-xs text-slate-500">No platform connections.</p>
                    ) : (
                      connections.map((c) => (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-300">{c.display_name || c.platform}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            isUsableConnection(c) ? "bg-emerald-500/20 text-emerald-300" :
                            c.status === "error" || c.last_error ? "bg-rose-500/20 text-rose-300" :
                            "bg-slate-500/20 text-slate-400"
                          }`}>{isUsableConnection(c) ? "connected" : c.status === "error" ? "needs attention" : "not verified"}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Share-to-Profile dialog */}
      {shareTarget && (
        <ShareToProfileDialog
          open={!!shareTarget}
          onClose={() => setShareTarget(null)}
          sourceType={shareTarget.sourceType}
          sourceId={shareTarget.sourceId}
          user={user}
          connections={userConnections}
          providerCapabilities={providerCapabilities}
          onShared={handleShared}
        />
      )}
    </div>
  );
}