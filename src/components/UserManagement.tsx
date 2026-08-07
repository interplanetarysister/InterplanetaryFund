/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * User Management Panel — Admin only
 * View users, toggle AI cross-posting, request account access, manage platforms
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function UserManagement() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState("");

  // Queries
  const users = useQuery(
    api.userManagement.getUserList,
    unlocked ? { adminPin: pin } : "skip"
  );
  const userDetails = useQuery(
    api.userManagement.getUserDetails,
    unlocked && selectedUser ? { adminPin: pin, userId: selectedUser } : "skip"
  );
  const fbStatus = useQuery(
    api.userManagement.getFacebookAgentStatus,
    unlocked ? { adminPin: pin } : "skip"
  );
  const fbCoverage = useQuery(
    api.userManagement.getFacebookGroupCoverage,
    unlocked ? { adminPin: pin } : "skip"
  );

  // Mutations
  const toggleAi = useMutation(api.userManagement.toggleAiCrossPosting);
  const toggleStandard = useMutation(api.userManagement.toggleStandardCrossPosting);
  const requestAccess = useMutation(api.userManagement.requestAccountAccess);
  const revokeAccess = useMutation(api.userManagement.revokeAccountAccess);
  const linkPlatform = useMutation(api.userManagement.linkUserPlatform);
  const unlinkPlatform = useMutation(api.userManagement.unlinkUserPlatform);

  const handleUnlock = () => {
    if (pin.length >= 4) {
      setUnlocked(true);
      setError("");
    }
  };

  const handleToggleAi = async (userId: string, current: boolean) => {
    setError(""); setSuccess("");
    try {
      await toggleAi({ adminPin: pin, userId, enabled: !current });
      setSuccess(`AI cross-posting ${!current ? "enabled" : "disabled"} for user.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleToggleStandard = async (userId: string, current: boolean) => {
    setError(""); setSuccess("");
    try {
      await toggleStandard({ adminPin: pin, userId, enabled: !current });
      setSuccess(`Standard cross-posting ${!current ? "enabled" : "disabled"} for user.`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRequestAccess = async (userId: string) => {
    setError(""); setSuccess("");
    try {
      const result = await requestAccess({
        adminPin: pin,
        userId,
        message: accessMessage || undefined,
      });
      setSuccess("Access request sent to user via inbox.");
      setAccessMessage("");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRevoke = async (userId: string) => {
    try {
      await revokeAccess({ adminPin: pin, userId });
      setSuccess("Admin access revoked.");
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleUnlink = async (platformId: string) => {
    if (!confirm("Unlink this platform?")) return;
    try {
      await unlinkPlatform({ adminPin: pin, platformId: platformId as any });
      setSuccess("Platform unlinked.");
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (!unlocked) {
    return (
      <div className="space-y-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-iftext mb-2">User Management</h3>
          <p className="text-xs text-ifmuted mb-4">
            Enter your PIN to manage users, AI cross-posting, and account access.
          </p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            className="input-field text-center text-xl tracking-[0.3em] font-bold"
            autoFocus
          />
          <button onClick={handleUnlock} disabled={pin.length < 4} className="btn-primary mt-3">
            Unlock User Panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Messages */}
      {error && (
        <div className="bg-ifred/10 border border-ifred/30 rounded-xl p-3">
          <p className="text-xs text-ifred">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-ifgreen/10 border border-ifgreen/30 rounded-xl p-3">
          <p className="text-xs text-ifgreen">{success}</p>
        </div>
      )}

      {/* Facebook Agent Verification */}
      {fbStatus && (
        <div className="card border-ifcyan/20">
          <h3 className="text-sm font-semibold text-ifcyan mb-3">Facebook Agent Status</h3>
          
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-ifdark rounded-xl p-2 text-center">
              <p className="text-xs text-ifmuted">Connection</p>
              <p className={`text-sm font-semibold ${fbStatus.facebookConnected ? "text-ifgreen" : "text-ifred"}`}>
                {fbStatus.facebookConnected ? "Connected" : "Not Connected"}
              </p>
              {fbStatus.facebookUserName !== "Not connected" && (
                <p className="text-[10px] text-ifmuted">{fbStatus.facebookUserName}</p>
              )}
            </div>
            <div className="bg-ifdark rounded-xl p-2 text-center">
              <p className="text-xs text-ifmuted">Profile Name</p>
              <p className="text-sm font-semibold text-iftext">
                {fbStatus.agent?.name ?? "Atlas"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-ifdark rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-ifaccent">{fbStatus.totalGroupsDiscovered}</p>
              <p className="text-[10px] text-ifmuted">Discovered</p>
            </div>
            <div className="bg-ifdark rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-ifgreen">{fbStatus.totalGroupsJoined}</p>
              <p className="text-[10px] text-ifmuted">Joined</p>
            </div>
            <div className="bg-ifdark rounded-xl p-2 text-center">
              <p className="text-lg font-bold text-ifamber">{fbStatus.totalGroupsPending}</p>
              <p className="text-[10px] text-ifmuted">Pending</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-ifdark rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-ifcyan">{fbStatus.totalPostsPublished}</p>
              <p className="text-[10px] text-ifmuted">Posts Published</p>
            </div>
            <div className="bg-ifdark rounded-xl p-2 text-center">
              <p className="text-sm font-bold text-ifred">{fbStatus.totalPostsFailed}</p>
              <p className="text-[10px] text-ifmuted">Posts Failed</p>
            </div>
          </div>
        </div>
      )}

      {/* Category Coverage */}
      {fbCoverage && (
        <div className="card">
          <h3 className="text-sm font-semibold text-iftext mb-3">Group Coverage by Category</h3>
          <p className="text-[10px] text-ifmuted mb-2">
            Target: 50 groups per category. Categories in red need more discovery.
          </p>
          
          <div className="space-y-1">
            {fbCoverage.coverage.map((c: any) => (
              <div key={c.category} className="flex items-center justify-between bg-ifdark rounded-lg px-2 py-1.5">
                <span className="text-[10px] text-iftext">{c.category}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold ${
                    c.needsMore ? "text-ifred" : "text-ifgreen"
                  }`}>
                    {c.groupsFound}/{c.target}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${c.needsMore ? "bg-ifred" : "bg-ifgreen"}`} />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-2 pt-2 border-t border-ifborder flex justify-between text-[10px]">
            <span className="text-ifmuted">Total: {fbCoverage.totalGroups} groups</span>
            <span className="text-ifgreen">{fbCoverage.coverage.filter((c: any) => !c.needsMore).length} categories complete</span>
          </div>
        </div>
      )}

      {/* User List */}
      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Users</h3>
        
        {!users && (
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {users && users.length === 0 && (
          <p className="text-xs text-ifmuted text-center py-4">No users yet.</p>
        )}

        {users && users.map((u: any) => (
          <div key={u.userId} className="bg-ifdark rounded-xl p-3 mb-2 border border-ifborder">
            {/* User header */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-iftext">{u.name}</p>
                <p className="text-[10px] text-ifmuted">{u.email || u.userId}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                u.adminAccessStatus === "granted" ? "bg-ifgreen/20 text-ifgreen" :
                u.adminAccessStatus === "requested" ? "bg-ifamber/20 text-ifamber" :
                u.adminAccessStatus === "denied" ? "bg-ifred/20 text-ifred" :
                "bg-ifborder text-ifmuted"
              }`}>
                {u.adminAccessStatus?.toUpperCase()}
              </span>
            </div>

            {/* User stats */}
            <div className="flex gap-3 text-[10px] text-ifmuted mb-2">
              <span>Balance: ${u.totalBalance?.toFixed(2) || 0}</span>
              <span>Platforms: {u.platformCount}</span>
              <span>Campaigns: {u.campaignCount}</span>
            </div>

            {/* Subscription badges */}
            <div className="flex gap-1 mb-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                u.subscriptionTier === "campaign_manager" 
                  ? "bg-ifaccent/20 text-ifaccent" 
                  : "bg-ifborder text-ifmuted"
              }`}>
                {u.subscriptionTier === "campaign_manager" ? "Campaign Manager" : "Standard"}
              </span>
              {u.aiCrossPostingEnabled && (
                <span className="px-1.5 py-0.5 rounded bg-ifcyan/20 text-ifcyan text-[10px]">AI Auto</span>
              )}
            </div>

            {/* AI Cross-posting toggles */}
            <div className="space-y-1 mb-2">
              <button
                onClick={() => handleToggleAi(u.userId, u.aiCrossPostingEnabled)}
                className={`w-full py-2 rounded-lg text-[10px] font-medium border ${
                  u.aiCrossPostingEnabled
                    ? "bg-ifaccent/10 text-ifaccent border-ifaccent/30"
                    : "bg-ifdark text-ifmuted border-ifborder"
                }`}
              >
                {u.aiCrossPostingEnabled ? "AI Cross-Posting: ON" : "AI Cross-Posting: OFF"}
                <span className="text-ifmuted ml-1">(Campaign Manager)</span>
              </button>
              
              <button
                onClick={() => handleToggleStandard(u.userId, u.standardCrossPostingEnabled)}
                className={`w-full py-2 rounded-lg text-[10px] font-medium border ${
                  u.standardCrossPostingEnabled
                    ? "bg-ifcyan/10 text-ifcyan border-ifcyan/30"
                    : "bg-ifdark text-ifmuted border-ifborder"
                }`}
              >
                {u.standardCrossPostingEnabled ? "Standard Cross-Posting: ON" : "Standard Cross-Posting: OFF"}
                <span className="text-ifmuted ml-1">(half frequency)</span>
              </button>
            </div>

            {/* Account access controls */}
            <div className="flex gap-2">
              {u.adminAccessStatus !== "granted" && u.adminAccessStatus !== "requested" && (
                <button
                  onClick={() => handleRequestAccess(u.userId)}
                  className="flex-1 py-1.5 rounded-lg bg-ifamber/10 text-ifamber text-[10px] font-medium border border-ifamber/30"
                >
                  Request Access
                </button>
              )}
              {u.adminAccessStatus === "requested" && (
                <span className="flex-1 py-1.5 text-center text-[10px] text-ifamber">
                  Awaiting user response...
                </span>
              )}
              {u.adminAccessStatus === "granted" && (
                <>
                  <button
                    onClick={() => setSelectedUser(selectedUser === u.userId ? null : u.userId)}
                    className="flex-1 py-1.5 rounded-lg bg-ifcyan/10 text-ifcyan text-[10px] font-medium border border-ifcyan/30"
                  >
                    Manage Account
                  </button>
                  <button
                    onClick={() => handleRevoke(u.userId)}
                    className="px-3 py-1.5 rounded-lg bg-ifred/10 text-ifred text-[10px] font-medium border border-ifred/30"
                  >
                    Revoke
                  </button>
                </>
              )}
            </div>

            {/* Expanded account management */}
            {selectedUser === u.userId && u.adminAccessStatus === "granted" && userDetails && (
              <div className="mt-3 pt-3 border-t border-ifborder space-y-2">
                <p className="text-[10px] text-ifmuted font-semibold">Linked Platforms:</p>
                {userDetails.platforms && userDetails.platforms.length > 0 ? (
                  userDetails.platforms.map((p: any) => (
                    <div key={p._id} className="flex items-center justify-between bg-ifdark rounded-lg px-2 py-1.5">
                      <div>
                        <p className="text-[10px] text-iftext">{p.platform} — {p.displayName}</p>
                        <p className="text-[10px] text-ifmuted">{p.status}</p>
                      </div>
                      {p.status === "connected" && (
                        <button
                          onClick={() => handleUnlink(p._id)}
                          className="text-[10px] text-ifred"
                        >
                          Unlink
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-ifmuted">No platforms linked.</p>
                )}
                
                {/* Campaigns */}
                {userDetails.campaigns && userDetails.campaigns.length > 0 && (
                  <div className="pt-2 border-t border-ifborder">
                    <p className="text-[10px] text-ifmuted font-semibold">Campaigns:</p>
                    {userDetails.campaigns.map((c: any) => (
                      <div key={c._id} className="flex items-center justify-between bg-ifdark rounded-lg px-2 py-1.5 mt-1">
                        <p className="text-[10px] text-iftext">{c.title}</p>
                        <span className={`text-[10px] ${c.frozen ? "text-ifred" : "text-ifgreen"}`}>
                          {c.frozen ? "FROZEN" : c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payouts */}
                {userDetails.payouts && userDetails.payouts.length > 0 && (
                  <div className="pt-2 border-t border-ifborder">
                    <p className="text-[10px] text-ifmuted font-semibold">Recent Payouts:</p>
                    {userDetails.payouts.slice(0, 3).map((p: any) => (
                      <div key={p._id} className="flex items-center justify-between bg-ifdark rounded-lg px-2 py-1.5 mt-1">
                        <p className="text-[10px] text-iftext">${p.netAmount?.toFixed(2)}</p>
                        <span className="text-[10px] text-ifmuted">
                          {p.adminReviewStatus || p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Security note */}
      <div className="text-center py-2">
        <p className="text-[10px] text-ifmuted">
          Account access requires user consent. Users can revoke access at any time.
        </p>
      </div>
    </div>
  );
}
