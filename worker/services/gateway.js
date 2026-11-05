import { serviceCatalog } from "./catalog.js";
import { campaignPreview } from "./campaign-preview.js";

const json = (status, data) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

/** Permanent service addresses are independent of the worker/model that performs the service. */
export async function serviceGateway(request, env) {
  const path = new URL(request.url).pathname;
  if (path === "/api/services/story_agent/campaign-preview")
    return campaignPreview(request, env);
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
    return json(200, {
      services: serviceCatalog().map(({ id, title }) => ({ id, title })),
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
  return json(404, { error: "This service is not available here yet." });
}
