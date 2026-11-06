import catalog from "./provider-catalog.json" with { type: "json" };
const byId = new Map(catalog.providers.map((p) => [p.id, Object.freeze(p)]));
export const CONNECTION_POLICY_VERSION = "ifund-help-2026-11-v1";
export const CONNECTION_OPERATIONS = Object.freeze([
  "connect",
  "create_account",
  "repair",
  "reauthorize",
]);
export function connectionProvider(id) {
  return typeof id === "string" ? byId.get(id) || null : null;
}
export function connectionCatalog() {
  return catalog.providers.map(({ id, name, kind, logo }) => ({
    id,
    name,
    kind,
    logo,
  }));
}
export function memberConnectionLink(id) {
  if (!connectionProvider(id)) throw Error("Choose a known provider.");
  return "/connections?connect=" + encodeURIComponent(id);
}
export function connectionMethods(id, registration = null, capabilities = []) {
  const p = connectionProvider(id);
  if (!p) throw Error("Choose a known provider.");
  const current =
    registration?.provider === id &&
    registration.status === "verified" &&
    Number.isFinite(Date.parse(registration.valid_until)) &&
    Date.parse(registration.valid_until) > Date.now();
  const method = current
    ? registration.transport
    : p.legacy_auth_hint === "link"
      ? "public_page"
      : p.legacy_auth_hint === "oauth"
        ? "oauth"
        : "protected_provider_step";
  return {
    provider: id,
    provider_name: p.name,
    connection_link: memberConnectionLink(id),
    method,
    status: current ? "registration_verified" : "setup_required",
    account_creation_verified: false,
    capabilities: capabilities
      .filter(
        (c) =>
          c?.provider === id &&
          c.status === "verified" &&
          typeof c.capability === "string" &&
          Date.parse(c.valid_until) > Date.now(),
      )
      .map((c) => ({
        capability: c.capability,
        verified_at: c.verified_at,
        valid_until: c.valid_until,
      })),
    financial_authority: false,
    message: current
      ? "Continue in IFund to review the required provider permission."
      : "IFund is still setting up this connection. You don't need to change anything on your account.",
  };
}
export function connectionActionInput(raw) {
  if (
    !raw ||
    Array.isArray(raw) ||
    Object.keys(raw).some(
      (k) =>
        ![
          "operation_id",
          "provider",
          "action",
          "connection_id",
          "campaign_id",
        ].includes(k),
    ) ||
    !connectionProvider(raw.provider) ||
    !CONNECTION_OPERATIONS.includes(raw.action)
  )
    throw Error("Choose a supported provider action.");
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    !uuid.test(raw.operation_id || "") ||
    (raw.connection_id != null && !uuid.test(raw.connection_id)) ||
    (raw.campaign_id != null && !uuid.test(raw.campaign_id)) ||
    (["repair", "reauthorize"].includes(raw.action) && !raw.connection_id)
  )
    throw Error("Choose an owned connection and campaign.");
  return {
    operation_id: raw.operation_id,
    provider: raw.provider,
    action: raw.action,
    connection_id: raw.connection_id || null,
    campaign_id: raw.campaign_id || null,
  };
}
