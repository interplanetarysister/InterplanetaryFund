import { serviceSkill } from "./skills/index.js";
import { CONNECTION_POLICY_VERSION } from "../connections/catalog.js";
const ownerOnly = new Set([
  "applyAgentContentDraft",
  "ownerAgentChatActions",
  "approve_all",
  "send_owner_approval",
  "executeIntegrationChange",
]);
const readTools = new Set([
  "discoverConnectionMethods",
  "getAgentAccountContext",
  "getStripeIntegrationAudit",
  "getVerifiedIFundIntegrationContext",
  "getWritingResearchBrief",
  "listConnections",
  "listFundraisingProviderCapabilities",
  "resolveConnectionStatus",
]);
const adminTools = new Set([
  "getStripeIntegrationAudit",
  "repairStripeWebhookEvents",
  "manageAdminBuilderWork",
  "managePlatformIncidents",
]);
const oboTools = new Set([
  "requestManagedConnectionAction",
  "runBrowserConnection",
]);
const exactApprovalTools = new Set([
  "sendCommunication",
  "repairStripeWebhookEvents",
]);
const reserved = new Set([
  "owner_id",
  "user_id",
  "actor_id",
  "authorization",
  "api_key",
  "access_token",
  "refresh_token",
  "executor_key",
  "environment",
  "admin",
  "verified_admin",
  "owner_approval_verified",
  "receipt_verified",
  "__proto__",
  "constructor",
  "prototype",
]);
function canonical(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonical);
  if (
    value &&
    typeof value === "object" &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((k) => value[k] !== undefined)
        .map((k) => [k, canonical(value[k])]),
    );
  throw Error("Unsupported tool options.");
}
// Owner review stores this digest with the same encoding. A model can reference
// an approval, but cannot create the protected approval record.
export async function toolInputHash(input) {
  const review = { ...input };
  delete review.approval_ref;
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(canonical(review))),
      ),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
function eligibleScope(role, scope) {
  const policy = serviceSkill(role);
  return (
    scope?.allowed === true &&
    scope.role === role &&
    typeof scope.owner_id === "string" &&
    scope.owner_id.length > 0 &&
    (policy.min_plan_level == null
      ? scope.verified_admin === true
      : Number.isInteger(scope.plan_level) &&
        scope.plan_level >= policy.min_plan_level)
  );
}
// Bindings are trusted code/configuration. Every invocation still requires a
// fresh backend owner, consent, capability and provider authorization check.
export function createToolRegistry({
  bindings,
  authorize,
  clock = () => Date.now(),
}) {
  if (typeof authorize !== "function")
    throw Error("A current backend authorization check is required.");
  const registered = new Map();
  for (const b of bindings || []) {
    if (
      !b ||
      typeof b.name !== "string" ||
      ownerOnly.has(b.name) ||
      typeof b.invoke !== "function" ||
      typeof b.redact !== "function" ||
      typeof b.validateInput !== "function" ||
      !b.input_schema ||
      !Array.isArray(b.roles) ||
      !b.roles.length ||
      !["read", "write"].includes(b.effect) ||
      "consequential" in b ||
      (!readTools.has(b.name) && b.effect !== "write") ||
      (b.effect === "write" && typeof b.verifyReceipt !== "function") ||
      registered.has(b.name)
    )
      throw Error("Invalid agent tool registration.");
    if (
      b.roles.some(
        (role) => !serviceSkill(role).declared_functions.includes(b.name),
      )
    )
      throw Error("The source service does not declare this tool.");
    registered.set(b.name, {
      ...b,
      roles: Object.freeze([...b.roles]),
      input_schema: structuredClone(b.input_schema),
      base44_credit_evidence: b.base44_credit_evidence
        ? Object.freeze(structuredClone(b.base44_credit_evidence))
        : null,
    });
  }
  const available = (b) =>
    b?.available === true &&
    b.tested_revision === b.implementation_revision &&
    typeof b.implementation_revision === "string" &&
    b.implementation_revision.length > 0 &&
    b.cost_status === "verified_free" &&
    // Free allowances/trials can still consume Base44 credits. Evidence must
    // cover this adapter's entire auth/tool/persistence/receipt path, including
    // transitive dependencies, and come from trusted backend registration.
    // Neither a model argument nor an authorization response can supply it.
    b.base44_credit_evidence?.status === "verified_none" &&
    b.base44_credit_evidence.implementation_revision ===
      b.implementation_revision &&
    typeof b.base44_credit_evidence.reference === "string" &&
    b.base44_credit_evidence.reference.trim().length > 0 &&
    Date.parse(b.base44_credit_evidence.valid_until) > clock() &&
    Date.parse(b.valid_until) > clock();
  function binding(role, name) {
    const p = serviceSkill(role),
      b = registered.get(name);
    if (
      !p.declared_functions.includes(name) ||
      !b ||
      !available(b) ||
      !b.roles.includes(role)
    )
      throw Error("This tool is not currently available to this service.");
    return b;
  }
  return {
    definitions(role, scope) {
      if (!eligibleScope(role, scope)) return [];
      return serviceSkill(role)
        .declared_functions.filter((name) => {
          const b = registered.get(name);
          return (
            available(b) &&
            b.roles.includes(role) &&
            (!adminTools.has(name) || scope.verified_admin === true)
          );
        })
        .map((name) => {
          const b = registered.get(name);
          return {
            type: "function",
            function: {
              name,
              description:
                b.description || "Perform an authorized IFund operation.",
              parameters: structuredClone(b.input_schema),
            },
          };
        });
    },
    async invoke(role, name, input, requestContext) {
      const b = binding(role, name);
      if (
        !input ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).some((k) => reserved.has(k)) ||
        ("source_agent" in input && input.source_agent !== role) ||
        new TextEncoder().encode(JSON.stringify(input)).byteLength > 32000
      )
        throw Error("Unsupported tool options.");
      const normalized = b.validateInput(structuredClone(input), { role });
      if (
        !normalized ||
        typeof normalized !== "object" ||
        Array.isArray(normalized)
      )
        throw Error("Unsupported tool options.");
      if (
        ["managePlatformIncidents", "manageAdminBuilderWork"].includes(name) &&
        ["approve", "release", "deploy", "apply", "execute"].includes(
          normalized.mode || normalized.action,
        )
      )
        throw Error(
          "Approve and release changes in the protected owner review.",
        );
      const scope = await authorize({
        role,
        tool: name,
        input: structuredClone(normalized),
        requestContext,
      });
      if (!eligibleScope(role, scope))
        throw Error(
          "Current owner authorization and service eligibility are required.",
        );
      if (
        (adminTools.has(name) ||
          normalized.subject === "platform_owner" ||
          normalized.subject_kind === "platform_owner") &&
        scope.verified_admin !== true
      )
        throw Error("Verified administrator access is required.");
      if (
        oboTools.has(name) &&
        (scope.obo_grant_verified !== true ||
          scope.obo_permission_version !== CONNECTION_POLICY_VERSION)
      )
        throw Error("Current IFund help permission is required.");
      if (
        exactApprovalTools.has(name) &&
        (scope.owner_approval_verified !== true ||
          scope.approval_tool !== name ||
          scope.approved_input_hash !== (await toolInputHash(normalized)))
      )
        throw Error("Current exact owner approval is required.");
      if (
        name === "repairStripeWebhookEvents" &&
        scope.financial_reconciliation_authorized !== true
      )
        throw Error("An authorized financial review is required.");
      if (
        name === "routeAgentTask" &&
        (normalized.target_agent === "admin_builder_agent" ||
          normalized.target_agent === role)
      )
        throw Error("Choose an allowed specialist.");
      if (!available(b)) throw Error("This tool needs fresh verification.");
      const result = await b.invoke({ input: normalized, scope });
      if (
        b.effect === "write" &&
        (await b.verifyReceipt(result, scope, normalized)) !== true
      )
        throw Error("This action has not been confirmed.");
      return b.redact(result, scope);
    },
  };
}
