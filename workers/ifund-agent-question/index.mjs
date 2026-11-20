// Standalone, supervised Agent Team inference endpoint.
// The implementation is shared with the same-origin IFund API router.
// No publishing, financial, provider-auth or cross-account actions are exposed.
import { routeTeamQuestion } from "../../worker/agents/teamQuestion.js";
import { routeMissionPlan } from "../../worker/missions/plan.js";
export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === '/api/missions/plan') return routeMissionPlan(request, env);
    return routeTeamQuestion(request, env);
  },
};
