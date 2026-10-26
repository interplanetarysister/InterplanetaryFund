// UI-only constants for the integration registry. Mirrors the server-side
// labels in base44/shared/integrationRegistry.ts so the admin dashboard doesn't
// import backend modules. Kept in src/lib so only the admin components use it.
export const UNKNOWN_STATUS_BADGE = { label: "Unknown", className: "bg-stone-200 text-stone-700" };

export const STATUS_BADGE = {
  ACTIVE: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  REAUTH_REQUIRED: { label: "Reauth required", className: "bg-amber-100 text-amber-700" },
  EXPIRES_SOON: { label: "Expires soon", className: "bg-amber-100 text-amber-700" },
  DISCONNECTED: { label: "Disconnected", className: "bg-stone-200 text-stone-600" },
  REVOKED: { label: "Revoked", className: "bg-red-100 text-red-700" },
  MISCONFIGURED: { label: "Misconfigured", className: "bg-red-100 text-red-700" },
};

export const normalizeIntegrationStatus = (value) =>
  Object.prototype.hasOwnProperty.call(STATUS_BADGE, value) ? value : "UNKNOWN";

export const AUTH_TYPE_LABEL = {
  oauth: "OAuth",
  api_key: "API key",
  webhook_secret: "Webhook secret",
  env_config: "Env / platform config",
  per_connection: "Per-connection",
  none: "None",
};

export const ENV_LABEL = { production: "Production", development: "Development", sandbox: "Sandbox" };
