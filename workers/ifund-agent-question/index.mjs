// Standalone, supervised Agent Team inference endpoint.
// The implementation is shared with the same-origin IFund API router.
// No publishing, financial, provider-auth or cross-account actions are exposed.
import { routeTeamQuestion } from "../../worker/agents/teamQuestion.js";
export default {
  fetch(request, env) {
    return routeTeamQuestion(request, env);
  },
};
