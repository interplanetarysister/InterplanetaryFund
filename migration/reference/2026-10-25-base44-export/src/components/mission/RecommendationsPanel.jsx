import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import RecommendationCard from "./RecommendationCard";
import { Loader2 } from "lucide-react";

export default function RecommendationsPanel({ refreshKey }) {
  const [recs, setRecs] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const me = await base44.auth.me();
    const [created, assigned] = await Promise.all([
      base44.entities.Recommendation.filter({ created_by_id: me.id }, "-created_date", 30),
      base44.entities.Recommendation.filter({ owner_user_id: me.id }, "-created_date", 30),
    ]);
    setRecs([...new Map([...(created || []), ...(assigned || [])].map(item => [item.id, item])).values()]
      .sort((a,b) => new Date(b.created_date) - new Date(a.created_date))
      .slice(0, 40));
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (!recs) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const setStatus = async (rec, status) => {
    setError("");
    try {
      const { data } = await base44.functions.invoke("updateMissionItemStatus", { kind: "recommendation", id: rec.id, status });
      if (data?.ok !== true) throw new Error("Mission item update rejected");
      setRecs((prev) => prev.map((r) => (r.id === rec.id ? { ...r, status } : r)));
      return true;
    } catch {
      setError("We couldn't record your decision. Please retry.");
      return false;
    }
  };

  const open = recs.filter((r) => r.status === "open");
  const resolved = recs.filter((r) => r.status !== "open");

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {recs.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-12">No recommendations yet — run an analysis to get your ranked action list.</p>
      )}
      {open.map((r) => <RecommendationCard key={r.id} rec={r} onStatus={setStatus} />)}
      {resolved.length > 0 && (
        <>
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wide pt-2">Resolved</p>
          {resolved.map((r) => <RecommendationCard key={r.id} rec={r} onStatus={setStatus} />)}
        </>
      )}
    </div>
  );
}