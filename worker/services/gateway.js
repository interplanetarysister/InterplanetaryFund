import { serviceCatalog } from "./catalog.js";

const json = (status, data) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

// Only list specialists whose preview Worker is actually bound to this runtime.
// The stable catalog also preserves future positions; a catalog entry alone is
// not evidence that an executable service has been deployed.
const selectableBindings = Object.freeze({
  story_agent: "IFUND_STORY_AGENT",
  strategy_agent: "IFUND_STRATEGY_AGENT",
  growth_agent: "IFUND_GROWTH_AGENT",
  communications_agent: "IFUND_COMMUNICATIONS_AGENT",
});

/** Permanent service addresses are independent of the worker/model that performs the service. */
export async function serviceGateway(request, env) {
  const path = new URL(request.url).pathname;
  if (path === "/api/services/status") {
    if (request.method !== "GET")
      return json(405, { error: "Method not allowed." });
    if (!env.IFUND_STORY_AGENT?.fetch)
      return json(503, { error: "Service status is temporarily unavailable." });
    const url = new URL(request.url);
    url.pathname = "/api/agents/story/workforce-status";
    url.search = "";
    return env.IFUND_STORY_AGENT.fetch(new Request(url, request));
  }
  if (path === "/api/services") {
    if (request.method !== "GET")
      return json(405, { error: "Method not allowed." });
    if (
      !/^Bearer [A-Za-z0-9._~-]+$/.test(
        request.headers.get("authorization") || "",
      )
    )
      return json(401, { error: "Sign in to view your fundraising services." });
    if (!env.IFUND_STORY_AGENT?.fetch)
      return json(503, {
        error: "Fundraising services are temporarily unavailable.",
      });
    const authUrl = new URL(request.url);
    authUrl.pathname = "/api/agents/story/subscription";
    authUrl.search = "";
    const verified = await env.IFUND_STORY_AGENT.fetch(
      new Request(authUrl, request),
    );
    if (!verified.ok)
      return json(verified.status === 401 ? 401 : 403, {
        error: "Confirm access to your fundraising services.",
      });
    const entitlement = await verified.json().catch(() => null);
    if (
      !entitlement ||
      !Number.isInteger(entitlement.level) ||
      entitlement.level < 0 ||
      typeof entitlement.active !== "boolean"
    )
      return json(503, { error: "Service access could not be verified." });
    return json(200, {
      services: serviceCatalog()
        .filter((service) => {
          const bindingName = selectableBindings[service.id];
          return Boolean(bindingName && env[bindingName]?.fetch) &&
            entitlement.active === true &&
            service.min_plan_level !== null &&
            entitlement.level >= service.min_plan_level;
        })
        .map(({ id, title }) => ({ id, title })),
    });
  }
  const story =
    /^\/api\/services\/story_agent\/(drafts|cancel|subscription|context|select|revise|preferences|clear-preferences|cancel-queued|queued-requests)$/.exec(
      path,
    );
  if (story) {
    if (!env.IFUND_STORY_AGENT?.fetch)
      return json(503, {
        error: "The writing assistant is temporarily unavailable.",
      });
    const url = new URL(request.url);
    url.pathname = "/api/agents/story/" + story[1];
    return env.IFUND_STORY_AGENT.fetch(new Request(url, request));
  }
  const specialist = /^\/api\/services\/([^/]+)\/([^/]+)$/.exec(path);
  const adapters = {
    strategy_agent: ["IFUND_STRATEGY_AGENT", "strategy", ["workspace", "brief", "bulk", "subscription"]],
    growth_agent: ["IFUND_GROWTH_AGENT", "growth", ["workspace", "brief", "bulk", "subscription"]],
    communications_agent: ["IFUND_COMMUNICATIONS_AGENT", "communications", ["workspace", "save", "drafts", "cancel", "prepare-send", "send"]],
    managed_connection_agent: ["IFUND_CONNECTIONS_AGENT", "connections", ["workspace", "methods", "grant-help", "requests", "change-selected"]],
  };
  const adapter = specialist && Object.hasOwn(adapters, specialist[1])
    ? adapters[specialist[1]]
    : null;
  if (adapter && adapter[2].includes(specialist[2])) {
    const binding = env[adapter[0]];
    if (!binding?.fetch) return json(503, { error: "This service is temporarily unavailable." });
    const url = new URL(request.url);
    url.pathname = "/api/agents/" + adapter[1] + "/" + specialist[2];
    return binding.fetch(new Request(url, request));
  }
  return json(404, { error: "This service is not available here yet." });
}
