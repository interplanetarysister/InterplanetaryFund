import { Navigate, useLocation, useParams } from "react-router-dom";

// Sprint 4 (2026-11-25): the single-page editor moved to the tabbed
// Campaign Workspace at /workspace/campaign/:id. This route stays as a
// compatibility redirect so saved links, My Campaigns, agent handoffs
// (?agentAdvice= / ?writing=) and field deep links (#campaign-title,
// #campaign-summary, #campaign-story, #campaign-goal,
// #campaign-atlas-location) keep working. Search and hash are forwarded
// unchanged; the workspace switches to the tab holding the target field.
export default function EditCampaign() {
  const { id } = useParams();
  const location = useLocation();
  return <Navigate to={`/workspace/campaign/${encodeURIComponent(id || "")}${location.search}${location.hash}`} replace />;
}
