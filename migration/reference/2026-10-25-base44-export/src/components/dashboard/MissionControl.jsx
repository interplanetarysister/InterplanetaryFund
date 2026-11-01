import React, { useState } from "react";
import { Link } from "react-router-dom";
import { generateMissionRecommendations } from "@/lib/creditFreeGenerators";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { campaignActionDestination } from "@/lib/actionDestinations";

const priorityStyles = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-stone-100 text-stone-600 border-stone-200",
};

export default function MissionControl({ campaigns }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wixSync, setWixSync] = useState(null);

  const syncWix = async () => {
    setWixSync({ state: "syncing" });
    try {
      const results = await Promise.all([
        base44.functions.invoke("syncWixCampaigns", {}),
        base44.functions.invoke("syncWixContent", {}),
        base44.functions.invoke("syncWixBusinessData", {}),
        base44.functions.invoke("syncWixAnalytics", {}),
      ]);
      setWixSync({ state: "ok", results: results.map((r) => r?.data || {}) });
    } catch {
      setWixSync({ state: "error" });
    }
  };

  const generate = () => {
    setLoading(true);
    const recommendations = generateMissionRecommendations(campaigns).map((item) => ({
      title: item.title,
      reason: item.description,
      priority: item.priority,
      action: item.action,
      campaignId: item.campaignId,
    }));
    setInsights(recommendations);
    setLoading(false);
  };

  return (
    <div className="bg-slate-950 rounded-2xl p-6 text-slate-200">
      <div className="flex items-center justify-between gap-4 mb-1">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </span>
          <h2 className="font-display text-lg text-slate-100">Mission Control</h2>
        </div>
        <Button size="sm" onClick={generate} disabled={loading || campaigns.length === 0} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze"}
        </Button>
        <Button size="sm" variant="outline" onClick={syncWix} disabled={wixSync?.state === "syncing"} className="border-cyan-500/40 bg-transparent text-cyan-300 hover:bg-cyan-950/40 hover:text-cyan-200">{wixSync?.state === "syncing" ? "Syncing Wix…" : "Sync Wix"}</Button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Credit-free recommendations — you always make the final call.{" "}
        <Link to="/mission" className="text-cyan-400 hover:text-cyan-300 font-medium">Open full Mission Control →</Link>
      </p>
      {wixSync?.state === "ok" && <p className="text-xs text-emerald-300 mb-3">Wix is synchronized with the current IFund campaign, content, business-data, and analytics lanes.</p>}
      {wixSync?.state === "error" && <p className="text-xs text-amber-300 mb-3">Wix sync could not finish. Existing IFund data was left unchanged.</p>}
      {campaigns.length === 0 && <p className="text-sm text-slate-500">Create your first campaign and Mission Control will start advising you.</p>}
      {insights && (
        <ul className="space-y-3">
          {insights.map((r, i) => (
            <li key={i} className="bg-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-100">{r.title}</p>
                <Badge variant="outline" className={`shrink-0 capitalize ${priorityStyles[r.priority] || priorityStyles.low}`}>{r.priority}</Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{r.reason}</p>
              {campaignActionDestination({ campaignId: r.campaignId, action: r.action, title: r.title }) && (
                <Link to={campaignActionDestination({ campaignId: r.campaignId, action: r.action, title: r.title })}
                  className="inline-flex items-center mt-3 rounded-lg border border-cyan-400/40 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/10">
                  {r.action || "Go to action"} →
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}