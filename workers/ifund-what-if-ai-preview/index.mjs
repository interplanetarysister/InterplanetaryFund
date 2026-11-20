// Isolated What If Mission planner. Pages PREVIEW service binding only.
// No payment operations, external account mutations, publishing or provider actions.
// The model produces a reviewable plan only after verified JWT, consent and quota.
import { routeMissionPlan } from "../../worker/missions/plan.js";
export default {
  fetch(request, env) {
    return new URL(request.url).pathname === "/api/missions/plan"
      ? routeMissionPlan(request, env)
      : Response.json({ error: "Not found" }, { status: 404 });
  },
};
