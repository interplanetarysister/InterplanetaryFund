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
  "platform_communication_verified",
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
function campaignScopedRequest(name, input) {
  if (typeof input.campaign_id === "string" && input.campaign_id.trim()) return true;
  // The backend must explicitly certify a platform-only message before the
  // campaign gate is skipped; caller-supplied labels are not authorization.
  if (name === "sendCommunication") return true;
  if (name === "manageAgentContentDraft") {
    const target = [input.content_type, input.target_type, input.kind, input.content_kind]
      .filter((x) => typeof x === "string").join(" ").toLowerCase();
    return /campaign|fundrais|donor|supporter|campaign.?update/.test(target);
  }
  if (name === "routeAgentTask" && input.mode === "dispatch") {
    const objective = typeof input.objective === "string" ? input.objective.toLowerCase() : "";
    const onboardingOnly = /(?:invite|onboard).{0,100}(?:owner|organizer).{0,100}(?:register|join|bring|import|link).{0,100}ifund|(?:register|import|link).{0,100}(?:campaign|owner|organizer).{0,100}ifund/i.test(objective);
    const platformGrowth = /(?:ifund|platform).{0,100}(?:platform marketing|market|growth|new[- ]user|acquisition|awareness|signup|registration|recruit)|(?:platform marketing|new[- ]user acquisition|acquire new users).{0,100}(?:ifund|platform)/i.test(objective);
    const fundraising = /fundrais|donat|donor|supporter|solicit/.test(objective);
    const campaignWork = /campaign/.test(objective) && /manage|refine|write|story|strategy|publish|promot|outreach|market|support/.test(objective);
    // A mixed instruction is not an onboarding-only or platform-only task.
    // Never let a benign phrase cancel campaign-specific fundraising work.
    const externalCampaignAction = /(?:external|outside|unlinked|unregistered).{0,120}campaign|campaign.{0,120}(?:external|outside|unlinked|unregistered)/.test(objective)
      && /manage|refine|write|story|strategy|publish|promot|outreach|market|support|solicit/.test(objective);
    return fundraising || externalCampaignAction || (campaignWork && !onboardingOnly && !platformGrowth);
  }
  return false;
}
// Bindings are trusted code/configuration. Every invocation still requires a
// fresh backend owner, consent, capability and provider authorization check.
export function createToolRegistry({
  bindings,
  authorize,
  verifyCampaignAssociation,
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
    });
  }
  const available = (b) =>
    b?.available === true &&
    b.tested_revision === b.implementation_revision &&
    typeof b.implementation_revision === "string" &&
    b.implementation_revision.length > 0 &&
    b.cost_status === "verified_free" &&
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
      const verifiedPlatformCommunication =
        name === "sendCommunication" &&
        !normalized.campaign_id &&
        scope.platform_communication_verified === true;
      if (!verifiedPlatformCommunication && campaignScopedRequest(name, normalized)) {
        const campaignId = normalized.campaign_id;
        if (
          typeof campaignId !== "string" ||
          !campaignId.trim() ||
          typeof verifyCampaignAssociation !== "function" ||
          (await verifyCampaignAssociation({
            campaign_id: campaignId,
            owner_id: scope.owner_id,
            role,
            requestContext,
            scope,
          })) !== true
        )
          throw Error("A verified IFund campaign linked to this account is required for campaign support.");
      }
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
