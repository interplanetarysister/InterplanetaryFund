import { mayUseFutureInternalAI } from "../../apps/web/src/lib/internalAIConsent.mjs";
export const SUPABASE_ORIGIN = "https://ssibsfmtodgximseeqsv.supabase.co";
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const reply = (status, body) =>
  Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
export const fail = (status, message, code) => {
  throw Object.assign(Error(message), { status, code });
};
export const revision = (value) =>
  typeof value === "string" &&
  value.length <= 48 &&
  /^\d{4}-\d{2}-\d{2}T/.test(value) &&
  Number.isFinite(Date.parse(value));
export async function memberApi(request, env, fetcher = fetch) {
  const bearer = request.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9._~-]+$/.test(bearer))
    fail(401, "Sign in to use your assistant.");
  if (env.SUPABASE_URL !== SUPABASE_ORIGIN || !env.SUPABASE_PUBLISHABLE_KEY)
    fail(503, "Your assistant is not available yet.");
  async function upstream(path, body) {
    const r = await fetcher(SUPABASE_ORIGIN + path, {
      method: body ? "POST" : "GET",
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: bearer,
        "content-type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(12000),
    });
    let data;
    try { data = await readJsonBody(r, 1024 * 1024); }
    catch {
      if (r.ok) fail(503, "Your assistant returned an unverified response.");
      data = {};
    }
    if (!r.ok) {
      if (data.code === "P1001")
        fail(
          429,
          "Your saved-draft limit has been reached. Cancel some drafts before creating another.",
          "draft_capacity",
        );
      if (data.code === "40001" || r.status === 409)
        fail(
          409,
          "Your saved messages or review have changed. Reload before choosing again.",
          "refresh_required",
        );
      if (data.code === "54000")
        fail(
          429,
          "This action has reached its current limit. Wait a moment or choose fewer messages.",
        );
      if (r.status === 401) fail(401, "Please sign in again.");
      if (r.status === 403)
        fail(403, "Your account cannot use this action yet.");
      if (data.code === "22023" || r.status === 400)
        fail(
          400,
          "These message options could not be accepted. Check your selection and try again.",
        );
      fail(503, "Your assistant is temporarily unavailable.");
    }
    return data;
  }
  const user = await upstream("/auth/v1/user");
  if (!UUID.test(user?.id || "") || !user.email_confirmed_at || user.is_anonymous === true)
    fail(401, "Confirm your email before continuing.");
  return {
    user,
    jwt: bearer.slice(7),
    rpc: (name, body = {}) => upstream("/rest/v1/rpc/" + name, body),
    async futureInternalAIPermission(capability, required = true) {
      // Server-side read using the requester's verified JWT and owner-scoped
      // filter. An unknown future action never inherits an existing grant.
      let preferences;
      try {
        preferences = await upstream("/rest/v1/ifund_ai_permission_preferences?select=owner_id,allow_future_internal_ai_assistance&owner_id=eq." + user.id);
      } catch (error) {
        if (!required) return false;
        throw error;
      }
      const allowed = Array.isArray(preferences) && preferences.length === 1 &&
        mayUseFutureInternalAI({ user, preferences: preferences[0], capability });
      if (!allowed && required) fail(403, "Enable private AI assistance in My Account before asking the team.");
      return allowed;
    },
    async aiPermission(kind, required = true) {
      if (!["campaign", "outreach"].includes(kind))
        fail(503, "AI permission could not be verified.");
      const field = "allow_ai_" + kind + "_drafts";
      let preferences;
      try {
        preferences = await upstream("/rest/v1/ifund_ai_permission_preferences?select=" + field + "&owner_id=eq." + user.id);
      } catch (error) {
        if (!required) return false;
        throw error;
      }
      const allowed = Array.isArray(preferences) && preferences.length === 1 && preferences[0]?.[field] === true;
      if (!allowed && required)
        fail(403, "Enable the matching AI drafting permission in My Account before requesting AI suggestions.");
      return allowed;
    },
  };
}
import { readJsonBody } from "../bodyLimit.js";
