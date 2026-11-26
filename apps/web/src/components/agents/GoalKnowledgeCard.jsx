import React from "react";
import { AgentIdentityIcon } from "@/components/agents/AgentIdentityIcon";

const AREA_LABELS = {
  fastest_path: "Fastest path",
  easiest_path: "Easiest path",
  requirements_priorities: "Your requirements & priorities",
  category_best_practice: "Category best practices",
  benchmarks: "Realistic amounts & timelines",
  story_and_influence: "Story & influence angles",
  marketing_and_social: "Marketing & social techniques",
  ifund_services_fit: "How iFund's services fit",
  alternatives_and_grants: "Grants & alternatives",
  risks_and_claims: "Risks & claims to avoid",
};

/**
 * "Refine Knowledge About Your Goal" card: a research plan has been prepared
 * for the member's kind of goal. The whole team works from the resulting
 * brief through shared team context. A prepared plan is never presented as
 * completed research.
 */
export default function GoalKnowledgeCard({ goalKnowledge }) {
  if (!goalKnowledge || goalKnowledge.kind !== "goal_knowledge_refinement") return null;
  const areas = Array.isArray(goalKnowledge.knowledge_areas) ? goalKnowledge.knowledge_areas : [];
  return (
    <div className="mt-2 rounded-xl border border-emerald-300/30 bg-emerald-300/5 p-3">
      <div className="flex items-center gap-2">
        <AgentIdentityIcon identity="nexus" size={28} />
        <p className="text-sm font-semibold">{goalKnowledge.label || "Refine Knowledge About Your Goal"}</p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Research plan prepared for your kind of goal. The team gets about{" "}
        {goalKnowledge.estimated_minutes || 2} minutes to research the fastest and easiest paths and the
        best practices for this category, then every agent you talk to works from what it finds
        {goalKnowledge.context_saved ? " — it's saved to your team context" : ""}. Nothing has been
        published or sent.
      </p>
      {areas.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {areas.map(area => (
            <li key={area} className="rounded-full border border-emerald-300/30 px-2 py-0.5 text-xs">
              {AREA_LABELS[area] || area.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
