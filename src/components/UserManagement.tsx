/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * User + Outreach Management Panel — authenticated admin session only.
 * This React surface is shared by web and Capacitor mobile builds.
 */

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const PLATFORMS = ["facebook", "instagram", "bluesky"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function UserManagement({ sessionToken }: { sessionToken: string }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [accessMessage, setAccessMessage] = useState("");
  const [browserHealth, setBrowserHealth] = useState<any>(null);
  const [checkingBrowser, setCheckingBrowser] = useState(false);

  const sessionArgs = { sessionToken };
  const users = useQuery(api.userManagement.getUserList, sessionArgs);
  const userDetails = useQuery(
    api.userManagement.getUserDetails,
    selectedUser ? { sessionToken, userId: selectedUser } : "skip"
  );
  const fbStatus = useQuery(api.userManagement.getFacebookAgentStatus, sessionArgs);
  const fbCoverage = useQuery(api.userManagement.getFacebookGroupCoverage, sessionArgs);
  const control = useQuery(api.outreachControl.getControlState, sessionArgs);

  const toggleAi = useMutation(api.userManagement.toggleAiCrossPosting);
  const toggleStandard = useMutation(api.userManagement.toggleStandardCrossPosting);
  const requestAccess = useMutation(api.userManagement.requestAccountAccess);
  const revokeAccess = useMutation(api.userManagement.revokeAccountAccess);
  const unlinkPlatform = useMutation(api.userManagement.unlinkUserPlatform);
  const updateControl = useMutation(api.outreachControl.updateControlState);
  const emergencyStop = useMutation(api.outreachControl.setEmergencyStop);
  const setSubscription = useMutation(api.outreachControl.setSubscriptionState);
  const runDispatchNow = useMutation(api.outreachControl.runDispatchNow);
  const browserbaseHealth = useAction(api.outreachControl.browserbaseHealth);

  const reportError = (e: any) => setError(e?.message || "The admin operation failed.");
  const clearMessages = () => { setError(""); setSuccess(""); };

  const saveControl = async (patch: Record<string, any>) => {
    if (!control) return;
    clearMessages();
    try {
      const next = { ...control, ...patch };
      await updateControl({
        sessionToken,
        platformOutreachEnabled: next.platformOutreachEnabled,
        subscriberOutreachEnabled: next.subscriberOutreachEnabled,
        browserbaseEnabled: next.browserbaseEnabled,
        directApiEnabled: next.directApiEnabled,
        allowedPlatforms: next.allowedPlatforms,
        maxDispatchesPerCycle: next.maxDispatchesPerCycle,
        quietHoursStart: next.quietHoursStart,
        quietHoursEnd: next.quietHoursEnd,
        retryLimit: next.retryLimit,
      });
      setSuccess("Outreach controls updated everywhere.");
    } catch (e) { reportError(e); }
  };

  const togglePlatform = (platform: string) => {
    if (!control) return;
    const allowed = control.allowedPlatforms.includes(platform)
      ? control.allowedPlatforms.filter((p: string) => p !== platform)
      : [...control.allowedPlatforms, platform];
    void saveControl({ allowedPlatforms: allowed });
  };

  const handleEmergencyStop = async () => {
    if (!control) return;
    clearMessages();
    try {
      await emergencyStop({ sessionToken, stopped: !control.emergencyStop });
      setSuccess(control.emergencyStop ? "Emergency stop cleared." : "All new outreach dispatch stopped.");
    } catch (e) { reportError(e); }
  };

  const handleBrowserHealth = async () => {
    clearMessages(); setCheckingBrowser(true);
    try {
      const result = await browserbaseHealth({ sessionToken });
      setBrowserHealth(result);
      setSuccess(result.healthy ? "Browserbase social publishing context is reachable." : "Browserbase checked; at least one required social context needs attention.");
    } catch (e) { reportError(e); }
    finally { setCheckingBrowser(false); }
  };

  const handleDispatchNow = async () => {
    clearMessages();
    try {
      await runDispatchNow({ sessionToken });
      setSuccess("Outreach dispatch cycle queued now.");
    } catch (e) { reportError(e); }
  };

  const handleToggleAi = async (userId: string, current: boolean) => {
    clearMessages();
    try {
      await toggleAi({ sessionToken, userId, enabled: !current });
      setSuccess(`Subscriber outreach permission ${!current ? "enabled" : "disabled"} for user.`);
    } catch (e) { reportError(e); }
  };

  const handleToggleStandard = async (userId: string, current: boolean) => {
    clearMessages();
    try {
      await toggleStandard({ sessionToken, userId, enabled: !current });
      setSuccess(`Base platform outreach permission ${!current ? "enabled" : "disabled"} for user.`);
    } catch (e) { reportError(e); }
  };

  const handleSubscription = async (userId: string, status: "active" | "inactive" | "expired" | "canceled") => {
    clearMessages();
    try {
      await setSubscription({
        sessionToken,
        userId,
        status,
        qualifiesForOutreach: status === "active",
        source: "admin",
      });
      setSuccess(`Subscription state set to ${status}. Provider webhooks can update it automatically.`);
    } catch (e) { reportError(e); }
  };

  const handleRequestAccess = async (userId: string) => {
    clearMessages();
    try {
      await requestAccess({ sessionToken, userId, message: accessMessage || undefined });
      setSuccess("Access request sent to the user's inbox.");
      setAccessMessage("");
    } catch (e) { reportError(e); }
  };

  const handleRevoke = async (userId: string) => {
    clearMessages();
    try {
      await revokeAccess({ sessionToken, userId });
      setSuccess("Administrative account access revoked.");
    } catch (e) { reportError(e); }
  };

  const handleUnlink = async (platformId: string) => {
    if (!confirm("Unlink this platform?")) return;
    clearMessages();
    try {
      await unlinkPlatform({ sessionToken, platformId: platformId as any });
      setSuccess("Platform unlinked.");
    } catch (e) { reportError(e); }
  };

  return (
    <div className="space-y-4">
      {error && <div className="bg-ifred/10 border border-ifred/30 rounded-xl p-3"><p className="text-xs text-ifred">{error}</p></div>}
      {success && <div className="bg-ifgreen/10 border border-ifgreen/30 rounded-xl p-3"><p className="text-xs text-ifgreen">{success}</p></div>}

      {/* Shared web + Capacitor app control center */}
      <div className="card border-ifaccent/30">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-ifaccent">Outreach Control Center</h3>
            <p className="text-[10px] text-ifmuted mt-1">One Convex source of truth for web, Android, and iOS.</p>
          </div>
          <button
            onClick={handleEmergencyStop}
            disabled={!control}
            className={`px-3 py-2 rounded-lg text-[10px] font-bold border ${control?.emergencyStop ? "bg-ifred text-white border-ifred" : "bg-ifred/10 text-ifred border-ifred/30"}`}
          >
            {control?.emergencyStop ? "CLEAR STOP" : "EMERGENCY STOP"}
          </button>
        </div>

        {!control ? (
          <div className="flex items-center justify-center py-5"><div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button onClick={() => saveControl({ platformOutreachEnabled: !control.platformOutreachEnabled })} className={`p-3 rounded-xl border text-left ${control.platformOutreachEnabled ? "bg-ifgreen/10 border-ifgreen/30" : "bg-ifdark border-ifborder"}`}>
                <p className={`text-xs font-semibold ${control.platformOutreachEnabled ? "text-ifgreen" : "text-ifmuted"}`}>Platform Outreach Agent: {control.platformOutreachEnabled ? "ON" : "OFF"}</p>
                <p className="text-[10px] text-ifmuted mt-1">Promotes active campaigns, activity, milestones, and Interplanetary Fund.</p>
              </button>
              <button onClick={() => saveControl({ subscriberOutreachEnabled: !control.subscriberOutreachEnabled })} className={`p-3 rounded-xl border text-left ${control.subscriberOutreachEnabled ? "bg-ifcyan/10 border-ifcyan/30" : "bg-ifdark border-ifborder"}`}>
                <p className={`text-xs font-semibold ${control.subscriberOutreachEnabled ? "text-ifcyan" : "text-ifmuted"}`}>Subscriber Outreach Agent: {control.subscriberOutreachEnabled ? "ON" : "OFF"}</p>
                <p className="text-[10px] text-ifmuted mt-1">Adds outreach only for active qualifying subscriptions with user permission.</p>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => saveControl({ browserbaseEnabled: !control.browserbaseEnabled })} className={`py-2 rounded-lg text-[10px] border ${control.browserbaseEnabled ? "text-ifcyan border-ifcyan/30 bg-ifcyan/10" : "text-ifmuted border-ifborder"}`}>Browserbase: {control.browserbaseEnabled ? "ON" : "OFF"}</button>
              <button onClick={() => saveControl({ directApiEnabled: !control.directApiEnabled })} className={`py-2 rounded-lg text-[10px] border ${control.directApiEnabled ? "text-ifgreen border-ifgreen/30 bg-ifgreen/10" : "text-ifmuted border-ifborder"}`}>Direct APIs: {control.directApiEnabled ? "ON" : "OFF"}</button>
            </div>

            <div>
              <p className="text-[10px] text-ifmuted mb-1">Allowed social platforms</p>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((platform) => {
                  const enabled = control.allowedPlatforms.includes(platform);
                  return <button key={platform} onClick={() => togglePlatform(platform)} className={`px-3 py-1.5 rounded-lg text-[10px] border ${enabled ? "bg-ifaccent/10 text-ifaccent border-ifaccent/30" : "text-ifmuted border-ifborder"}`}>{platform}: {enabled ? "ON" : "OFF"}</button>;
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className="text-[10px] text-ifmuted">Max/cycle
                <select value={control.maxDispatchesPerCycle} onChange={(e) => saveControl({ maxDispatchesPerCycle: Number(e.target.value) })} className="input mt-1">
                  {[1,3,5,10,20,50].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="text-[10px] text-ifmuted">Retries
                <select value={control.retryLimit} onChange={(e) => saveControl({ retryLimit: Number(e.target.value) })} className="input mt-1">
                  {[0,1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <label className="text-[10px] text-ifmuted">Quiet start
                <select value={control.quietHoursStart} onChange={(e) => saveControl({ quietHoursStart: Number(e.target.value) })} className="input mt-1">
                  {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}
                </select>
              </label>
              <label className="text-[10px] text-ifmuted">Quiet end
                <select value={control.quietHoursEnd} onChange={(e) => saveControl({ quietHoursEnd: Number(e.target.value) })} className="input mt-1">
                  {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2,"0")}:00</option>)}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleBrowserHealth} disabled={checkingBrowser} className="btn-secondary text-xs">{checkingBrowser ? "Checking..." : "Verify Browserbase"}</button>
              <button onClick={handleDispatchNow} disabled={control.emergencyStop} className="btn-primary text-xs">Run Outreach Now</button>
            </div>

            {browserHealth && (
              <div className="bg-ifdark rounded-xl p-3 text-[10px] space-y-1">
                <p className="text-iftext font-semibold">Browserbase social contexts</p>
                <p className={browserHealth.facebook?.healthy ? "text-ifgreen" : "text-ifred"}>Facebook: {browserHealth.facebook?.healthy ? "authenticated" : browserHealth.facebook?.reason || "not ready"}</p>
                <p className={browserHealth.instagram?.healthy ? "text-ifgreen" : "text-ifred"}>Instagram: {browserHealth.instagram?.healthy ? "authenticated" : browserHealth.instagram?.reason || "not ready"}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {fbStatus && (
        <div className="card border-ifcyan/20">
          <h3 className="text-sm font-semibold text-ifcyan mb-3">Facebook Outreach Status</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-xs text-ifmuted">Connection</p><p className={`text-sm font-semibold ${fbStatus.facebookConnected ? "text-ifgreen" : "text-ifred"}`}>{fbStatus.facebookConnected ? "Connected" : "Not Connected"}</p>{fbStatus.facebookUserName !== "Not connected" && <p className="text-[10px] text-ifmuted">{fbStatus.facebookUserName}</p>}</div>
            <div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-xs text-ifmuted">Agent</p><p className="text-sm font-semibold text-iftext">{fbStatus.agent?.name ?? "Atlas"}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-lg font-bold text-ifaccent">{fbStatus.totalGroupsDiscovered}</p><p className="text-[10px] text-ifmuted">Discovered</p></div>
            <div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-lg font-bold text-ifgreen">{fbStatus.totalGroupsJoined}</p><p className="text-[10px] text-ifmuted">Joined</p></div>
            <div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-lg font-bold text-ifamber">{fbStatus.totalGroupsPending}</p><p className="text-[10px] text-ifmuted">Pending</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2"><div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-sm font-bold text-ifcyan">{fbStatus.totalPostsPublished}</p><p className="text-[10px] text-ifmuted">Posts Published</p></div><div className="bg-ifdark rounded-xl p-2 text-center"><p className="text-sm font-bold text-ifred">{fbStatus.totalPostsFailed}</p><p className="text-[10px] text-ifmuted">Posts Failed</p></div></div>
        </div>
      )}

      {fbCoverage && (
        <div className="card">
          <h3 className="text-sm font-semibold text-iftext mb-3">Group Coverage by Category</h3>
          <p className="text-[10px] text-ifmuted mb-2">Target: 50 relevant groups per category.</p>
          <div className="space-y-1">{fbCoverage.coverage.map((c: any) => <div key={c.category} className="flex items-center justify-between bg-ifdark rounded-lg px-2 py-1.5"><span className="text-[10px] text-iftext">{c.category}</span><span className={`text-[10px] font-semibold ${c.needsMore ? "text-ifred" : "text-ifgreen"}`}>{c.groupsFound}/{c.target}</span></div>)}</div>
        </div>
      )}

      <div className="card">
        <h3 className="text-sm font-semibold text-iftext mb-3">Users and Subscriber Outreach</h3>
        {!users && <div className="flex items-center justify-center py-4"><div className="w-6 h-6 border-2 border-ifaccent border-t-transparent rounded-full animate-spin" /></div>}
        {users?.length === 0 && <p className="text-xs text-ifmuted text-center py-4">No users yet.</p>}

        {users?.map((u: any) => {
          const subscriptionStatus = u.subscription?.status || "inactive";
          return (
          <div key={u.userId} className="bg-ifdark rounded-xl p-3 mb-2 border border-ifborder">
            <div className="flex items-center justify-between mb-2">
              <div><p className="text-sm font-medium text-iftext">{u.name}</p><p className="text-[10px] text-ifmuted">{u.email || u.userId}</p></div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${subscriptionStatus === "active" ? "bg-ifgreen/20 text-ifgreen" : "bg-ifborder text-ifmuted"}`}>SUBSCRIPTION {subscriptionStatus.toUpperCase()}</span>
            </div>

            <div className="flex flex-wrap gap-3 text-[10px] text-ifmuted mb-2"><span>Tier: {u.subscriptionTier}</span><span>Balance: ${u.totalBalance?.toFixed(2) || 0}</span><span>Platforms: {u.platformCount}</span><span>Campaigns: {u.campaignCount}</span></div>
            {u.subscription && <p className="text-[10px] text-ifmuted mb-2">Source: {u.subscription.source || "unknown"}{u.subscription.expiresAt ? ` · Expires ${new Date(u.subscription.expiresAt).toLocaleDateString()}` : ""}</p>}

            <div className="grid grid-cols-2 gap-1 mb-2">
              <button onClick={() => handleToggleAi(u.userId, u.aiCrossPostingEnabled)} className={`py-2 rounded-lg text-[10px] font-medium border ${u.aiCrossPostingEnabled ? "bg-ifcyan/10 text-ifcyan border-ifcyan/30" : "text-ifmuted border-ifborder"}`}>Subscriber Outreach Permission: {u.aiCrossPostingEnabled ? "ON" : "OFF"}</button>
              <button onClick={() => handleToggleStandard(u.userId, u.standardCrossPostingEnabled)} className={`py-2 rounded-lg text-[10px] font-medium border ${u.standardCrossPostingEnabled ? "bg-ifaccent/10 text-ifaccent border-ifaccent/30" : "text-ifmuted border-ifborder"}`}>Base Outreach Permission: {u.standardCrossPostingEnabled ? "ON" : "OFF"}</button>
            </div>

            <div className="flex flex-wrap gap-1 mb-2">
              {(["active","inactive","expired","canceled"] as const).map((status) => <button key={status} onClick={() => handleSubscription(u.userId, status)} className={`px-2 py-1 rounded text-[9px] border ${subscriptionStatus === status ? "border-ifgreen text-ifgreen bg-ifgreen/10" : "border-ifborder text-ifmuted"}`}>{status}</button>)}
            </div>

            <div className="flex items-center justify-between mb-2"><span className={`px-2 py-0.5 rounded-full text-[10px] ${u.adminAccessStatus === "granted" ? "bg-ifgreen/20 text-ifgreen" : u.adminAccessStatus === "requested" ? "bg-ifamber/20 text-ifamber" : "bg-ifborder text-ifmuted"}`}>ACCOUNT ACCESS {(u.adminAccessStatus || "none").toUpperCase()}</span></div>
            <div className="flex gap-2">
              {!['granted','requested'].includes(u.adminAccessStatus) && <button onClick={() => handleRequestAccess(u.userId)} className="flex-1 py-1.5 rounded-lg bg-ifamber/10 text-ifamber text-[10px] font-medium border border-ifamber/30">Request Access</button>}
              {u.adminAccessStatus === "requested" && <span className="flex-1 py-1.5 text-center text-[10px] text-ifamber">Awaiting user response...</span>}
              {u.adminAccessStatus === "granted" && <><button onClick={() => setSelectedUser(selectedUser === u.userId ? null : u.userId)} className="flex-1 py-1.5 rounded-lg bg-ifcyan/10 text-ifcyan text-[10px] font-medium border border-ifcyan/30">Manage Account</button><button onClick={() => handleRevoke(u.userId)} className="px-3 py-1.5 rounded-lg bg-ifred/10 text-ifred text-[10px] font-medium border border-ifred/30">Revoke</button></>}
            </div>

            {selectedUser === u.userId && u.adminAccessStatus === "granted" && userDetails && (
              <div className="mt-3 pt-3 border-t border-ifborder space-y-2">
                <p className="text-[10px] text-ifmuted font-semibold">Linked Platforms:</p>
                {userDetails.platforms?.length ? userDetails.platforms.map((p: any) => <div key={p._id} className="flex items-center justify-between bg-ifdark rounded-lg px-2 py-1.5"><div><p className="text-[10px] text-iftext">{p.platform} — {p.displayName}</p><p className="text-[10px] text-ifmuted">{p.status}</p></div>{p.status === "connected" && <button onClick={() => handleUnlink(p._id)} className="text-[10px] text-ifred">Unlink</button>}</div>) : <p className="text-[10px] text-ifmuted">No platforms linked.</p>}
                {userDetails.campaigns?.length > 0 && <div className="pt-2 border-t border-ifborder"><p className="text-[10px] text-ifmuted font-semibold">Campaigns:</p>{userDetails.campaigns.map((c: any) => <div key={c._id} className="flex items-center justify-between bg-ifdark rounded-lg px-2 py-1.5 mt-1"><p className="text-[10px] text-iftext">{c.title}</p><span className={`text-[10px] ${c.frozen ? "text-ifred" : "text-ifgreen"}`}>{c.frozen ? "FROZEN" : c.status}</span></div>)}</div>}
              </div>
            )}
          </div>
        )})}
      </div>

      <div className="text-center py-2"><p className="text-[10px] text-ifmuted">External posting requires authorized credentials or a persisted Browserbase social context. Subscriber outreach requires an active qualifying subscription plus user-level permission.</p></div>
    </div>
  );
}
