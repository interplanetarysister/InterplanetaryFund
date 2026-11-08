import { readJsonBody, BodyError } from "../bodyLimit.js";
import { memberApi, reply, UUID } from "./memberApi.js";
import {
  connectionCatalog,
  connectionProvider,
  connectionMethods,
  connectionActionInput,
  CONNECTION_POLICY_VERSION,
} from "../connections/catalog.js";
function shape(raw, keys) {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).some((k) => !keys.includes(k))
  )
    throw Object.assign(Error("Check your connection options."), {
      status: 400,
    });
}
const invalid = () => {
  throw Object.assign(
    Error("Choose current connection records and permission."),
    { status: 400 },
  );
};
export function permissionInput(raw) {
  shape(raw, [
    "operation_id",
    "provider",
    "campaign_id",
    "policy_version",
    "confirmed",
  ]);
  if (
    !UUID.test(raw.operation_id || "") ||
    !connectionProvider(raw.provider) ||
    (raw.campaign_id != null && !UUID.test(raw.campaign_id)) ||
    raw.policy_version !== CONNECTION_POLICY_VERSION ||
    raw.confirmed !== true
  )
    invalid();
  return {
    p_operation_id: raw.operation_id,
    p_provider: raw.provider,
    p_campaign_id: raw.campaign_id || null,
    p_policy_version: raw.policy_version,
    p_confirmed: true,
  };
}
export function selectedConnectionInput(raw) {
  shape(raw, ["operation_id", "kind", "items"]);
  if (
    !UUID.test(raw.operation_id || "") ||
    !["revoke", "cancel"].includes(raw.kind) ||
    !Array.isArray(raw.items) ||
    raw.items.length < 1 ||
    raw.items.length > 50 ||
    new Set(raw.items.map((i) => i?.id)).size !== raw.items.length
  )
    invalid();
  for (const item of raw.items) {
    shape(item, ["id", "revision"]);
    if (!UUID.test(item.id || "") || !UUID.test(item.revision || "")) invalid();
  }
  return {
    p_operation_id: raw.operation_id,
    p_kind: raw.kind,
    p_items: raw.items,
  };
}
export async function handleManagedConnections(request, env, fetcher = fetch) {
  const path = new URL(request.url).pathname;
  if (path === "/health" && request.method === "GET")
    return reply(200, {
      service: "ifund-managed-connections-agent",
      enabled: env.IFUND_CONNECTIONS_ENABLED === "enabled",
      provider_execution: false,
      financial_authority: false,
    });
  if (env.IFUND_CONNECTIONS_ENABLED !== "enabled")
    return reply(503, { error: "Connection assistance is not available yet." });
  const prefix = "/api/agents/connections/";
  if (!path.startsWith(prefix))
    return reply(404, { error: "Connection action not found." });
  const route = path.slice(prefix.length);
  if (
    ![
      "workspace",
      "methods",
      "grant-help",
      "requests",
      "change-selected",
    ].includes(route)
  )
    return reply(404, { error: "Connection action not found." });
  if (
    request.method !==
    (route === "workspace" || route === "methods" ? "GET" : "POST")
  )
    return reply(405, { error: "Method not allowed." });
  try {
    const api = await memberApi(request, env, fetcher);
    // Viewing existing connection state and revoking/cancelling prior requests
    // remains available after plan expiry. Creating a new grant or provider
    // request requires the role's current plan entitlement.
    if (route === "grant-help" || route === "requests") {
      const entitlement = await api.rpc("ifund_story_subscription");
      if (!Number.isInteger(entitlement?.level) || entitlement.level < 2)
        return reply(403, { error: "An active Outreach plan or higher is required to request managed connection help." });
    }
    if (route === "workspace")
      return reply(200, {
        ...(await api.rpc("ifund_connections_workspace")),
        providers: connectionCatalog(),
      });
    if (route === "methods") {
      // Current backend membership check precedes even read-only setup guidance.
      await api.rpc("ifund_connections_workspace");
      const provider = new URL(request.url).searchParams.get("provider");
      if (!connectionProvider(provider)) invalid();
      // No IFund provider app has verified registration/capability receipts yet.
      return reply(200, connectionMethods(provider));
    }
    const raw = await readJsonBody(request, 16000);
    if (route === "grant-help")
      return reply(
        200,
        await api.rpc("ifund_connections_grant_help", permissionInput(raw)),
      );
    if (route === "change-selected")
      return reply(
        200,
        await api.rpc(
          "ifund_connections_change_selected",
          selectedConnectionInput(raw),
        ),
      );
    let input;
    try {
      input = connectionActionInput(raw);
    } catch {
      invalid();
    }
    return reply(
      200,
      await api.rpc("ifund_connections_request_action", {
        p_operation_id: input.operation_id,
        p_provider: input.provider,
        p_campaign_id: input.campaign_id,
        p_action: input.action,
        p_connection_id: input.connection_id,
      }),
    );
  } catch (e) {
    const status = e instanceof BodyError ? e.status : e.status || 503;
    return reply(status, {
      error:
        status >= 500
          ? "Connection assistance is temporarily unavailable."
          : status === 409
            ? "These connection records changed. Reload before choosing again."
            : status === 429
              ? "Your connection request limit has been reached. Try again later."
              : status === 400
                ? "Check the selected provider, campaign and current permission."
                : e.message || "This connection action is unavailable.",
      ...(e.code ? { code: e.code } : {}),
    });
  }
}
export default {
  fetch: (request, env) => handleManagedConnections(request, env),
};
