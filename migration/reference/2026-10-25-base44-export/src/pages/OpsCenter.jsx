import React, { useState, useEffect, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RefreshCw, Loader2, ShieldAlert } from "lucide-react";
import OpsAgentCard from "@/components/ops/OpsAgentCard";
import OpsCampaignCard from "@/components/ops/OpsCampaignCard";
import TreasurySummary from "@/components/ops/TreasurySummary";
import OpsReports from "@/components/ops/OpsReports";
import FundMigrationDashboard from "@/components/ops/FundMigrationDashboard";
import PendingDonationReview from "@/components/ops/PendingDonationReview";
import PageError from "@/components/PageError";

// Ops Center — Base44-native operational view. Data is read directly from
// Base44 entities; refresh reloads the current authoritative platform state.
export default function OpsCenter() {
  const [agents, setAgents] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [treasury, setTreasury] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [providerState, setProviderState] = useState("unknown");
  const requestGeneration = useRef(0);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    try {
      const me = await base44.auth.me();
      if (!mountedRef.current || generation !== requestGeneration.current) return false;
      setUser(me || null);
      setAuthReady(true);
      if (me?.role !== "admin") {
        setLoading(false);
        setProviderState("unavailable");
        return true;
      }
      const [a, c, t, r] = await Promise.all([
        base44.entities.Agent.list("-trust_score", 50),
        base44.entities.MonitoredCampaign.list("-raised_amount", 50),
        base44.entities.TreasurySnapshot.list("-created_date", 1),
        base44.entities.ProtocolReport.list("-generated_at", 20),
      ]);
      if (![a, c, t, r].every(Array.isArray)) throw new Error("Malformed Ops Center response");
      if (!mountedRef.current || generation !== requestGeneration.current) return false;
      setAgents(a);
      setCampaigns(c);
      setTreasury(t[0] || null);
      setReports(r);
      setProviderState("available");
      setError(null);
      return true;
    } catch (e) {
      if (!mountedRef.current || generation !== requestGeneration.current) return false;
      setAuthReady(true);
      setProviderState("unavailable");
      setError("We couldn't load Ops Center data.");
      return false;
    } finally {
      if (mountedRef.current && generation === requestGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
      requestGeneration.current += 1;
    };
  }, [load]);

  const syncNow = async () => {
    setSyncing(true);
    setSyncError("");
    try {
      const ok = await load();
      if (!ok && mountedRef.current) setSyncError("Refresh failed — showing the last loaded data.");
    } catch (e) {
      console.error("Ops Center refresh failed:", e?.name || "UnknownError");
      if (mountedRef.current) setSyncError("Refresh failed — showing the last loaded data.");
    } finally {
      if (mountedRef.current) setSyncing(false);
    }
  };

  if (!authReady) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /></div>;
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6">
        <ShieldAlert className="w-10 h-10 text-stone-300 mx-auto" />
        <h1 className="font-display text-2xl text-stone-900 mt-4">Administrators only</h1>
        <p className="text-stone-500 mt-2">Ops Center and platform financial operations are restricted to platform administrators.</p>
      </div>
    );
  }

  const activeAgents = agents.filter((a) => (a.status || "").toLowerCase() === "active").length;
  const hasAgentData = providerState === "available";

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-slate-100">Ops Center</h1>
            <p className="text-xs text-slate-500">{hasAgentData ? `${activeAgents}/${agents.length} agents active · Base44 live data` : "Agent status unavailable · no synthetic agent data shown"}</p>
          </div>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 px-4 min-h-[44px] text-sm font-semibold disabled:opacity-60"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
        {syncError && <p className="mt-2 text-xs text-rose-400" role="alert">{syncError}</p>}

        {error ? (
          <PageError message={error} onRetry={() => { setError(null); setLoading(true); load(); }} />
        ) : loading ? (
          <div className="flex justify-center py-20" role="status" aria-live="polite"><Loader2 className="w-6 h-6 text-cyan-400 animate-spin" /><span className="sr-only">Loading Ops Center</span></div>
        ) : (
          <Tabs defaultValue="agents" className="mt-4">
            <TabsList className="w-full grid grid-cols-3 sm:grid-cols-6 bg-white/5 border border-white/10 rounded-xl h-11">
              <TabsTrigger value="agents" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Agents</TabsTrigger>
              <TabsTrigger value="campaigns" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Campaigns</TabsTrigger>
              <TabsTrigger value="treasury" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Treasury</TabsTrigger>
              <TabsTrigger value="migrate" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Migrate</TabsTrigger>
              <TabsTrigger value="donations" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Donations</TabsTrigger>
              <TabsTrigger value="reports" className="text-xs data-[state=active]:bg-cyan-400/15 data-[state=active]:text-cyan-300 rounded-lg">Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="agents" className="mt-4 space-y-3">
              {!hasAgentData && <p className="text-xs text-amber-400/80 text-center py-3">Agent status is currently unavailable. No synthetic agent data is shown.</p>}
              {hasAgentData && agents.length === 0 && <p className="text-sm text-slate-500 text-center py-10">No operational agents were returned.</p>}
              {agents.map((a) => <OpsAgentCard key={a.id} agent={a} />)}
            </TabsContent>
            <TabsContent value="campaigns" className="mt-4 space-y-3">
              {campaigns.length === 0 && <p className="text-sm text-slate-500 text-center py-10">No campaigns synced yet — tap Sync Now.</p>}
              {campaigns.map((c) => <OpsCampaignCard key={c.id} campaign={c} />)}
            </TabsContent>
            <TabsContent value="treasury" className="mt-4">
              <TreasurySummary snapshot={treasury} />
            </TabsContent>
            <TabsContent value="migrate" className="mt-4">
              <FundMigrationDashboard />
            </TabsContent>
            <TabsContent value="donations" className="mt-4">
              <PendingDonationReview />
            </TabsContent>
            <TabsContent value="reports" className="mt-4">
              <OpsReports reports={reports} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}