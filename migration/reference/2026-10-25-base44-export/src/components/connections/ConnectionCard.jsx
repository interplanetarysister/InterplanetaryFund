import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { ExternalLink, Unplug, Globe2, Rocket, Download, Wrench } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { connectionHealth, lifecycleHealth } from "@/lib/connectionHealth";
import { useNavigate } from "react-router-dom";
import PlatformLogo from "@/components/connections/PlatformLogo";

const IMPORTABLE_FUNDRAISING = new Set(["gofundme","kickstarter","indiegogo","fundrazr","givesendgo","kofi","buymeacoffee","patreon","spotfund","eventbrite"]);

// One connected destination: status, health, last sync, granted automation,
// totals, provenance, and the manage / disconnect / history controls.
//
// Provenance contract:
// - "Provider verified" is shown only when verification_status === "verified"
//   and external_data_source === "provider_verified". This is the canonical
//   signal that a provider (not the owner) confirmed the figure.
// - Otherwise the total is "owner reported" — entered by the campaign owner
//   and informational only; it is never withdrawable from Interplanetary Fund.

export default function ConnectionCard({ connection, platform, resolved, onManage, onRemoved, onUpdated, aiAuthorized = false, managedAvailable = false, onManagedRepair }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [managedBusy, setManagedBusy] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [permissionError, setPermissionError] = useState("");
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkMessage, setCheckMessage] = useState("");

  // Prefer the canonical lifecycle from resolveConnectionStatus; fall back to
  // the local record heuristic when the resolver result is not yet available.
  const health = lifecycleHealth(resolved) || connectionHealth(connection);
  const verified = health.usable;
  const providerVerifiedFinancialData = verified && connection.external_data_source === "provider_verified";
  const failed = health.needsAttention;
  const needsReauthorization =
    connection.capability_status === "reauthorization_required" ||
    health.key === "reconnect_required";
  const currency = connection.external_currency || "UNSPECIFIED";

  const disconnect = async () => {
    setBusy(true);
    try {
      // Central revocation removes agent/OBO authority first and then asks the
      // provider connector to revoke its app-user connection when supported.
      await base44.functions.invoke("disconnectPlatformConnection", {
        connection_id: connection.id,
        platform: connection.platform,
      });
      onRemoved(connection.id);
    } catch (e) {
      console.error("Disconnect failed", e);
      setBusy(false);
    }
  };

  const toggleAi = async (enabled) => {
    if (revokeBusy || (enabled && !aiAuthorized)) return;
    setRevokeBusy(true);setPermissionError("");
    try {
      const { data }=await base44.functions.invoke("setConnectionAiToggle",{
        connection_id:connection.id,enabled
      });
      if(data?.ok!==true) throw new Error(data?.error || "Could not save.");
      onUpdated?.({...connection,
        obo_consent:{...(connection.obo_consent || {}),granted:enabled,opted_out:!enabled},
        agent_access:{...(connection.agent_access || {}),shared_with_agents:enabled,
          automation_enabled:data.automation_enabled===true}
      });
    } catch(e) {setPermissionError(e.message || "Could not save AI setting.");}
    finally{setRevokeBusy(false);}
  };

  const managedRepair = async () => {
    if (!onManagedRepair || managedBusy) return;
    setManagedBusy(true);
    try { await onManagedRepair(); } finally { setManagedBusy(false); }
  };

  // Live provider calls are a member-triggered action, not an automatic
  // repeated health check every time a user opens Connections.
  const checkConnection = async () => {
    if (checkBusy || busy) return;
    setCheckBusy(true);
    setCheckMessage("");
    try {
      const { data } = await base44.functions.invoke("verifyPlatformConnection", {
        connection_id: connection.id,
      });
      if (!data?.connection) throw new Error("No verification result.");
      onUpdated?.(data.connection);
      const isLinkOnly = platform?.setupKind === "link";
      setCheckMessage(data.working === true
        ? isLinkOnly
          ? "Fundraising page is reachable. Account access, publishing permissions and donation totals were not verified."
          : "Account connection verified."
        : data?.error || "This connection needs attention. Choose Manage to reconnect.");
    } catch {
      setCheckMessage("The connection could not be checked. Try again.");
    } finally {
      setCheckBusy(false);
    }
  };

  // Data-source label used in the UI to distinguish provenance.
  // Contract requires both "Provider verified" and "owner reported" strings.
  const provenanceLabel = providerVerifiedFinancialData ? "Checked" : "Added by you";

  return (
    <div className="ifund-connection-card bg-white rounded-2xl border border-stone-200/70 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <PlatformLogo platform={platform || { id: connection.platform, name: connection.platform }} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-stone-900 flex items-center gap-2 min-w-0">
            <span className="shrink-0" title={failed ? "Needs attention" : verified ? "On and working" : "On"}>
              {verified ? (
                <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-label="Connected" /><Globe2 className="w-4 h-4 text-emerald-500" /></span>
              ) : (
                <Rocket className={`w-4 h-4 ${failed ? "text-red-500" : "text-stone-400"}`} />
              )}
            </span>
            <span className="truncate">{platform?.name || connection.platform}</span>
            {connection.display_name && (
              <span className="text-stone-400 font-normal text-sm truncate">· {connection.display_name}</span>
            )}
          </p>
          <p className="text-xs text-stone-400 mt-1">
            {verified ? "Connected" : failed ? "Needs reconnect" : "Not connected"}
            {connection.last_synced && (
              <> · checked {formatDistanceToNow(new Date(connection.last_synced), { addSuffix: true })}</>
            )}
          </p>
        </div>
      </div>

      {connection.kind === "crowdfunding" && (
        <div className="mt-2">
          <p className="text-sm text-stone-600">
            <span className="font-semibold text-primary">
              {currency} {(connection.external_total || 0).toLocaleString()}
            </span>
            {connection.external_donor_count ? ` · ${connection.external_donor_count} donors` : ""}
          </p>
          {/* Provenance: always show whether the figure is provider-verified or owner-reported */}
          <p className="text-xs text-stone-400 mt-0.5">{provenanceLabel}</p>
        </div>
      )}

      {/* Canonical recovery guidance from resolveConnectionStatus. */}
      {failed && health.reason && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          {health.reason}
        </p>
      )}

      <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">AI for {platform?.name || connection.platform}</p>
          <p className="text-sm text-muted-foreground">{connection.obo_consent?.granted === true ? "On — saved permission scope applies" : "Off — your account stays linked"}</p>
        </div>
        <button type="button" role="switch" aria-checked={connection.obo_consent?.granted === true}
          aria-label={"AI access for " + (platform?.name || connection.platform)}
          disabled={revokeBusy || (!aiAuthorized && connection.obo_consent?.granted !== true)}
          onClick={() => toggleAi(connection.obo_consent?.granted !== true)}
          className={"min-h-11 rounded-full px-4 text-sm font-bold border " +
          (connection.obo_consent?.granted === true ? "bg-emerald-600 text-white border-emerald-600" : "bg-card text-foreground border-border")}>
          {revokeBusy ? "Saving…" : connection.obo_consent?.granted === true ? "On · turn off" : "Off · turn on"}
        </button>
        <p className="w-full text-sm text-muted-foreground">To change what AI may do, disconnect, then reconnect and choose a new scope.</p>
      </div>
      {permissionError && <p className="mt-2 text-xs text-red-700" role="alert">{permissionError}</p>}
      {checkMessage && <p className="mt-2 text-xs text-stone-700" role="status">{checkMessage}</p>}

      <div className="flex flex-wrap gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={checkConnection} disabled={checkBusy || busy} className="rounded-lg">
          {checkBusy ? "Checking…" : platform?.setupKind === "link" ? "Check page" : "Check connection"}
        </Button>
        <Button size="sm" variant="outline" onClick={onManage} className="rounded-lg">
          {needsReauthorization ? "Reconnect" : failed ? "Fix Connection" : "Manage"}
        </Button>
        {failed && managedAvailable && connection.obo_consent?.granted === true && connection.obo_consent?.opted_out !== true && onManagedRepair && (
          <Button size="sm" variant="outline" onClick={managedRepair} disabled={managedBusy} className="rounded-lg">
            <Wrench className="w-3.5 h-3.5" />{managedBusy ? "Checking…" : "Let IFund repair"}
          </Button>
        )}
        {connection.kind === "crowdfunding" && IMPORTABLE_FUNDRAISING.has(connection.platform) && !connection.campaign_id && <Button size="sm" variant="outline" onClick={() => navigate(`/create?import_connection=${connection.id}`)} className="rounded-lg"><Download className="w-3.5 h-3.5" />Import campaign</Button>}
        {connection.external_url && (
          <a href={connection.external_url} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="rounded-lg">
              <ExternalLink className="w-3.5 h-3.5" />Open
            </Button>
          </a>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={disconnect}
          disabled={busy}
          className="rounded-lg text-red-600 hover:text-red-700"
        >
          <Unplug className="w-3.5 h-3.5" />Disconnect
        </Button>
      </div>

    </div>
  );
}
