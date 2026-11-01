import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ConfidenceBadge from "./ConfidenceBadge";
import { ChevronDown, ChevronUp, Check, X, ArrowUpRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { campaignActionDestination } from "@/lib/actionDestinations";

const agentLabels = {
  strategy: "Strategy Agent",
  growth: "Growth Agent",
  communications: "Communications Agent",
  story: "Story Agent",
  finance: "Financial Agent",
};

export default function RecommendationCard({ rec, onStatus }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const isOpen = rec.status === "open";
  const actionPath = campaignActionDestination({
    campaignId: rec.campaign_id, title: rec.title,
    description: rec.description, action: rec.action || rec.recommended_action,
  });

  const acceptAndOpen = async () => {
    if (accepting) return;
    setAccepting(true);
    try {
      const accepted = await onStatus(rec, "accepted");
      // Acceptance records the user's choice; opening an edit/publish surface
      // does not automatically post, message, or modify the campaign.
      if (accepted !== false && actionPath) navigate(actionPath);
    } finally { setAccepting(false); }
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${isOpen ? "border-stone-200/70" : "border-stone-100 opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-stone-900">{rec.title}</p>
          <p className="text-xs text-stone-400 mt-0.5">
            {agentLabels[rec.agent] || "Mission Control"}{rec.campaign_title ? ` · ${rec.campaign_title}` : ""}
          </p>
        </div>
        <ConfidenceBadge level={rec.confidence} />
      </div>
      {rec.description && <p className="text-sm text-stone-600 mt-2">{rec.description}</p>}

      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 mt-3">
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Why this recommendation?
      </button>
      {expanded && (
        <div className="mt-3 rounded-xl bg-stone-50 p-4 space-y-2 text-xs text-stone-600">
          {rec.reasoning && <p><span className="font-semibold text-stone-800">Reasoning:</span> {rec.reasoning}</p>}
          {rec.evidence && <p><span className="font-semibold text-stone-800">Evidence:</span> {rec.evidence}</p>}
          {rec.expected_impact && <p><span className="font-semibold text-stone-800">Expected impact:</span> {rec.expected_impact}</p>}
          {rec.estimated_effort && <p><span className="font-semibold text-stone-800">Estimated effort:</span> {rec.estimated_effort}</p>}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {actionPath && (
          <Button asChild size="sm" variant="outline" className="rounded-lg">
            <Link to={actionPath}><ArrowUpRight className="w-3.5 h-3.5" /> Go to action</Link>
          </Button>
        )}
        {isOpen ? (
          <>
            <Button size="sm" onClick={acceptAndOpen} disabled={accepting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg">
              <Check className="w-3.5 h-3.5" /> {actionPath ? "Accept & open" : "Accept"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onStatus(rec, "dismissed")} className="rounded-lg">
              <X className="w-3.5 h-3.5" /> Dismiss
            </Button>
          </>
        ) : (
          <Badge variant="secondary" className="capitalize">{rec.status}</Badge>
        )}
      </div>
    </div>
  );
}