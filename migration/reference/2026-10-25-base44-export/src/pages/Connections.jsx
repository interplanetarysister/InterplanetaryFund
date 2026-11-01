import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link2, RefreshCw, Search, History, PlugZap, CircleCheck, Globe2, Share2, AppWindow } from "lucide-react";
import { ALL_PLATFORMS } from "@/components/connections/platformCatalog";
import PlatformLogo from "@/components/connections/PlatformLogo";
import AIConsentCard from "@/components/connections/AIConsentCard";
import AgentWorkPanel from "@/components/connections/AgentWorkPanel";
import ConnectionCard from "@/components/connections/ConnectionCard";
import ConnectDialog from "@/components/connections/ConnectDialog";
import PublishFromConnections from "@/components/connections/PublishFromConnections";
import SyncRunHistory from "@/components/connections/SyncRunHistory";
import PageError from "@/components/PageError";
import { connectionHealth } from "@/lib/connectionHealth";
import { hasManagedConnections } from "@/lib/subscriptionEntitlements";
import { parseExternalSyncResult } from "@/lib/externalSyncResult";

// The Universal Connections Center — connect once, fund everywhere. Every
// crowdfunding platform and social network Interplanetary Fund can reach,
// managed from a single place.
export default function Connections() {
  const location = useLocation();
  const navigate = useNavigate();
  const [connections, setConnections] = useState(null);
  const [user, setUser] = useState(null);
  const [dialog, setDialog] = useState(null); // { platform, existing }
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [connectionNotice, setConnectionNotice] = useState(null);
  const [platformSearch, setPlatformSearch] = useState("");
  const [platformCategory, setPlatformCategory] = useState("all");
  const [sharedIntegrations, setSharedIntegrations] = useState(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [wixSyncing, setWixSyncing] = useState(false);
  const [wixSyncResult, setWixSyncResult] = useState(null);
  // Canonical lifecycle from resolveConnectionStatus, keyed by connection id.
  // The local record heuristic is the fallback; the resolver is authoritative.
  const [lifecycleMap, setLifecycleMap] = useState({});
  const requestGeneration = useRef(0);
  const syncInFlightRef = useRef(false);
  const mountedRef = useRef(true);

  // All in-app and agent connection links land on this canonical page, even
  // when a member switches platforms without a full page reload. Only catalog
  // IDs may open a dialog; never use the URL as a provider redirect address.
  useEffect(() => {
    if (!connections || !location.search) return;
    const params = new URLSearchParams(location.search);
    const requested = params.get("connect") || params.get("platform") || params.get("provider");
    if (!requested) return;
    for (const key of ["connect", "platform", "provider"]) params.delete(key);
    const remaining = params.toString();
    // Use router navigation instead of history.replaceState: that keeps
    // React Router in sync for a second platform link in the same session.
    navigate({ pathname: "/connections", search: remaining ? `?${remaining}` : "", hash: location.hash }, { replace: true });
    const platform = ALL_PLATFORMS.find((item) => item.id === requested);
    if (!platform) {
      setConnectionNotice({ ok: false, text: "This connection link isn't supported. Choose a platform below." });
      return;
    }
    const existing = connections.find((item) => item.platform === requested) || null;
    setDialog({ platform, existing });
  }, [connections, location.search, location.hash, navigate]);

  // Help Center deep-links open the actual connection helper, even though
  // the app scrolls inside its central workspace instead of the window.
  useEffect(() => {
    if (!connections || window.location.hash !== "#connection-help") return;
    const id = window.requestAnimationFrame(() =>
      document.getElementById("connection-help")?.scrollIntoView({
        behavior: "smooth", block: "start",
      }));
    return () => window.cancelAnimationFrame(id);
  }, [connections]);

  // Resume either a provider popup or the same-tab OAuth redirect. The caller
  // is never trusted merely because it sent a message: the backend rechecks
  // the authenticated owner and provider credential before recording anything.
  useEffect(() => {
    const resume = event => {
      if (event?.type === "message") {
        if (event.origin !== window.location.origin ||
            event.data?.type !== "ifund-provider-oauth-returned") return;
        let pending = null;
        try { pending = JSON.parse(localStorage.getItem("ifund_pending_platform_connection") || "null"); } catch {}
        if (!pending || pending.platform !== event.data.platform) return;
      } else if (event?.type === "storage" &&
                 event.key !== "ifund_pending_platform_connection") return;
      setReloadKey(key => key + 1);
    };
    window.addEventListener("message", resume);
    window.addEventListener("storage", resume);
    return () => {
      window.removeEventListener("message", resume);
      window.removeEventListener("storage", resume);
    };
  }, []);

  // This click is the authorization boundary for one bounded sync request.
  // Loading the page, signing in, agents, and background work never call it.
  const syncAll = async () => {
    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncing(true);
    setSyncResult(null);
    try {
      const { data } = await base44.functions.invoke("syncExternalFunds", { scope: "user", initiator_type: "user", request_id: crypto.randomUUID() });
      const safeResult = parseExternalSyncResult(data);
      if (!mountedRef.current) return;
      setSyncResult(safeResult);
      const r = await base44.functions.invoke("listConnections", { scope: "mine" });
      const nextConnections = r?.data?.connections;
      if (!Array.isArray(nextConnections)) throw new Error("Malformed connections response");
      if (!mountedRef.current) return;
      setConnections(nextConnections);
      resolveLifecycles(nextConnections);
      setHistoryKey((k) => k + 1);
    } catch {
      if (mountedRef.current) setSyncResult({ error: "We couldn’t update your connected platforms right now. Try again." });
    } finally {
      syncInFlightRef.current = false;
      if (mountedRef.current) setSyncing(false);
    }
  };

  // Fetch the canonical lifecycle for every saved connection in parallel.
  // resolveConnectionStatus is the single source of truth for "is this working";
  // a per-connection failure is non-fatal and leaves the local heuristic in place.
  const resolveLifecycles = async (conns) => {
    const list = Array.isArray(conns) ? conns : connections;
    if (!list || !list.length) { setLifecycleMap({}); return; }
    const entries = await Promise.all(
      list.map((c) =>
        base44.functions.invoke("resolveConnectionStatus", { platform: c.platform, connection_id: c.id })
          .then(({ data }) => [c.id, data || null])
          .catch(() => [c.id, null])
      )
    );
    setLifecycleMap(Object.fromEntries(entries.filter(([, v]) => v)));
  };


  const syncWix = async () => {
    setWixSyncing(true);
    setWixSyncResult(null);
    try {
      const responses = await Promise.all([
        base44.functions.invoke("syncWixCampaigns", {}),
        base44.functions.invoke("syncWixContent", {}),
        base44.functions.invoke("syncWixBusinessData", {}),
        base44.functions.invoke("syncWixAnalytics", {}),
      ]);
      const payloads = responses.map((response) => response?.data || {});
      setWixSyncResult({
        ok: payloads.every((payload) => payload?.ok !== false && !payload?.error),
        payloads,
      });
    } catch {
      setWixSyncResult({ ok: false });
    } finally {
      setWixSyncing(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    const requestId = ++requestGeneration.current;
    (async () => {
     try {
      const me = await base44.auth.me();
      if (!me || typeof me !== "object" || !me.id) throw new Error("Malformed auth response");
      if (!mountedRef.current || requestId !== requestGeneration.current) return;
      let pending = null;
      try {
        pending = JSON.parse(localStorage.getItem("ifund_pending_platform_connection") || "null");
      } catch { localStorage.removeItem("ifund_pending_platform_connection"); }
      const fresh = pending && pending.userId === me.id && Date.now() - pending.startedAt < 20 * 60 * 1000;
      if (pending && !fresh) localStorage.removeItem("ifund_pending_platform_connection");
      if (fresh) {
        try {
          const { data } = await base44.functions.invoke("finalizeAppUserOAuthConnection", {
            platform: pending.platform,
            campaign_id: pending.campaignId || undefined,
            display_name: pending.displayName || pending.campaignTitle || undefined,
            ai_account_authorized: pending.accountAiAllowed === true,
            ai_scope_choice: pending.aiScopeChoice || "full",
          });
          if (data?.authorization_present && data?.connection?.id) {
            setDialog(null);
            const connectionId = data.connection.id;
            const verified = await base44.functions.invoke("verifyPlatformConnection", { connection_id: connectionId });
            const working = verified?.data?.working === true;
            // Connecting an outside account never authorizes or initiates a
            // public post. Publishing is a separate user-approved action from
            // the campaign distribution screen, even for a paired campaign.
            localStorage.removeItem("ifund_pending_platform_connection");
            if (!working) {
              setConnectionNotice({ ok: false, text: pending.platform + " authorization was saved, but the live provider check needs attention." });
            } else {
              setConnectionNotice({ ok: true, text: `${pending.platform} is connected${pending.campaignTitle ? ` and paired with ${pending.campaignTitle}` : ""}. Open your campaign to publish an approved post when ready.` });
            }
          } else {
            localStorage.removeItem("ifund_pending_platform_connection");
            setConnectionNotice({ ok: false, text: pending.platform + " authorization was not completed. Use Connect to try again." });
          }
        } catch {
          setConnectionNotice({ ok: false, text: "We could not finish provider sign-in. Use Connect to retry." });
        }
      }
      const connRes = await base44.functions.invoke("listConnections", { scope: "mine" });
      const nextConnections = connRes?.data?.connections;
      if (!Array.isArray(nextConnections)) throw new Error("Malformed connections response");
      if (!mountedRef.current || requestId !== requestGeneration.current) return;
      setUser(me);
      setConnections(nextConnections);
      // Platform-managed (SHARED) integrations have no PlatformConnection record
      // by design; surface their live status separately.
      base44.functions.invoke("getSharedConnectorStatus", {})
        .then(({ data }) => setSharedIntegrations(data?.shared || []))
        .catch(() => setSharedIntegrations([]));
      // Enrich each connection with the canonical lifecycle so the card, the
      // summary, and the resolver all agree on "working". Best-effort: a failed
      // resolve leaves the local heuristic in place.
      resolveLifecycles(nextConnections);
      // No provider probes on page load: this keeps provider API usage
      // request-triggered and avoids repeated calls that may consume quotas.
      // New OAuth grants are still checked immediately after authorization.
      // Saved accounts can be rechecked with their Check connection buttons.
      setError(null);
     } catch (e) {
       console.error("Connections load failed:", e?.name || "UnknownError");
       if (mountedRef.current && requestId === requestGeneration.current) setError("We couldn't load your connections. Please try again.");
     }
    })();
    return () => {
      mountedRef.current = false;
      requestGeneration.current += 1;
    };
  }, [reloadKey]);

  if (error) {
    return <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10"><PageError message={error} onRetry={() => { setError(null); setConnections(null); setReloadKey((key) => key + 1); }} /></div>;
  }
  if (!connections) {
    return <div className="flex items-center justify-center h-[60vh]" role="status" aria-live="polite"><Loader2 className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Loading connections</span></div>;
  }

  const aiAuthorized = user?.ai_obo_consent?.granted === true;
  const managedAvailable = aiAuthorized && hasManagedConnections(user);
  const connectedIds = connections.map((c) => c.platform);
  // A connection is "working" when the canonical resolver says CONNECTED;
  // fall back to the local heuristic while the resolver is still loading.
  const workingCount = connections.filter((c) =>
    lifecycleMap[c.id] ? lifecycleMap[c.id].lifecycle === "CONNECTED" : connectionHealth(c).usable
  ).length;
  const discoveredTotals = Array.isArray(syncResult?.discovered_totals) ? syncResult.discovered_totals : [];
  const discoveredSummary = discoveredTotals
    .filter(({ amount }) => amount > 0)
    .map(({ currency, amount }) => `${currency === "UNSPECIFIED" ? "Unspecified currency" : currency} ${amount.toLocaleString()}`)
    .join(", ");
  const availablePlatforms = ALL_PLATFORMS.filter((p) =>
    (p.id === "custom" || !connectedIds.includes(p.id)) &&
    (platformCategory === "all" || p.kind === platformCategory) &&
    (`${p.name} ${p.kind || ""}`.toLowerCase().includes(platformSearch.trim().toLowerCase()))
  );

  const choosePlatform = (platform) => {
    setDialog({ platform });
    setPlatformSearch("");
  };

  const requestManagedAction = async ({ platform, action, connection = null, campaign_id }) => {
    const platformId = typeof platform === "string" ? platform : platform?.id;
    if (!platformId) throw new Error("Platform is required.");
    try {
      const { data } = await base44.functions.invoke("requestManagedConnectionAction", {
        platform: platformId,
        action,
        connection_id: connection?.id,
        campaign_id,
      });
      if (!data?.accepted) throw new Error("Managed Connections request was not accepted.");
      setHistoryKey((key) => key + 1);
      const completed = data.state === "completed";
      setConnectionNotice({
        ok: completed,
        text: data.message || (completed ? "IFund verified the connection." : "IFund saved this work and will continue from the next required provider step."),
      });
      if (completed) setReloadKey((key) => key + 1);
      if (data.state === "waiting_user" && connection) {
        const catalogPlatform = ALL_PLATFORMS.find((p) => p.id === platformId) || { id: platformId, name: platformId, kind: connection.kind, api: "" };
        setDialog({ platform: catalogPlatform, existing: connection });
      }
      return data;
    } catch (e) {
      console.error("Managed Connections request failed:", e?.name || "UnknownError");
      setConnectionNotice({ ok: false, text: "IFund couldn’t start that managed connection step. Check your IFund help permission and subscription, then try again." });
      throw e;
    }
  };

  return (
    <div className="connections-hub max-w-4xl mx-auto min-w-0 px-4 sm:px-6 pt-6 sm:pt-10 pb-[calc(11rem+env(safe-area-inset-bottom))] sm:pb-10">
      <div className="ifund-connections-hero rounded-[2rem] border p-5 sm:p-7 shadow-sm mb-7">
      <h1 className="flex items-center gap-2.5 font-display text-3xl text-slate-950 dark:text-white mb-1">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-white" />
        </span>
        Connections
      </h1>
      <p className="text-slate-600 dark:text-slate-200 mb-5">All the platforms you use, in one place. Choose a service to set it up. Only verified connections show as working.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="ifund-connection-stat rounded-2xl border p-4"><div className="flex items-center gap-2 text-sm"><CircleCheck className="w-4 h-4 text-emerald-500" /> Working</div><p className="text-3xl font-bold mt-1">{workingCount}</p></div>
        <div className="ifund-connection-stat rounded-2xl border p-4"><div className="flex items-center gap-2 text-sm"><PlugZap className="w-4 h-4 text-violet-500" /> Available platforms</div><p className="text-3xl font-bold mt-1">{ALL_PLATFORMS.length}</p></div>
      </div>
      </div>

      {connectionNotice && (
        <div className={`mb-4 rounded-xl border p-3 text-sm ${connectionNotice.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {connectionNotice.text}
        </div>
      )}

      <PublishFromConnections />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button onClick={syncAll} disabled={syncing} className="rounded-xl">
          {syncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Refresh now
        </Button>
        {sharedIntegrations?.some((integration) => integration.type === "wix" && integration.connected) && (
          <Button onClick={syncWix} disabled={wixSyncing} variant="outline" className="rounded-xl">
            {wixSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />} Sync Wix
          </Button>
        )}
      </div>
      {wixSyncResult && <div className={`mb-4 rounded-xl border p-3 text-sm ${wixSyncResult.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{wixSyncResult.ok ? "Wix is synchronized." : "Wix sync needs attention. Existing IFund data was left unchanged."}</div>}
      {syncResult && (
        <div className="mb-6 rounded-xl border border-stone-200 p-3 text-sm" role="status" aria-live="polite">
          {syncResult.error ? (
            <p className="text-red-600">{syncResult.error}</p>
          ) : (
            <p className="text-stone-700">
              {["success", "partial"].includes(syncResult.overall_status)
                ? `${discoveredSummary ? `${discoveredSummary} found.` : "Your connected platforms were refreshed."}`
                : syncResult.overall_status === "no_connections"
                  ? "Nothing is on yet. Turn on a platform below to get started."
                  : syncResult.overall_status === "in_progress"
                    ? "A refresh is already in progress. Recent refreshes will update when it finishes."
                    : "One or more connections need attention. Use Fix Connection below."}
            </p>
          )}
        </div>
      )}

      <div className="mb-8">
        <h2 className="font-display text-xl text-stone-900 mb-1 flex items-center gap-2">
          <History className="w-5 h-5 text-stone-500" /> Recent refreshes
        </h2>
        <p className="text-sm text-stone-500 mb-3">The last few times your platforms were checked and what each one reported.</p>
        <SyncRunHistory refreshKey={historyKey} />
      </div>

      <div className="mb-8">
        <AIConsentCard user={user} onChanged={(v) => { setUser((u) => ({ ...u, ai_obo_consent: v })); setReloadKey((key) => key + 1); }} />
      </div>
      <AgentWorkPanel refreshKey={historyKey} />
      <div className="mb-8 rounded-2xl border border-cyan-200 bg-cyan-50 p-4" id="connection-help">
        <h2 className="font-semibold text-slate-950">Connect with IFund AI help</h2>
        <p className="text-sm text-slate-700 mt-1">
          Choose a platform to open its IFund connection window. For supported providers,
          select Connect to sign in and approve access. Otherwise, IFund shows the available
          setup steps. No account is marked connected without provider verification.
        </p>
        <p className="text-xs text-slate-600 mt-2">
          {managedAvailable
            ? "Managed connection tracking is active for your account. You can follow the agent’s progress above."
            : "You can still use guided sign-in. Automatic connection management requires an eligible paid tier and IFund AI permission."}
        </p>
        <Button type="button" variant="outline" className="mt-3 bg-white text-slate-900"
          onClick={() => { document.getElementById("connection-chooser")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
          Choose a platform to connect
        </Button>
      </div>

      {sharedIntegrations && sharedIntegrations.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-xl text-stone-900 mb-1">Included connections</h2>
          <div className="space-y-3">
            {sharedIntegrations.map((s) => (
              <div key={s.type} className="rounded-2xl border border-cyan-300/15 bg-white p-4 flex items-center gap-3">
                <span className="text-xl w-9 h-9 rounded-xl bg-cyan-400/10 border border-cyan-300/20 flex items-center justify-center shrink-0" aria-hidden="true">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-stone-900">{s.name}</p>
                  {user?.role === "admin" && <p className="text-xs text-stone-500">Available to IFund.</p>}
                </div>
                {s.connected && s.verified ? (
                  <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Connected</span>
                ) : s.connected ? (
                  <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Needs attention</span>
                ) : (
                  <span className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-500">Not connected</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {connections.length > 0 && (
        <div className="mb-8">
          <h2 className="font-display text-xl text-stone-900 mb-1">Your platforms</h2>
          <p className="text-sm text-stone-500 mb-3">Manage the platforms you have connected to IFund.</p>
          <div className="space-y-3">
            {connections.map((c) => (
              <ConnectionCard
                key={c.id}
                connection={c}
                platform={ALL_PLATFORMS.find((p) => p.id === c.platform)}
                resolved={lifecycleMap[c.id]}
                onManage={() => setDialog({ platform: { ...(ALL_PLATFORMS.find((p) => p.id === c.platform) || { id: c.platform, name: c.platform, api: "" }), kind: c.kind }, existing: c })}
                aiAuthorized={aiAuthorized}
                managedAvailable={managedAvailable}
                onManagedRepair={() => requestManagedAction({ platform: c.platform, action: "repair", connection: c })}
                onUpdated={(updated) => {
                  setConnections(prev => prev.map(item => item.id === updated.id ? updated : item));
                  base44.functions.invoke("resolveConnectionStatus", { platform: updated.platform, connection_id: updated.id })
                    .then(({ data }) => { if (data) setLifecycleMap(prev => ({ ...prev, [updated.id]: data })); })
                    .catch(() => {});
                }}
                onRemoved={(id, updated) => {
                  setConnections((prev) => updated ? prev.map((x) => x.id === id ? updated : x) : prev.filter((x) => x.id !== id));
                  // After a provider check updates a connection, refresh its
                  // canonical lifecycle so the card reflects the new state.
                  if (updated) {
                    base44.functions.invoke("resolveConnectionStatus", { platform: updated.platform, connection_id: updated.id })
                      .then(({ data }) => setLifecycleMap((prev) => ({ ...prev, [updated.id]: data })))
                      .catch(() => {});
                  }
                }}
              />
            ))}
          </div>
        </div>
      )}

      <section className="mb-8" id="connection-chooser">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-display text-xl text-stone-900 mb-1">Explore connections</h2>
            <p className="text-sm text-stone-500">Select a platform to connect or link your account.</p>
          </div>
          <Globe2 className="w-6 h-6 text-violet-500 shrink-0" aria-hidden="true" />
        </div>
        <div className="ifund-connection-browser rounded-[1.7rem] p-3 sm:p-5">
          <div className="relative mb-4">
            <Search className="absolute top-1/2 -translate-y-1/2 left-3 h-5 w-5 text-slate-500 pointer-events-none" />
            <Input
              value={platformSearch}
              onChange={(e) => setPlatformSearch(e.target.value)}
              placeholder="Search platforms"
              aria-label="Search available platforms"
              className="pl-11 h-12 rounded-2xl bg-white text-slate-900 dark:bg-slate-900"
            />
          </div>
          <div role="group" aria-label="Filter platforms" className="flex gap-2 overflow-x-auto pb-2 mb-3">
            {[
              { id: "all", label: "All", Icon: PlugZap },
              { id: "crowdfunding", label: "Fundraising", Icon: Globe2 },
              { id: "social", label: "Social", Icon: Share2 },
              { id: "app", label: "Tools", Icon: AppWindow },
            ].map(({ id, label, Icon }) => (
              <button type="button" key={id} onClick={() => setPlatformCategory(id)}
                aria-pressed={platformCategory === id}
                className={platformCategory === id ? "ifund-platform-filter is-active" : "ifund-platform-filter"}>
                <Icon className="w-4 h-4 shrink-0" />{label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 min-[450px]:grid-cols-2 gap-3">
            {availablePlatforms.length ? availablePlatforms.map((p) => (
              <button type="button" key={p.id} onClick={() => choosePlatform(p)}
                className="ifund-platform-choice rounded-2xl border px-3 py-3 text-left flex items-center gap-3 min-w-0 min-h-[78px]"
                aria-label={"Set up " + p.name}>
                <PlatformLogo platform={p} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-950 dark:text-white truncate">{p.name}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-300 mt-0.5">
                    {p.setupKind === "link" ? "Link an existing page" : p.setupKind === "oauth" ? "Check sign-in options" : "Guided setup"}
                  </span>
                </span>
              </button>
            )) : (
              <p className="col-span-full text-center text-sm text-slate-600 dark:text-slate-300 p-8">
                No matching platforms to add. Check your connected accounts above or change the filter.
              </p>
            )}
          </div>
        </div>
      </section>

      {dialog && (
        <ConnectDialog
          platform={dialog.platform}
          existing={dialog.existing}
          aiAuthorized={aiAuthorized}
          managedAvailable={managedAvailable}
          onManagedConnect={managedAvailable ? async ({ campaign_id }) =>
            requestManagedAction({
              platform: dialog.platform, connection: dialog.existing || null,
              action: dialog.existing ? "repair" : "connect", campaign_id,
            }) : null}
          onManagedCreateAccount={async ({ campaign_id }) => {
            const data = await requestManagedAction({ platform: dialog.platform, action: "create_account", campaign_id });
            if (data.state !== "waiting_user") setDialog(null);
          }}
          open={!!dialog}
          onOpenChange={(o) => !o && setDialog(null)}
          onAccountConsentChanged={(id, enabled) => setConnections(prev => prev.map(c => c.id === id ? ({
            ...c, obo_consent:{...(c.obo_consent || {}), granted:enabled,opted_out:!enabled},
            agent_access:{...(c.agent_access || {}),shared_with_agents:enabled,automation_enabled:false}
          }) : c))}
          onSaved={async (saved) => {
            setConnections((prev) => {
              const exists = prev.some((x) => x.id === saved.id);
              return exists ? prev.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...prev];
            });
            try {
              const verified = await base44.functions.invoke("verifyPlatformConnection", { connection_id: saved.id });
              const checked = verified?.data?.connection || saved;
              setConnections((prev) => prev.map((x) => (x.id === checked.id ? checked : x)));

              // Do not send, draft, or publish content merely because a user
              // connected an account. Only the separate publish control may do so.
              if (verified?.data?.working && saved.campaign_id && dialog.platform.kind !== "app") {
                setConnectionNotice({ ok: true, text: `${dialog.platform.name} is connected and paired with ${saved.display_name || "the campaign"}. Publish an approved update from your campaign when ready.` });
              } else if (verified?.data?.working) {
                setConnectionNotice({ ok: true, text: `${dialog.platform.name} is connected and working.` });
              } else if (verified?.data?.error) {
                setConnectionNotice({ ok: false, text: verified.data.error });
              }

              const resolved = await base44.functions.invoke("resolveConnectionStatus", {
                platform: checked.platform,
                connection_id: checked.id,
              });
              if (resolved?.data) setLifecycleMap((prev) => ({ ...prev, [saved.id]: resolved.data }));
            } catch {
              base44.functions.invoke("resolveConnectionStatus", { platform: saved.platform, connection_id: saved.id })
                .then(({ data }) => setLifecycleMap((prev) => ({ ...prev, [saved.id]: data })))
                .catch(() => {});
            }
          }}
        />
      )}

    </div>
  );
}
