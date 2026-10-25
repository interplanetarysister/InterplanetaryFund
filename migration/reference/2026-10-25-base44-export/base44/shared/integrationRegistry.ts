// Shared helpers for the Platform Access Registry. Reused by the health
// validator, the agent-access gatekeeper, and the admin management function.
// Never imports or handles secret values — only reference names and metadata.

export const STATUS_LABEL = {
  ACTIVE: "Active",
  REAUTH_REQUIRED: "Reauthorization required",
  EXPIRES_SOON: "Expires soon",
  DISCONNECTED: "Disconnected",
  REVOKED: "Revoked",
  MISCONFIGURED: "Misconfigured",
};

export const STATUS_BADGE = {
  ACTIVE: { label: "Active", className: "bg-emerald-100 text-emerald-700" },
  REAUTH_REQUIRED: { label: "Reauth required", className: "bg-amber-100 text-amber-700" },
  EXPIRES_SOON: { label: "Expires soon", className: "bg-amber-100 text-amber-700" },
  DISCONNECTED: { label: "Disconnected", className: "bg-stone-200 text-stone-600" },
  REVOKED: { label: "Revoked", className: "bg-red-100 text-red-700" },
  MISCONFIGURED: { label: "Misconfigured", className: "bg-red-100 text-red-700" },
};

export const AUTH_TYPE_LABEL = {
  oauth: "OAuth",
  api_key: "API key",
  webhook_secret: "Webhook secret",
  env_config: "Env / platform config",
  per_connection: "Per-connection",
  none: "None",
};

export const ENV_LABEL = { production: "Production", development: "Development", sandbox: "Sandbox" };

export const UNHEALTHY = new Set(["REAUTH_REQUIRED", "EXPIRES_SOON", "DISCONNECTED", "REVOKED", "MISCONFIGURED"]);

export function isUnhealthy(status) {
  return UNHEALTHY.has(status);
}

// Emit a deduplicated admin alert for an unhealthy integration. Skips creating
// a new Notification when an unread integration alert for the same platform
// already exists for an admin, so a persistent condition isn't re-alerted.
export async function emitIntegrationAlert(sr, entry, title, body) {
  try {
    const admins = await sr.entities.User.filter({ role: "admin" }).catch(() => []);
    for (const admin of admins) {
      const open = await sr.entities.Notification.filter({ user_id: admin.id, read: false }).catch(() => []);
      const dupe = open.some(
        (n) => n.type === "system" && (n.link || "") === "/admin/integrations" && (n.title || "").includes(`[${entry.platform}]`)
      );
      if (dupe) continue;
      await sr.entities.Notification.create({
        user_id: admin.id,
        title,
        body,
        type: "system",
        link: "/admin/integrations",
      });
    }
  } catch (e) {
    console.error("emitIntegrationAlert failed:", e && e.message ? e.message : e);
  }
}

// Credential fields that are actual secrets (never returned to the frontend,
// never logged). Non-secret identifiers (handles, instances) stay visible.
export const SECRET_FIELDS = [
  "kofi_verification_token",
  "bluesky_app_password",
  "mastodon_access_token",
  "buymeacoffee_api_token",
];

// Strip secret values from a credentials object and report which secrets are
// set, so the UI can show "set — enter new to replace" without ever holding
// the raw value in frontend state.
export function redactCredentials(creds) {
  const c = creds || {};
  const meta = {};
  for (const f of SECRET_FIELDS) meta[f + "_set"] = !!c[f];
  const redacted = { ...c };
  for (const f of SECRET_FIELDS) if (redacted[f]) redacted[f] = "";
  return { credentials: redacted, credentials_meta: meta };
}

// Merge incoming credential edits onto existing ones. Secret fields are only
// overwritten when a new non-empty value is provided; otherwise the stored
// value is preserved (so a redacted edit form never has to round-trip secrets).
export function mergeSecrets(existingCreds, incomingCreds) {
  const merged = { ...(existingCreds || {}) };
  const incoming = incomingCreds || {};
  for (const f of SECRET_FIELDS) {
    if (incoming[f]) merged[f] = incoming[f];
  }
  for (const k of Object.keys(incoming)) {
    if (!SECRET_FIELDS.includes(k)) merged[k] = incoming[k];
  }
  return merged;
}

// Centralized access gate. Before a backend function touches an external
// platform it calls this to confirm the registry entry is healthy. Registry
// uncertainty fails closed: an unavailable authorization source can never be
// treated as permission for an external side effect. Returns { ok, status, reason }.
export async function assertPlatformAccess(sr, platform) {
  let entries;
  try {
    entries = await sr.entities.PlatformAccessRegistry.filter({ platform });
  } catch (e) {
    console.warn("assertPlatformAccess registry read failed:", e && e.message ? e.message : e);
    return { ok: false, status: null, reason: "registry unavailable (fail-closed)" };
  }
  const entry = entries && entries[0];
  if (!entry) return { ok: false, status: null, reason: `no registry entry for ${platform}` };
  const ok = entry.status === "ACTIVE" || entry.status === "EXPIRES_SOON";
  return { ok, status: entry.status, reason: ok ? "ok" : `status ${entry.status}` };
}

// OBO (On-Behalf-Of) authorization. A saved platform credential is NOT
// authorization to act. The user's plain-language connection consent is the
// primary per-connection grant; legacy AuthorizationGrant rows remain supported
// for non-connection capabilities and older flows.
export async function assertOboGrant(sr, agentName, userId, platform, connection = null) {
  if (connection) {
    const sameOwner = connection.created_by_id === userId;
    const activeConnection = connection.status === 'connected' && connection.verification_status === 'verified';
    const shared = connection.obo_consent?.granted === true && connection.agent_access?.shared_with_agents === true;
    if (sameOwner && activeConnection && shared) return { ok: true, connectionGrant: true };
    return { ok: false, reason: 'connection OBO authorization is not active' };
  }

  let grants;
  try {
    grants = await sr.entities.AuthorizationGrant.filter({ agent_name: agentName, user_id: userId, platform });
  } catch (e) {
    console.warn("assertOboGrant read failed:", e && e.message ? e.message : e);
    return { ok: false, reason: "grant registry unavailable" };
  }
  const now = Date.now();
  const active = (grants || []).find((g) => {
    if ((g.status || "active") === "revoked") return false;
    if (g.expires_at && new Date(g.expires_at).getTime() < now) return false;
    return (g.status || "active") === "active";
  });
  if (!active) return { ok: false, reason: `no active OBO grant for agent=${agentName} user=${userId} platform=${platform}` };
  return { ok: true, grant: active };
}

// Canonical IFund-wide OBO decision. Legacy user fields are read only as a
// migration bridge; new authorization changes are written through ai_obo_consent.
export function hasUnifiedOboConsent(user) {
  // Canonical IFund-wide OBO is the sole authorization decision. Legacy
  // ai_publishing_consent / ai_connection_consent are mirrored on write only
  // (see setUnifiedOboConsent) and are no longer read for decisions.
  return user?.ai_obo_consent?.granted === true;
}

export async function assertExternalAgentAction(sr, {
  ownerUser,
  ownerUserId,
  campaign = null,
  connection,
  capability,
  requireAutomation = false,
}) {
  if (!ownerUser || ownerUser.id !== ownerUserId) return { ok: false, reason: 'owner unavailable' };
  if (!hasUnifiedOboConsent(ownerUser)) return { ok: false, reason: 'owner OBO authorization is not active' };
  if (!connection || connection.created_by_id !== ownerUserId) return { ok: false, reason: 'connection owner mismatch' };
  if (campaign && campaign.created_by_id !== ownerUserId) return { ok: false, reason: 'campaign owner mismatch' };
  if (connection.status !== 'connected' || connection.verification_status !== 'verified') {
    return { ok: false, reason: 'connection is not verified and active' };
  }
  // Global OBO is necessary but not sufficient. Respect individual account
  // revocations and consent-version changes before any external AI action.
  const ownerVersion = String(ownerUser.ai_obo_consent?.permission_version || '');
  if (!ownerVersion || connection.obo_consent?.granted !== true ||
      connection.obo_consent?.opted_out === true ||
      String(connection.obo_consent?.permission_version || '') !== ownerVersion ||
      connection.agent_access?.shared_with_agents !== true) {
    return { ok: false, reason: 'connection-specific AI authorization is not active' };
  }
  // automation_mode is the only automation preference. agent_access.automation_enabled
  // is a mirrored execution field (kept in sync by setUnifiedOboConsent and the
  // connection-save functions), not a second authorization decision.
  if (requireAutomation && (connection.automation_mode || 'manual') !== 'auto') {
    return { ok: false, reason: 'automation is not enabled for this connection' };
  }
  // Requested account scope cannot fabricate provider capabilities.
  const selected = new Set(connection.obo_consent?.requested_capabilities || []);
  const known = new Set((connection.obo_consent?.granted_capabilities || [])
    .filter((value: string) => selected.has(value)));
  if (capability && !known.has(capability)) {
    return { ok: false, reason: `provider capability ${capability} is not granted` };
  }
  return { ok: true };
}