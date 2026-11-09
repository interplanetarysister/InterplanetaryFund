/** Architecture-only routing/permission contract for proposed advisory composite Worker. */
const ROUTES = Object.freeze([
  {prefix:'/api/agents/strategy/',capability:'strategy',flag:'IFUND_STRATEGY_ENABLED'},
  {prefix:'/api/agents/growth/',capability:'growth',flag:'IFUND_GROWTH_ENABLED'},
]);
export function routePlanningAgent(pathname, flags = {}) {
  if (typeof pathname !== 'string') return null;
  const route = ROUTES.find(({prefix})=>pathname.startsWith(prefix));
  if (!route || flags[route.flag] !== 'true') return null;
  return Object.freeze({capability:route.capability,routePrefix:route.prefix,authorizationRequired:true,recommendationReviewWriteAllowed:true,campaignMutationAllowed:false,externalSendAllowed:false});
}
