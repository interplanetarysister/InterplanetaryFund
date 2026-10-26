import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ConfidenceBadge from "./ConfidenceBadge";
import { Loader2, Search, Bookmark, X } from "lucide-react";

const typeLabels = {
  grant: "Grant",
  matching_gift: "Matching Gift",
  corporate_giving: "Corporate Giving",
  foundation: "Foundation",
  business: "Business",
  community: "Community",
  media: "Media",
  event: "Event",
  other: "Other",
};

export default function OpportunitiesPanel() {
  const [opps, setOpps] = useState(null);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const me = await base44.auth.me();
    const items = await base44.entities.Opportunity.filter({ created_by_id: me.id }, "-created_date", 50);
    setOpps(items.filter((o) => o.status !== "dismissed"));
  }, []);

  useEffect(() => { load(); }, [load]);

  const discover = async () => {
    setDiscovering(true);
    setError("");
    try {
      await base44.functions.invoke("generateIntelligence", { mode: "opportunities" });
      await load();
    } catch (e) {
      console.error("Opportunity discovery failed:", e?.name || "UnknownError");
      setError("Discovery failed. Please try again.");
    }
    setDiscovering(false);
  };

  const setStatus = async (opp, status) => {
    setOpps((prev) => status === "dismissed" ? prev.filter((o) => o.id !== opp.id) : prev.map((o) => (o.id === opp.id ? { ...o, status } : o)));
    const { data } = await base44.functions.invoke("updateMissionItemStatus", { kind: "opportunity", id: opp.id, status });
    if (data?.ok !== true) throw new Error("Mission item update rejected");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-stone-500">Real-world grants, matching programs, and partnerships found for your campaigns.</p>
        <Button onClick={discover} disabled={discovering} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shrink-0">
          {discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Discover
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {discovering && <p className="text-xs text-stone-400">Searching the web for relevant opportunities — this can take up to a minute…</p>}

      {opps === null ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : opps.length === 0 && !discovering ? (
        <p className="text-sm text-stone-400 text-center py-12">No opportunities yet — hit Discover to start the search.</p>
      ) : (
        opps.map((o) => (
          <div key={o.id} className="bg-white rounded-2xl border border-stone-200/70 shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-900">{o.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <Badge variant="secondary">{typeLabels[o.type] || o.type}</Badge>
                  {o.estimated_value && <Badge variant="outline" className="text-emerald-700 border-emerald-200">{o.estimated_value}</Badge>}
                  {o.status === "saved" && <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Saved</Badge>}
                </div>
              </div>
              <ConfidenceBadge level={o.confidence} />
            </div>
            {o.description && <p className="text-sm text-stone-600 mt-2">{o.description}</p>}
            <div className="mt-3 space-y-1.5 text-xs text-stone-500">
              {o.eligibility && <p><span className="font-semibold text-stone-700">Eligibility:</span> {o.eligibility}</p>}
              {o.required_actions && <p><span className="font-semibold text-stone-700">Next steps:</span> {o.required_actions}</p>}
              {o.source && <p><span className="font-semibold text-stone-700">Source:</span> {o.source}</p>}
            </div>
            <div className="flex items-center gap-2 mt-4">
              {o.status !== "saved" && (
                <Button size="sm" variant="outline" onClick={() => setStatus(o, "saved")} className="rounded-lg">
                  <Bookmark className="w-3.5 h-3.5" /> Save
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setStatus(o, "dismissed")} className="rounded-lg text-stone-500">
                <X className="w-3.5 h-3.5" /> Dismiss
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}