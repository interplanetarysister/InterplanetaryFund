// Isolated What If Mission service. Bound to Pages and exact public API routes.
// Guest exploration is deterministic and does not persist or invoke AI.
// Private inference independently verifies member identity, consent and quota.
import { routeMissionPlan } from "../../worker/missions/plan.js";
import { routeMissionExplore } from "../../worker/missions/explore.js";
export default {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/api/missions/plan") return routeMissionPlan(request, env);
    if (path === "/api/missions/explore") return routeMissionExplore(request, env);
    return Response.json({ error: "Not found" }, { status: 404, headers: {"cache-control":"no-store"} });
  },
};
