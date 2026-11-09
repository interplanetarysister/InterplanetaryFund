/**
 * Build a genuinely unified Strategy/Growth preview runtime from the deployed
 * Growth bundle, which already carries Strategy's shared implementation.
 * Reject source drift instead of silently applying a brittle transform.
 */
const MARKER = `var growth_default = {
  fetch(request, env) {
    return growthRoute(request, env);
  }
};`;
const REPLACEMENT = `var growth_default = {
  fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/health" && request.method === "GET") {
      return json(200, {
        service: "ifund-planning-agent-preview",
        strategy_enabled: env.IFUND_STRATEGY_ENABLED === "enabled",
        growth_enabled: env.IFUND_GROWTH_ENABLED === "enabled",
        publishing: false
      });
    }
    if (path.startsWith("/api/agents/strategy/")) return strategyRoute(request, env);
    if (path.startsWith("/api/agents/growth/")) return growthRoute(request, env);
    return json(404, { error: "Not found." });
  }
};`;

export function buildPlanningCompositeSource(growthModule) {
  if (typeof growthModule !== 'string' ||
      !growthModule.includes('function strategyRoute(') ||
      !growthModule.includes('function growthRoute(') ||
      growthModule.split(MARKER).length !== 2 ||
      !growthModule.includes('growth_default as default')) {
    throw Error('Unsupported Growth bundle; review upstream source before consolidation');
  }
  return growthModule.replace(MARKER, REPLACEMENT);
}
