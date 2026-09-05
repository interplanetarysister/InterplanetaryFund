/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * User Management Panel — authenticated admin session only.
 */

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function UserManagement({ sessionId }: { sessionId: string }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState("");

  const sessionArgs = { sessionId: sessionId as any };
  const users = useQuery(api.userManagement.getUserList, sessionArgs);
  const userDetails = useQuery(
    api.userManagement.getUserDetails,
    selectedUser ? { sessionId: sessionId as any, userId: selectedUser } : "skip"
  );
  const fbStatus = useQuery(api.userManagement.getFacebookAgentStatus, sessionArgs);
  const fbCoverage = useQuery(api.userManagement.getFacebookGroupCoverage, sessionArgs);

  const toggleAi = useMutation(api.userManagement.toggleAiCrossPosting);
  const toggleStandard = useMutation(api.userManagement.toggleStandardCrossPosting);
  const requestAccess = useMutation(api.userManagement.requestAccountAccess);
  const revokeAccess = useMutation(api.userManagement.revokeAccountAccess);
  const unlinkPlatform = useMutation(api.userManagement.unlinkUserPlatform);

  const reportError = (e: any) => setError(e?.message || "The admin operation failed.");

  const handleToggleAi = async (userId: string, current: boolean) => {
    setError(""); setSuccess("");
    try {
      await toggleAi({ sessionId: sessionId as any, userId, enabled: !current });
      setSuccess(`AI cross-posting ${!current ? "enabled" : "disabled"} for user.`);
    } catch (e) { reportError(e); }
  };

  const handleToggleStandard = async (userId: string, current: boolean) => {
    setError(""); setSuccess("");
    try {
      await toggleStandard({ sessionId: sessionId as any, userId, enabled: !current });
      setSuccess(`Standard cross-posting ${!current ? "enabled" : "disabled"} for user.`);
    } catch (e) { reportError(e); }
  };

  const handleRequestAccess = async (userId: string) => {
    setError(""); setSuccess("");
    try {
      await requestAccess({ sessionId: sessionId as any, userId, message: accessMessage || undefined });
      setSuccess("Access request sent to the user's inbox.");
      setAccessMessage("");
    } catch (e) { reportError(e); }
  };

  const handleRevoke = async (userId: string) => {
    setError(""); setSuccess("");
    try {
      await revokeAccess({ sessionId: sessionId as any, userId });
      setSuccess("Administrative account access revoked.");
    } catch (e) { reportError(e); }
  };

  const handleUnlink = async (platformId: string) => {
    if (!confirm("Unlink this platform?")) return;
    setError(""); setSuccess("");
    try {
      await unlinkPlatform({ sessionId: sessionId as any, platformId: platformId as any });
      setSuccess("Platform unlinked.");
    } catch (e) { reportError(e); }
  };

  return (
    <div className="space-y-4">
      {error && <div className="bg-ifred/10 border border-ifred/30 rounded-xl p-3"><p className="text-xs text-ifred">{error}</p></div>}
      {success && <div className="bg-ifgreen/10 border border-ifgreen/30 rounded-xl p-3"><p className="text-xs text-ifgreen">{success}</p></div>}

      {fbStatus && (
        <div className="card border-ifcyan/20">
          <h3 className="text-sm font-semibold text-ifcyan mb-3">Facebook Agent Status</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-ifdark rounded-xl p-2 text-center">
              <p className="text-xs text-ifmuted">Connection</p>
              <p className={`text-sm font-semibold ${fbStatus.facebookConnected ? "text-ifgreen" : "text-ifred"}`}>
                {fbStatus.facebookConnected ? "Connected" : "Not Connected"}
              </p>
              {fbStatus.facebookUserName !== "Not connected" && <p className="text-[10px] text-ifmuted">{fbStatus.facebookUserName}</p>}
            </div>
            <div className="bg-ifdark rounded-xl p-2 text-center">
              <p className="text-xs text-ifmuted">Agent</p>
              <p className="text-sm font-semibold text-iftext">{fbStatus.agent?.name ?? "Atlas"}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-lg font-bold text-ifaccent">{fbStatus.totalGroupsDiscovered}</p><p className="text-[10px] text-ifmuted">Discovered</p></div>
            <div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-lg font-bold text-ifgreen">{fbStatus.totalGroupsJoined}</p><p className="text-[10px] text-ifmuted">Joined</p></div>
            <div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-lg font-bold text-ifamber">{fbStatus.totalGroupsPending}</p><p className="text-[10px] text-ifmuted">Pending</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-sm font-bold text-ifcyan">{fbStatus.totalPostsPublished}</p><p className="text-[10px] text-ifmuted">Posts Published</p></div>
            <div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-sm font-bold text-ifred">{fbStatus.totalPostsFailed}</p><p className="text-[10px] text-ifmuted">Posts Failed</p></div>
          </div>
        </div>
      )}

      {fbCoverage && (
        <div className="card">
          <h3 className="text-sm font-semibold text-iftext mb-3">Group Coverage by Category</h3>
          <p className="text-[10px] text-ifmuted mb-2">Target: 50 groups per category.</p>
          <div className="space-y-1">
            {fbCoverage.coverage.map((c: any) => (
              <div key={c.category} className="flex items-center justify-between bg-ifdark rounded-lg px-2 py-1.5">
                <span className="text-[10px] text-iftext">{c.category}</span>
                <span className={`text-[10px] font-semibold ${c.needsMore ? "text-ifred" : "text-ifgreen"}`}>{c.groupsFound}/{c.target}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Users</h3>
        {!users && <div className="flex items-center justify-center py-4"><div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" /></div>}
        {users?.length === 0 && <p className="text-xs text-ifmuted text-center py-4">No users yet.</p>}

        {users?.map((u: any) => (
          <div key={u.userId} className="bg-ifdark rounded-xl p-3 mb-2 border border-ifborder">
            <div className="flex items-center justify-between mb-2">
              <div><p className="text-sm font-medium text-iftext">{u.name}</p><p className="text-[10px] text-ifmuted">{u.email || u.userId}</p></div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${u.adminAccessStatus === "granted" ? "bg-ifgreen/20 text-ifgreen" : u.adminAccessStatus === "requested" ? "bg-ifamber/20 text-ifamber" : u.adminAccessStatus === "denied" ? "bg-ifred/20 text-ifred" : "bg-ifborder text-ifmuted"}`}>
                {(u.adminAccessStatus || "none").toUpperCase()}
              </span>
            </div>

            <div className="flex gap-3 text-[10px] text-ifmuted mb-2">
              <span>Balance: ${u.totalBalance?.toFixed(2) || 0}</span><span>Platforms: {u.platformCount}</span><span>Campaigns: {u.campaignCount}</span>
            </div>
            <div className="space-y-1 mb-2">
              <button onClick={() => handleToggleAi(u.userId, u.aiCrossPostingEnabled)} className={`w-full py-2 rounded-lg text-[10px] font-medium border ${u.aiCrossPostingEnabled ? "bg-ifaccent/10 text-ifaccent border-ifaccent/30" : "bg-ifdark text-ifmuted border-ifborder"}`}>
                AI Cross-Posting: {u.aiCrossPostingEnabled ? "ON" : "OFF"}
              </button>
              <button onClick={() => handleToggleStandard(u.userId, u.standardCrossPostingEnabled)} className={`w-full py-2 rounded-lg text-[10px] font-medium border ${u.standardCrossPostingEnabled ? "bg-ifcyan/10 text-ifcyan border-ifcyan/30" : "bg-ifdark text-ifmuted border-ifborder"}`}>
                Standard Cross-Posting: {u.standardCrossPostingEnabled ? "ON" : "OFF"}
              </button>
            </div>

            <div className="flex gap-2">
              {!['granted','requested'].includes(u.adminAccessStatus) && <button onClick={() => handleRequestAccess(u.userId)} className="flex-1 py-1.5 rounded-lg bg-ifamber/10 text-ifamber text-[10px] font-medium border border-ifamber/30">Request Access</button>}
              {u.adminAccessStatus === "requested" && <span className="flex-1 py-1.5 text-center text-[10px] text-ifamber">Awaiting user response…</span>}
              {u.adminAccessStatus === "granted" && <>
                <button onClick={() => setSelectedUser(selectedUser === u.userId ? null : u.userId)} className="flex-1 py-1.5 rounded-lg bg-ifcyan/10 text-ifcyan text-[10px] font-medium border border-ifcyan/30">Manage Account</button>
                <button onClick={() => handleRevoke(u.userId)} className="px-3 py-1.5 rounded-lg bg-ifred/10 text-ifred text-[10px] font-medium border border-ifred/30">Revoke</button>
              </>}
            </div>

            {selectedUser === u.userId && u.adminAccessStatus === "granted" && userDetails && (
              <div className="mt-3 pt-3 border-t border-ifborder space-y-2">
                <p className="text-[10px] text-ifmuted font-semibold">Linked Platforms:</p>
                {userDetails.platforms?.length ? userDetails.platforms.map((p: any) => (
                  <div key={p._id} className="flex items-center justify-between bg-ifdark rounded-lg px-2 py-1.5">
                    <div><p className="text-[10px] text-iftext">{p.platform} — {p.displayName}</p><p className="text-[10px] text-ifmuted">{p.status}</p></div>
                    {p.status === "connected" && <button onClick={() => handleUnlink(p._id)} className="text-[10px] text-ifred">Unlink</button>}
                  </div>
                )) : <p className="text-[10px] text-ifmuted">No platforms linked.</p>}
                {userDetails.campaigns?.length > 0 && <div className="pt-2 border-t border-ifborder"><p className="text-[10px] text-ifmuted font-semibold">Campaigns:</p>{userDetails.campaigns.map((c: any) => <div key={c._id} className="flex items-center justify-between bg-ifdark rounded-lg px-2 py-1.5 mt-1"><p className="text-[10px] text-iftext">{c.title}</p><span className={`text-[10px] ${c.frozen ? "text-ifred" : "text-ifgreen"}`}>{c.frozen ? "FROZEN" : c.status}</span></div>)}</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-center py-2"><p className="text-[10px] text-ifmuted">Administrative platform access requires an outstanding user-consent request and may be revoked.</p></div>
    </div>
  );
}
