import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search } from "lucide-react";
import { format } from "date-fns";

const outcomeStyles = {
  success: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  warning: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  failure: "bg-red-100 text-red-700 hover:bg-red-100",
};

const categoryLabels = {
  configuration: "Configuration",
  health_check: "Health Check",
  knowledge: "Knowledge",
  deployment: "Deployment",
  security: "Security",
  recovery: "Recovery",
  other: "Other",
};

export default function TimelinePanel() {
  const [events, setEvents] = useState(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    base44.entities.PlatformEvent.list("-created_date", 100).then(setEvents);
  }, []);

  if (!events) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const q = query.toLowerCase();
  const filtered = events.filter(
    (e) => !q || e.action?.toLowerCase().includes(q) || e.affected_resource?.toLowerCase().includes(q) || e.actor_name?.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by action, resource, or actor…" className="pl-9" />
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-10">No platform events recorded yet.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200/70 shadow-sm divide-y divide-stone-100">
          {filtered.map((e) => (
            <div key={e.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-stone-900">{e.action}</p>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {format(new Date(e.created_date), "MMM d, yyyy · h:mm a")} · {e.actor_name}
                    {e.affected_resource ? ` · ${e.affected_resource}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary">{categoryLabels[e.category] || e.category}</Badge>
                  <Badge className={outcomeStyles[e.outcome] || outcomeStyles.success}>{e.outcome}</Badge>
                </div>
              </div>
              {e.details && <p className="text-xs text-stone-500 mt-1.5">{e.details}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}