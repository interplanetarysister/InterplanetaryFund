import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Loader2, Pause, Play, Bot, Check, X } from "lucide-react";
import { effectiveSubscription } from "@/lib/subscriptionEntitlements";
import { useFeatureEnabled } from "@/lib/useFeatureEnabled";

// Owner-only panel: activate/pause the autonomous AI Outreach Agent and
// review its activity log. Every action stays pending until the owner approves
// or rejects it — the agent never executes without authorization.
export default function OutreachAgentPanel({ campaign }) {
  const platformEnabled = useFeatureEnabled("ai_outreach_agent");
  const [user, setUser] = useState(null);
  const [activities, setActivities] = useState(null);
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(!!campaign.outreach_enabled);
  const [paused, setPaused] = useState(!!campaign.outreach_paused);
  const [error, setError] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => { setEnabled(!!campaign.outreach_enabled); setPaused(!!campaign.outreach_paused); }, [campaign.id, campaign.outreach_enabled, campaign.outreach_paused]);

  const load = useCallback(async () => {
    try {
      const me = await base44.auth.me();
      setUser(me);
      const acts = await base44.entities.AgentActivity.filter({ campaign_id: campaign.id }, "-created_date", 30);
      setActivities(Array.isArray(acts) ? acts : []);
      setError("");
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
      setActivities([]);
      setError("AI outreach activity could not be loaded. Refresh this page to try again.");
    }
  }, [campaign.id]);

  useEffect(() => { load(); }, [load]);

  const subscription = effectiveSubscription(user);
  const hasOutreach = subscription.active && subscription.plan.level >= 2;
  const automationReady = !!platformEnabled && hasOutreach && user?.ai_obo_consent?.granted === true;

  const toggleEnabled = async () => {
    if (!platformEnabled || enabling) return;
    setEnabling(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("updateCampaignSettings", {
        campaign_id: campaign.id, patch: { outreach_enabled: !enabled },
      });
      if (data?.ok !== true) throw new Error("Campaign setting update rejected");
      setEnabled((value) => !value);
    } catch {
      setError("Could not save the outreach automation setting. Try again.");
    } finally {
      setEnabling(false);
    }
  };

  const togglePaused = async () => {
    if (enabling) return;
    setEnabling(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("updateCampaignSettings", {
        campaign_id: campaign.id, patch: { outreach_paused: !paused },
      });
      if (data?.ok !== true) throw new Error("Campaign setting update rejected");
      setPaused((value) => !value);
    } catch {
      setError("Could not change the outreach pause setting. Try again.");
    } finally {
      setEnabling(false);
    }
  };

  const setStatus = async (id, status) => {
    setError("");
    try {
      const { data } = await base44.functions.invoke("reviewAgentActivity", { activity_id: id, status });
      if (data?.ok !== true) throw new Error("Agent activity review rejected");
      setActivities((prev) => (prev || []).map((a) => (a.id === id ? { ...a, status } : a)));
    } catch {
      setError("Could not update the recommendation review. Try again.");
    }
  };

  if (loadFailed) return <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{error} <Button size="sm" variant="outline" onClick={load}>Retry</Button></div>;
  if (!user || !activities) {
    return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-950 to-slate-900 p-5 text-slate-200">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display text-lg text-slate-100">AI Outreach Agent</h3>
        </div>
        {enabled ? (
          <Badge variant="outline" className="border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
            {paused ? "Paused" : automationReady ? "Active · scheduled" : "Waiting for AI permission or plan"}
          </Badge>
        ) : (
          <Badge variant="outline" className="border-white/15 text-slate-400">Off</Badge>
        )}
      </div>

      {error && <p className="text-sm text-red-300 mt-2" role="alert">{error}</p>}
      {!platformEnabled && <p className="text-sm text-amber-200 mt-2">New automated outreach runs are paused. Existing recommendations remain available for review.</p>}
      {hasOutreach && enabled && !user?.ai_obo_consent?.granted && <p className="text-sm text-amber-200 mt-2">To run this agent, <Link to="/connections" className="underline">turn on IFund AI help</Link>. No outreach will run before authorization.</p>}
      {!hasOutreach ? (
        <div className="mt-3">
          <p className="text-sm text-slate-400 mb-3">
            The AI Outreach Agent checks opted-in campaigns on a schedule, prepares outreach drafts,
            and recommends improvements for your review. Upgrade to unlock it.
          </p>
          <Link to="/subscriptions">
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl">
              <Sparkles className="w-4 h-4 mr-2" /> Unlock AI Outreach Agent
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4 mt-3 rounded-xl bg-white/5 p-3">
            <div>
              <p className="text-sm text-slate-200 font-medium">Enable autonomous agent</p>
              <p className="text-xs text-slate-400">Scheduled checks prepare drafts and recommendations for your approval. Messages are never sent automatically.</p>
            </div>
            <Switch checked={enabled && platformEnabled} onCheckedChange={toggleEnabled} disabled={enabling || !platformEnabled} />
          </div>

          {enabled && (
            <div className="flex items-center justify-between gap-4 mt-2 rounded-xl bg-white/5 p-3">
              <p className="text-sm text-slate-200">Pause agent temporarily</p>
              <Button size="sm" variant="ghost" onClick={togglePaused} disabled={enabling} className="text-cyan-300 hover:bg-white/10">
                {paused ? <><Play className="w-4 h-4 mr-1" />Resume</> : <><Pause className="w-4 h-4 mr-1" />Pause</>}
              </Button>
            </div>
          )}

          {(campaign.outreach_last_run_at || campaign.outreach_last_error) && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              {campaign.outreach_last_run_at && <p className="text-xs text-slate-300">
                Last successful analysis: {new Date(campaign.outreach_last_run_at).toLocaleString()}
              </p>}
              {campaign.outreach_last_error && <p className="text-xs text-amber-200 mt-1">{campaign.outreach_last_error}</p>}
            </div>
          )}
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Activity log</p>
            {activities.length === 0 ? (
              <p className="text-xs text-slate-500">No activity yet. When the agent runs, each action appears here for your review.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {activities.map((a) => (
                  <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className="capitalize border-white/15 text-slate-300">{a.category}</Badge>
                      <span className="text-[11px] text-slate-500">
                        {new Date(a.created_date).toLocaleDateString()} {new Date(a.created_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm text-slate-200">{a.action}</p>
                    {a.reason && <p className="text-xs text-slate-400 mt-1">Why: {a.reason}</p>}
                    {a.expected_impact && <p className="text-xs text-slate-400">Expected impact: {a.expected_impact}</p>}
                    {a.result && <p className="text-xs text-emerald-400/90">Result: {a.result}</p>}
                    {a.category === "outreach" && a.description && <div className="mt-2 rounded-lg bg-slate-800 p-2"><p className="text-xs font-semibold text-cyan-200">Prepared outreach message</p><p className="text-xs text-slate-200 mt-1 whitespace-pre-wrap">{a.description}</p><p className="text-[11px] text-slate-400 mt-1">This draft has not been sent.</p></div>}
                    {a.recommended_next_actions && a.recommended_next_actions.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {a.recommended_next_actions.map((n, i) => (
                          <li key={i} className="text-xs text-slate-400">→ {n}</li>
                        ))}
                      </ul>
                    )}
                    {a.status === "pending" && (
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" onClick={() => setStatus(a.id, "approved")} className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
                          <Check className="w-3.5 h-3.5 mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setStatus(a.id, "rejected")} className="h-7 text-red-400 hover:bg-white/10 rounded-lg">
                          <X className="w-3.5 h-3.5 mr-1" />Reject
                        </Button>
                      </div>
                    )}
                    {a.status !== "pending" && (
                      <Badge variant="outline" className="mt-2 capitalize border-white/15 text-slate-400">{a.status}</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}