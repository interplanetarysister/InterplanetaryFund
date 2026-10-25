import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import BriefingPanel from "@/components/mission/BriefingPanel";
import RecommendationsPanel from "@/components/mission/RecommendationsPanel";
import OpportunitiesPanel from "@/components/mission/OpportunitiesPanel";
import AutomationPanel from "@/components/mission/AutomationPanel";
import { Sparkles, Loader2 } from "lucide-react";
import PullToRefresh from "@/components/mobile/PullToRefresh";

export default function MissionControlPage() {
  const [brief, setBrief] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const me = await base44.auth.me();
    const briefs = await base44.entities.MissionBrief.filter({ created_by_id: me.id });
    setBrief(briefs[0] || null);
    setLoaded(true);
  }, []);

  useEffect(() => { load(); }, [load]);

  const analyze = async () => {
    setAnalyzing(true);
    setError("");
    try {
      const { data } = await base44.functions.invoke("generateIntelligence", { mode: "briefing" });
      setBrief(data.brief);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      console.error("Mission Control analysis failed:", e?.name || "UnknownError");
      setError("Analysis failed. Please try again.");
    }
    setAnalyzing(false);
  };

  return (
    <PullToRefresh onRefresh={load} className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-3xl sm:text-4xl text-foreground">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </span>
            Mission Control
          </h1>
        </div>
        <Button onClick={analyze} disabled={analyzing} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11 px-5">
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Run analysis
        </Button>
      </div>
      <p className="text-stone-500 mb-2">Your strategic intelligence partner — it observes, explains, and recommends. You decide.</p>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      {analyzing && <p className="text-xs text-stone-400 mb-4">Coordinating agents and analyzing your campaigns — this takes a moment…</p>}

      {loaded && (
        <Tabs defaultValue="briefing" className="mt-6">
          <TabsList className="mb-6">
            <TabsTrigger value="briefing">Briefing</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
          </TabsList>
          <TabsContent value="briefing">
            <BriefingPanel brief={brief} />
          </TabsContent>
          <TabsContent value="recommendations">
            <RecommendationsPanel refreshKey={refreshKey} />
          </TabsContent>
          <TabsContent value="opportunities">
            <OpportunitiesPanel />
          </TabsContent>
          <TabsContent value="automation">
            <AutomationPanel />
          </TabsContent>
        </Tabs>
      )}
    </PullToRefresh>
  );
}