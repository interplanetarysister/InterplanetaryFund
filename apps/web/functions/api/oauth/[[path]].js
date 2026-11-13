// Canonical same-origin member OAuth entrypoint on the existing Pages project.
// Reuse worker/oauth.js: never implement a second token vault or separate
// authorization rules in a Pages Function. All secrets remain runtime bindings.
// Preview without provider approval intentionally fails closed.
import { routeOAuthRequest } from "../../../../../worker/oauth.js";

export async function onRequest({ request, env }) {
  try {
    const result = await routeOAuthRequest(request, env);
    const headers = new Headers(result.headers);
    headers.set("cache-control", "no-store");
    headers.set("x-content-type-options", "nosniff");
    return new Response(result.body, { status: result.status, headers });
  } catch {
    return Response.json(
      { error: "Connection service is temporarily unavailable. Please try again later." },
      { status: 503, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } }
    );
  }
}
