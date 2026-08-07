/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function FacebookGroups() {
  const campaigns = useQuery(api.campaigns.getAllCampaigns, {});
  const dashboard = useQuery(api.facebook.getOutreachDashboard, {});
  const allGroups = useQuery(api.facebook.getAllDiscoveredGroups, {});
  const allPosts = useQuery(api.facebook.getAllPosts, {});

  const connectFacebook = useMutation(api.facebook.connectFacebook);
  const disconnectFacebook = useMutation(api.facebook.disconnectFacebook);
  const discoverGroups = useMutation(api.facebook.discoverGroups);
  const requestJoin = useMutation(api.facebook.requestJoinGroup);
  const bulkRequestJoin = useMutation(api.facebook.bulkRequestJoin);
  const confirmJoined = useMutation(api.facebook.confirmGroupJoined);
  const bulkConfirmJoined = useMutation(api.facebook.bulkConfirmJoined);
  const bulkCreatePosts = useMutation(api.facebook.bulkCreateGroupPosts);
  const markPostPosted = useMutation(api.facebook.markPostPosted);
  const markPostFailed = useMutation(api.facebook.markPostFailed);

  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [facebookConnected, setFacebookConnected] = useState(false);
  const [fbUserName, setFbUserName] = useState("");
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [hideZeroMembers, setHideZeroMembers] = useState(true);

  if (!campaigns || !dashboard || !allGroups || !allPosts) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeCampaigns = campaigns.filter((c: any) => c.status === "active");

  const handleConnectFacebook = () => {
    // In production this would trigger OAuth flow
    // For now we simulate the connection
    const userId = "current_user";
    connectFacebook({
      userId,
      facebookUserId: "fb_user_123",
      facebookUserName: "Connected User",
      accessToken: "simulated_token",
      permissions: ["publish_to_groups", "groups_access_member_info", "user_managed_groups"],
    }).then(() => {
      setFacebookConnected(true);
      setFbUserName("Connected User");
    });
  };

  const handleDiscover = async () => {
    if (!selectedCampaign) return;
    const campaign = activeCampaigns.find((c: any) => c.ifCampaignId === selectedCampaign);
    if (!campaign) return;

    setIsDiscovering(true);
    // Discovery targets are seeded by the protocol auto-fix system
    // based on campaign categories and stored in the facebookGroups table
    try {
      await discoverGroups({
        campaignId: campaign.ifCampaignId,
        campaignTitle: campaign.title,
        campaignCategory: campaign.category || "general",
        groups: [],
      });
    } catch (e) {
      alert("Discovery failed. Please try again.");
    }
    setIsDiscovering(false);
  };

  const handleJoinSelected = async () => {
    const groupIds = Array.from(selectedGroupIds) as any[];
    if (groupIds.length === 0) return;
    await bulkRequestJoin({ groupIds });
    setSelectedGroupIds(new Set());
  };

  const handleConfirmJoined = async (groupId: any) => {
    await confirmJoined({ groupId });
  };

  const handlePostToAll = async () => {
    if (!selectedCampaign || !postContent) return;
    const campaign = activeCampaigns.find((c: any) => c.ifCampaignId === selectedCampaign);
    if (!campaign) return;

    // Get all joined groups for this campaign
    const joinedGroups = allGroups.groups.filter(
      (g: any) => g.campaignId === selectedCampaign && g.joinStatus === "joined"
    );

    if (joinedGroups.length === 0) {
      alert("No joined groups to post to. Join groups first.");
      return;
    }

    setIsPosting(true);
    try {
      await bulkCreatePosts({
        campaignId: campaign.ifCampaignId,
        campaignTitle: campaign.title,
        postType: "campaign_launch",
        postContent,
        targetGroupIds: joinedGroups.map((g: any) => g._id),
      });
      setPostContent("");
    } catch (e) {
      alert("Posting failed. Please try again.");
    }
    setIsPosting(false);
  };

  const toggleGroupSelection = (id: string) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Facebook Connection Status */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ifaccent/20 border border-ifaccent/30 flex items-center justify-center text-lg">📡</div>
            <div>
              <h3 className="text-sm font-semibold text-iftext">Facebook Outreach</h3>
              <p className="text-xs text-ifmuted">
                {facebookConnected ? `Connected as ${fbUserName}` : "Connect to enable group outreach"}
              </p>
            </div>
          </div>
          {!facebookConnected ? (
            <button
              onClick={handleConnectFacebook}
              className="px-4 py-2 rounded-xl bg-ifaccent text-white text-xs font-semibold active:scale-[0.98] transition-transform"
            >
              Connect
            </button>
          ) : (
            <span className="text-xs text-ifgreen font-semibold">● Connected</span>
          )}
        </div>
      </div>

      {/* Dashboard Stats */}
      {facebookConnected && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center">
              <p className="text-2xl font-bold text-ifcyan">{dashboard.groups.total}</p>
              <p className="text-[10px] text-ifmuted mt-1">Groups Found</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-ifgreen">{dashboard.groups.joined}</p>
              <p className="text-[10px] text-ifmuted mt-1">Groups Joined</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-ifaccent">{dashboard.posts.posted}</p>
              <p className="text-[10px] text-ifmuted mt-1">Posts Published</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-ifyellow">{dashboard.groups.totalReach.toLocaleString()}</p>
              <p className="text-[10px] text-ifmuted mt-1">Total Reach</p>
            </div>
          </div>

          {/* Campaign Selector */}
          <div>
            <label className="text-xs text-ifmuted mb-1 block">Select Campaign</label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="w-full bg-ifborder rounded-xl px-3 py-2.5 text-iftext text-sm outline-none"
            >
              <option value="">Choose a campaign...</option>
              {activeCampaigns.map((c: any) => (
                <option key={c._id} value={c.ifCampaignId}>{c.title}</option>
              ))}
            </select>
          </div>

          {/* Discover Groups */}
          {selectedCampaign && (
            <button
              onClick={handleDiscover}
              disabled={isDiscovering}
              className="w-full py-3 rounded-xl bg-ifaccent text-white text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDiscovering ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Finding groups...
                </>
              ) : (
                "🔍 Find Facebook Groups"
              )}
            </button>
          )}

          {/* Discovered Groups */}
          {allGroups.groups.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-iftext">Discovered Groups</h3>
                {selectedGroupIds.size > 0 && (
                  <button
                    onClick={handleJoinSelected}
                    className="px-3 py-1.5 rounded-lg bg-ifaccent text-white text-xs font-semibold"
                  >
                    Join Selected ({selectedGroupIds.size})
                  </button>
                )}
              </div>

              {(() => {
                const zeroCount = allGroups.groups.filter((g: any) => g.memberCount === 0 && (!selectedCampaign || g.campaignId === selectedCampaign)).length;
                const visibleCount = allGroups.groups.filter((g: any) => (!selectedCampaign || g.campaignId === selectedCampaign) && (!hideZeroMembers || g.memberCount > 0)).length;
                return (
                  <>
                    {zeroCount > 0 && (
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-ifmuted">{visibleCount} groups shown{hideZeroMembers ? `, ${zeroCount} hidden (0 members)` : ""}</p>
                        <button
                          onClick={() => setHideZeroMembers(!hideZeroMembers)}
                          className="text-[10px] text-ifaccent font-medium"
                        >
                          {hideZeroMembers ? `Show ${zeroCount} empty groups` : "Hide empty groups"}
                        </button>
                      </div>
                    )}
                    <div className="space-y-3">
                );
              })()}
                {allGroups.groups
                  .filter((g: any) => (!selectedCampaign || g.campaignId === selectedCampaign) && (!hideZeroMembers || g.memberCount > 0))
                  .map((g: any) => (
                  <div key={g._id} className="card space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-iftext">{g.groupName}</h4>
                        <p className="text-[10px] text-ifmuted mt-0.5">
                          {g.memberCount.toLocaleString()} members · {g.groupCategory}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          g.relevanceScore >= 80 ? "bg-ifgreen/20 text-ifgreen" :
                          g.relevanceScore >= 60 ? "bg-ifyellow/20 text-ifyellow" :
                          "bg-ifmuted/20 text-ifmuted"
                        }`}>
                          {g.relevanceScore}% match
                        </span>
                      </div>
                    </div>

                    {g.groupDescription && (
                      <p className="text-xs text-ifmuted line-clamp-2">{g.groupDescription}</p>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        g.joinStatus === "joined" ? "bg-ifgreen/20 text-ifgreen" :
                        g.joinStatus === "join_requested" ? "bg-ifyellow/20 text-ifyellow" :
                        g.joinStatus === "rejected" ? "bg-red-500/20 text-red-400" :
                        "bg-ifborder text-ifmuted"
                      }`}>
                        {g.joinStatus === "join_requested" ? "Join Requested" :
                         g.joinStatus === "joined" ? "Joined" :
                         g.joinStatus === "rejected" ? "Rejected" :
                         "Discovered"}
                      </span>

                      <div className="flex gap-2">
                        {g.joinStatus === "discovered" && (
                          <>
                            <label className="flex items-center gap-1 text-[10px] text-ifmuted cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedGroupIds.has(g._id)}
                                onChange={() => toggleGroupSelection(g._id)}
                                className="w-3 h-3 accent-ifaccent"
                              />
                              Select
                            </label>
                            <button
                              onClick={() => requestJoin({ groupId: g._id })}
                              className="text-[10px] text-ifaccent font-semibold"
                            >
                              Request Join
                            </button>
                          </>
                        )}
                        {g.joinStatus === "join_requested" && (
                          <button
                            onClick={() => handleConfirmJoined(g._id)}
                            className="text-[10px] text-ifgreen font-semibold"
                          >
                            ✓ Confirm Joined
                          </button>
                        )}
                        {g.joinStatus === "joined" && (
                          <span className="text-[10px] text-ifmuted">
                            {g.postsCount} posts
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Post Composer */}
          {allGroups.groups.some((g: any) => g.joinStatus === "joined" && (!selectedCampaign || g.campaignId === selectedCampaign)) && (
            <div className="card space-y-3">
              <h3 className="text-sm font-semibold text-iftext">Post to Joined Groups</h3>
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="Write your campaign post... Include your story, goal, and donation link."
                rows={4}
                className="w-full bg-ifborder rounded-xl px-3 py-2.5 text-iftext text-sm outline-none resize-none"
              />
              <button
                onClick={handlePostToAll}
                disabled={!postContent || isPosting}
                className="w-full py-3 rounded-xl bg-ifaccent text-white text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPosting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Posting...
                  </>
                ) : (
                  "📢 Post to All Joined Groups"
                )}
              </button>
            </div>
          )}

          {/* Recent Posts */}
          {allPosts.posts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-iftext mb-3">Recent Posts</h3>
              <div className="space-y-2">
                {allPosts.posts.slice(0, 10).map((p: any) => (
                  <div key={p._id} className="card space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-iftext">{p.groupName}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        p.postStatus === "posted" ? "bg-ifgreen/20 text-ifgreen" :
                        p.postStatus === "pending" ? "bg-ifyellow/20 text-ifyellow" :
                        p.postStatus === "failed" ? "bg-red-500/20 text-red-400" :
                        "bg-ifborder text-ifmuted"
                      }`}>
                        {p.postStatus}
                      </span>
                    </div>
                    <p className="text-xs text-ifmuted line-clamp-2">{p.postContent}</p>
                    {p.postStatus === "posted" && (
                      <div className="flex gap-3 text-[10px] text-ifmuted pt-1">
                        <span>👍 {p.reactions}</span>
                        <span>💬 {p.comments}</span>
                        <span>↗ {p.shares}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!facebookConnected && (
        <div className="card text-center py-12">
          <div className="w-16 h-16 rounded-full bg-ifaccent/20 border border-ifaccent/30 flex items-center justify-center mx-auto mb-3">
            <span class="text-3xl">📡</span>
          </div>
          <h3 className="text-sm font-semibold text-iftext">Facebook Group Outreach</h3>
          <p className="text-xs text-ifmuted mt-1 max-w-xs mx-auto">
            Connect your Facebook account to let your AI agent discover and join groups likely to donate to your campaigns.
          </p>
          <div className="mt-4 space-y-2 text-left max-w-xs mx-auto">
            <p className="text-[10px] text-ifmuted">1. Connect Facebook account</p>
            <p className="text-[10px] text-ifmuted">2. Agent finds relevant groups</p>
            <p className="text-[10px] text-ifmuted">3. Agent joins and posts campaigns</p>
            <p className="text-[10px] text-ifmuted">4. Track engagement and donations</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Group discovery uses real Convex data seeded by the protocol auto-fix system.
