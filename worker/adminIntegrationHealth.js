
import { migrationReady, response } from "./reads.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CF_VERIFY = "https://api.cloudflare.com/client/v4/user/tokens/verify";
const TYPES = Object.freeze(["cloudflare", "paypal", "facebook", "instagram", "google", "stripe"]);

/**
 * Administrator-only independent provider health.
 *
 * A configured secret is not a verified connection. Only Cloudflare's own
 * token verification endpoint produces an active provider status here.
 * Other services remain unverified until their own signed evidence adapters
 * and migration records are independently available.
 */
export async function routeAdminIntegrationHealth(request, env = {}, fetcher = fetch) {
  if (request.method !== "GET") return response(405, { error: "Method not allowed." });
  if (!migrationReady(env) || env.IFUND_ADMIN_HEALTH_ENABLED !== "enabled")
    return response(503, { error: "Independent health service unavailable." });

  const authHeader = request.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(authHeader))
    return response(401, { error: "Sign in required." });

  try {
    // Server-verified current account metadata, never user_metadata or
    // a decoded unverified JWT supplied by the browser.
    const accountResponse = await fetcher(env.SUPABASE_URL + "/auth/v1/user", {
      method: "GET",
      headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: authHeader },
      signal: AbortSignal.timeout(5000),
    });
    if (!accountResponse.ok) return response(401, { error: "Sign in required." });
    const account = await accountResponse.json();
    if (!UUID.test(account?.id || "")) return response(401, { error: "Sign in required." });
    const role = account?.app_metadata?.role;
    if (role !== "admin" && role !== "super_admin")
      return response(403, { error: "Administrator permission required." });

    let cloudflare = "unverified";
    // A backend-specific API token is an optional private Worker secret. It
    // must never be returned to the client or used to perform state changes.
    const token = env.IFUND_CLOUDFLARE_VERIFY_TOKEN;
    if (typeof token === "string" && token.length > 0) {
      try {
        const verified = await fetcher(CF_VERIFY, {
          method: "GET",
          headers: { Authorization: "Bearer " + token, Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        });
        if (verified.ok) {
          const record = await verified.json();
          if (record?.success === true && record?.result?.status === "active")
            cloudflare = "verified";
          else cloudflare = "needs_attention";
        } else {
          cloudflare = "needs_attention";
        }
      } catch {
        cloudflare = "unavailable";
      }
    }
    const services = TYPES.map(provider => ({
      provider,
      status: provider === "cloudflare" ? cloudflare : "unverified",
      // Payment, OAuth or AI integration success cannot be inferred from
      // a key, environment flag or the presence of a legacy Worker.
      actionable: false,
    }));
    return response(200, {
      readiness: "partial",
      active_financial_operations: false,
      automation_dispatch_enabled: false,
      provider_evidence: services,
      source: "independent_admin_read_only",
    });
  } catch {
    return response(503, { error: "Integration health cannot be verified." });
  }
}
