import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { storyInput } from "../worker/agents/story.js";
import { campaignPreviewInput } from "../worker/services/campaign-preview.js";
import { requireCampaignAIAccess, requireCampaignScopeAccess } from "../worker/agents/memberApi.js";

const migration = await readFile(new URL("../supabase/migrations/20261118155644_ifund_external_creator_managed_mandates_20261118.sql", import.meta.url), "utf8");
const api = await readFile(new URL("../supabase/functions/ifund-managed-creator-mandates/index.ts", import.meta.url), "utf8");
const consent = await readFile(new URL("../apps/web/src/pages/CreatorAuthorization.jsx", import.meta.url), "utf8");
const review = await readFile(new URL("../apps/web/src/pages/CreatorReview.jsx", import.meta.url), "utf8");
const admin = await readFile(new URL("../apps/web/src/pages/ManagedCreatorMandates.jsx", import.meta.url), "utf8");
const policy = await readFile(new URL("../worker/agents/campaignPolicy.js", import.meta.url), "utf8");
const skillIndex = await readFile(new URL("../worker/services/skills/index.js", import.meta.url), "utf8");
const publicData = await readFile(new URL("../apps/web/src/api/publicData.js", import.meta.url), "utf8");
const campaignDetail = await readFile(new URL("../apps/web/src/pages/CampaignDetail.jsx", import.meta.url), "utf8");
const fundingCard = await readFile(new URL("../apps/web/src/components/campaigns/CampaignFundingCard.jsx", import.meta.url), "utf8");
const paymentLedger = await readFile(new URL("../supabase/functions/ifund-payment-ledger/index.ts", import.meta.url), "utf8");

const aiGate = await readFile(new URL("../supabase/migrations/20261118161819_ifund_creator_mandate_story_ai_gate_20261118.sql", import.meta.url), "utf8");
const representation = await readFile(new URL("../supabase/migrations/20261118162242_ifund_managed_campaign_representation_20261118.sql", import.meta.url), "utf8");
const campaignAgentGate = await readFile(new URL("../supabase/migrations/20261118162436_ifund_campaign_agent_ai_mandate_gate_20261118.sql", import.meta.url), "utf8");
const strategy = await readFile(new URL("../worker/agents/strategy.js", import.meta.url), "utf8");
const communications = await readFile(new URL("../worker/agents/communications.js", import.meta.url), "utf8");
const memberApi = await readFile(new URL("../worker/agents/memberApi.js", import.meta.url), "utf8");
const scopeGate = await readFile(new URL("../supabase/migrations/20261118162711_ifund_campaign_mandate_scope_access_20261118.sql", import.meta.url), "utf8");
const managedConnections = await readFile(new URL("../worker/agents/managedConnections.js", import.meta.url), "utf8");
const revisionGate = await readFile(new URL("../supabase/migrations/20261118163027_ifund_managed_campaign_revision_gate_20261118.sql", import.meta.url), "utf8");
const auditGuard = await readFile(new URL("../supabase/migrations/20261118163055_ifund_managed_campaign_audit_guard_hardening_20261118.sql", import.meta.url), "utf8");
const mandateApi = await readFile(new URL("../supabase/functions/ifund-managed-creator-mandates/index.ts", import.meta.url), "utf8");
const scopeAtomicity = await readFile(new URL("../supabase/migrations/20261118163545_ifund_managed_campaign_scope_atomicity_20261118.sql", import.meta.url), "utf8");
const scopeNullGuard = await readFile(new URL("../supabase/migrations/20261118163813_ifund_campaign_scope_null_guard_20261118.sql", import.meta.url), "utf8");
const initialMetadataGuard = await readFile(new URL("../supabase/migrations/20261118163901_ifund_managed_campaign_initial_metadata_guard_20261118.sql", import.meta.url), "utf8");
const communicationsScopeDraft = await readFile(new URL("../supabase/migrations/20261118164729_ifund_communications_mandate_draft_scope_20261118.sql", import.meta.url), "utf8");
const story = await readFile(new URL("../worker/agents/story.js", import.meta.url), "utf8");
const preview = await readFile(new URL("../worker/services/campaign-preview.js", import.meta.url), "utf8");
const draftClient = await readFile(new URL("../apps/web/src/api/campaignDraft.js", import.meta.url), "utf8");
const externalDestination = await readFile(new URL("../supabase/migrations/20261118170000_ifund_managed_external_donation_destinations_20261118.sql", import.meta.url), "utf8");
const storyCreationSessions = await readFile(new URL("../supabase/migrations/20261118172000_ifund_story_campaign_creation_sessions_20261118.sql", import.meta.url), "utf8");

test("creator mandate storage is private and service-role only", () => {
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.ifund_creator_mandates from public, anon, authenticated/i);
  assert.match(migration, /revoke all on table public\.ifund_creator_mandate_events from public, anon, authenticated/i);
  assert.match(migration, /grant select,insert,update on table public\.ifund_creator_mandates to service_role/i);
  assert.match(migration, /grant select,insert on table public\.ifund_creator_mandate_events to service_role/i);
});

test("mandates bind a named admin account, expiry, creator consent, AI scope and independent high-impact permissions", () => {
  for (const field of [
    "assigned_admin_id", "creator_email", "fundraiser_url", "expires_at",
    "full_control_acknowledged", "ai_all_features_acknowledged",
    "creator_authority_confirmed", "identity_verified_at", "identity_verified_by",
    "draft_payload", "creator_review_state", "campaign_id",
  ]) assert.match(migration, new RegExp(field));
  for (const scope of ["publish","external_outreach","donor_messaging","account_connections","financial_actions","payout_changes"]) {
    assert.match(migration, new RegExp("\"" + scope + "\"\\s*:\\s*false"));
  }
});

test("managed creator API CORS allows only canonical hosts and this project's deployment previews", () => {
  assert.match(api, /const isAllowedOrigin =/);
  assert.ok(api.includes(String.raw`/^https:\/\/[a-f0-9]{8}\.interplanetaryfund-migration\.pages\.dev$/`));
  assert.match(api, /if \(origin && !isAllowedOrigin\(origin\)\)/);
});

test("admin endpoints require a confirmed user and backend-verified super-admin role", () => {
  assert.match(api, /auth\.getUser/);
  assert.match(api, /ifund_current_user_is_verified_super_admin/);
  assert.match(api, /email_confirmed_at/);
  assert.match(api, /assigned_admin_id: user\.id/);
});

test("creator tokens are random, hashed, expiring and single-use for consent", () => {
  assert.match(api, /crypto\.getRandomValues/);
  assert.match(api, /SHA-256/);
  assert.match(api, /consent_token_hash/);
  assert.match(api, /review_token_hash/);
  assert.match(api, /expires_at/);
  assert.match(api, /request_too_large/);
  assert.match(api, /invalid_json/);
  assert.match(api, /consent_token_hash: null/);
  assert.match(api, /if \(!declined\) return json\(409/);
  assert.match(api, /eq\("consent_token_hash", await hash\(publicToken\)\)/);
});

test("creator must affirm full control and all AI features; sensitive scopes remain separate", () => {
  assert.match(api, /full_control_acknowledged !== true/);
  assert.match(api, /ai_all_features_acknowledged !== true/);
  assert.match(api, /creator_authority_confirmed !== true/);
  assert.match(api, /financial_actions/);
  assert.match(api, /payout_changes/);
  assert.match(consent, /full operational control/);
  assert.match(consent, /every AI feature and AI agent/);
  assert.match(consent, /unlimited permission in scope/);
  assert.match(consent, /mandate\.authorizationText/);
  assert.match(consent, /Invited email/);
  assert.match(api, /creatorEmail: row\.creator_email\.replace/);
  assert.ok(api.includes(String.raw`/^([^@])[^@]*(@.+)$/`));
  assert.match(consent, /subscription\/usage entitlements/);
  assert.match(consent, /Separate high-impact permissions/);
});

test("creator review supports change requests, exact draft approval and revocation", () => {
  assert.match(api, /creator_requested_changes/);
  assert.match(api, /creator_approved/);
  assert.match(api, /status: "revoked"/);
  assert.match(review, /Approve this final draft/);
  assert.match(review, /Request changes/);
  assert.match(review, /Revoke IFund authorization/);
  assert.match(api, /creator_review_state,creator_feedback,creator_approved_at,campaign_id,draft_payload/);
  assert.match(admin, /Load saved draft for revision/);
  assert.match(admin, /Creator feedback:/);
});

test("managed service does not create creator accounts, change campaign ownership or publish automatically", () => {
  assert.doesNotMatch(api, /auth\.admin\.createUser|signUp\(/);
  assert.doesNotMatch(api, /from\(["']ifund_campaigns["']\)\.(insert|update)/);
  assert.match(admin, /canonical campaign draft is owned by the assigned IFund admin/);
  assert.match(policy, /creation\/linkage of an unpublished canonical IFund campaign draft/);
  assert.match(policy, /private Story AI draft preparation and creator review/);
  assert.match(skillIndex, /narrow no-login managed-creator mandate flow/);
  assert.match(skillIndex, /No other campaign agent may service that outside campaign before the exact creator-approved draft is linked/);
  assert.match(policy, /does not enable Connections\/account access/);
  assert.match(policy, /assigned to the acting admin account/);
  assert.match(review, /Publishing still requires separate authorization/);
});


test("managed Story AI calls are bound to a live, verified mandate at execution and persistence", () => {
  assert.match(aiGate, /ifund_current_user_is_verified_super_admin/);
  assert.match(aiGate, /ifund_current_account_is_active/);
  assert.match(aiGate, /ifund_current_user_has_current_terms/);
  assert.match(aiGate, /assigned_admin_id = auth\.uid\(\)/);
  assert.match(aiGate, /status = 'active'/);
  assert.match(aiGate, /expires_at > statement_timestamp\(\)/);
  assert.match(aiGate, /identity_verified_at is not null/);
  assert.match(aiGate, /ai_all_features_acknowledged is true/);
  assert.match(aiGate, /grant execute on function public\.ifund_creator_mandate_ai_authorized\(uuid\) to authenticated/);
  assert.match(story, /ifund_creator_mandate_ai_authorized/);
  assert.match(story, /await verifyManagedMandate\(\)/);
  assert.match(preview, /managed_mandate_id/);
  assert.match(draftClient, /managed_mandate_id/);
  assert.match(draftClient, /managedMandateId \? \{ managed_mandate_id: managedMandateId \}/);
  assert.match(admin, /managed_mandate_id: selected\.id/);
  assert.match(admin, /Story, Strategy, Growth and Communications AI endpoints now enforce the linked mandate/);
});


test("managed mandate identifiers are validated and carried through Story input contracts", () => {
  const mandate = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const storyRequest = storyInput({
    request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    details: "Prepare a truthful private fundraiser story from verified facts.",
    managed_mandate_id: mandate,
  });
  assert.equal(storyRequest.managed_mandate_id, mandate);
  assert.throws(() => storyInput({
    request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    details: "Prepare a truthful private fundraiser story from verified facts.",
    managed_mandate_id: "not-a-uuid",
  }), /valid managed creator authorization/);
  const previewRequest = campaignPreviewInput({
    request_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    details: "Prepare a truthful private fundraiser story from verified facts.",
    managed_mandate_id: mandate,
  });
  assert.equal(previewRequest.managed_mandate_id, mandate);
  assert.throws(() => campaignPreviewInput({
    request_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    details: "Prepare a truthful private fundraiser story from verified facts.",
    managed_mandate_id: "not-a-uuid",
  }), /valid managed creator authorization/);
});


test("managed campaign linkage preserves admin ownership and creator attribution without enabling publication", () => {
  assert.match(representation, /create table if not exists public\.ifund_managed_campaign_profiles/);
  assert.match(representation, /enable row level security/);
  assert.match(representation, /grant select \(campaign_id,creator_name,beneficiary_name,fundraiser_label,management_disclosure,created_at\)/);
  assert.match(representation, /status='draft'/);
  assert.match(representation, /owner_id=v_actor/);
  assert.match(representation, /creator_review_state <> 'approved'/);
  assert.match(representation, /campaign content does not match the creator-approved draft/i);
  assert.match(representation, /ifund_creator_mandate_events/);
  assert.match(representation, /'campaign_linked'/);
  assert.match(representation, /ifund_block_managed_campaign_publication/);
  assert.match(representation, /Managed fundraiser publication is disabled/);
  assert.doesNotMatch(representation, /grant insert[^;]*authenticated/i);
  assert.match(api, /action === "link_campaign"/);
  assert.match(api, /ifund_creator_mandate_link_campaign/);
  assert.match(admin, /saveOwnerCampaign/);
  assert.match(admin, /creator_review_state==="approved"/);
  assert.match(admin, /canonical campaign draft is owned by the assigned IFund admin/);
  assert.match(review, /Fundraising goal/);
  assert.match(publicData, /ifund_managed_campaign_profiles/);
  assert.match(campaignDetail, /Creator and beneficiary/);
});


test("campaign-scoped Story, Strategy, Growth and Communications AI are checked against the linked mandate", async () => {
  assert.match(campaignAgentGate, /ifund_campaign_agent_ai_access/);
  assert.match(campaignAgentGate, /ifund_creator_mandate_ai_authorized/);
  assert.match(campaignAgentGate, /m\.assigned_admin_id=auth\.uid\(\)/);
  assert.match(memberApi, /ifund_campaign_agent_ai_access/);
  assert.match(strategy, /requireCampaignAIAccess/);
  assert.match(communications, /requireCampaignAIAccess/);
  assert.match(story, /ifund_campaign_agent_ai_access/);
  const campaignId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  let called = false;
  await requireCampaignAIAccess({
    rpc: async (name, args) => {
      called = name === "ifund_campaign_agent_ai_access" && args.p_campaign_id === campaignId;
      return true;
    },
  }, campaignId);
  assert.equal(called, true);
  await assert.rejects(
    requireCampaignAIAccess({ rpc: async () => false }, campaignId),
    /not authorized for AI assistance/,
  );
});


test("creator account-connection permission is enforced separately from broad AI consent", async () => {
  assert.match(scopeGate, /ifund_campaign_mandate_scope_access/);
  assert.match(scopeGate, /m\.scopes->>p_scope='true'/);
  assert.match(scopeGate, /account_connections/);
  assert.match(managedConnections, /requireCampaignScopeAccess/);
  assert.match(managedConnections, /"account_connections"/);
  const campaignId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  let scopeArgs;
  await requireCampaignScopeAccess({
    rpc: async (name, args) => {
      scopeArgs = { name, args };
      return true;
    },
  }, campaignId, "account_connections");
  assert.equal(scopeArgs.name, "ifund_campaign_mandate_scope_access");
  assert.equal(scopeArgs.args.p_campaign_id, campaignId);
  assert.equal(scopeArgs.args.p_scope, "account_connections");
  await assert.rejects(
    requireCampaignScopeAccess({ rpc: async () => false }, campaignId, "account_connections"),
    /does not include this campaign permission/,
  );
});


test("managed campaign revisions require fresh creator approval and create an audit event", () => {
  assert.match(revisionGate, /ifund_creator_mandate_sync_campaign_draft/);
  assert.match(revisionGate, /creator_review_state <> 'approved'/);
  assert.match(revisionGate, /Managed campaign content must exactly match the creator-approved revision/);
  assert.match(auditGuard, /ifund_current_user_is_verified_super_admin/);
  assert.match(auditGuard, /ifund_current_account_is_active/);
  assert.match(auditGuard, /ifund_current_user_has_current_terms/);
  assert.match(auditGuard, /v_mandate\.assigned_admin_id is distinct from auth\.uid\(\)/);
  assert.match(auditGuard, /v_mandate\.creator_review_state <> 'approved'/);
  assert.match(auditGuard, /'draft_synced'/);
  assert.doesNotMatch(auditGuard, /set_config\(/);
  assert.match(mandateApi, /action === "sync_campaign"/);
  assert.match(mandateApi, /ifund_creator_mandate_sync_campaign_draft/);
  assert.match(admin, /Apply approved revision to IFund draft/);
});


test("donor messaging and account connection actions enforce separate scopes atomically", () => {
  assert.match(scopeAtomicity, /language plpgsql\s+volatile/);
  assert.match(scopeAtomicity, /for share of m/);
  assert.match(scopeAtomicity, /ifund_communications_runtime\.prepare_send/);
  assert.match(scopeAtomicity, /ifund_communications_runtime\.send/);
  assert.match(scopeAtomicity, /ifund_connections_runtime\.grant_help/);
  assert.match(scopeAtomicity, /ifund_connections_runtime\.request_action/);
  assert.match(scopeAtomicity, /'donor_messaging'/);
  assert.match(scopeAtomicity, /'account_connections'/);
  assert.match(scopeAtomicity, /ifund_campaign_mandate_scope_access/);
});


test("managed campaign scope gate rejects missing scope names", () => {
  assert.match(scopeNullGuard, /p_scope is null/);
  assert.match(scopeNullGuard, /p_scope not in/);
});


test("managed campaign linkage rejects unapproved imagery and location metadata", () => {
  assert.match(initialMetadataGuard, /cover_image_url/);
  assert.match(initialMetadataGuard, /map_opt_in is true/);
  assert.match(initialMetadataGuard, /public_location_label/);
  assert.match(initialMetadataGuard, /Managed campaign must start without unapproved imagery or public location data/);
});


test("communications drafting and saving require donor_messaging scope at the database boundary", () => {
  assert.match(communicationsScopeDraft, /ifund_communications_runtime\.begin_request/);
  assert.match(communicationsScopeDraft, /ifund_communications_runtime\.finish_request/);
  assert.match(communicationsScopeDraft, /ifund_communications_runtime\.save_owner/);
  assert.equal((communicationsScopeDraft.match(/ifund_campaign_mandate_scope_access\(/g) || []).length, 3);
  assert.match(communications, /requireCampaignScopeAccess\(api, input\.campaign_id, "donor_messaging"\)/);
  assert.match(communications, /await requireCampaignScopeAccess\(api, input\.campaign_id, "donor_messaging"\);/);
});


test("managed campaign drafting exposes five title choices, two descriptions, and independent regeneration", () => {
  assert.match(admin, /slice\(0, 5\)/);
  assert.match(admin, /slice\(0, 2\)/);
  assert.match(admin, /Regenerate five titles/);
  assert.match(admin, /Regenerate two descriptions/);
  assert.match(admin, /Regenerate story/);
  assert.match(admin, /maxLength=\{1200\}/);
  assert.match(admin, /setTitleOptions\(\[\]\)/);
  assert.match(admin, /setSummaryOptions\(\[\]\)/);
});

test("managed beneficiary campaigns fail closed on IFund-native donation checkout", () => {
  assert.match(publicData, /managed_campaign:\s*Boolean\(profile\)/);
  assert.match(campaignDetail, /campaign\.managed_campaign !== true/);
  assert.match(fundingCard, /managedCampaign = campaign\?\.managed_campaign === true/);
  assert.match(fundingCard, /\|\| managedCampaign \|\|/);
  assert.match(fundingCard, /managedCampaign && campaignActive && campaign\.external_donation_url/);
  assert.match(fundingCard, /platformOnlyMode && campaignActive && !managedCampaign && <PrelaunchNotice/);
  assert.match(campaignDetail, /platformOnlyMode && campaign\.managed_campaign !== true/);
  assert.match(campaignDetail, /campaign\.external_donation_url \?/);
  assert.match(fundingCard, /IFund does not collect or route donations/);
  assert.match(fundingCard, /gifts processed directly by the external provider may not appear here/);
  assert.match(fundingCard, /External-provider gifts are processed outside IFund/);
});

test("managed beneficiary campaigns are rejected by the server before IFund payment intent creation", () => {
  const gate = paymentLedger.indexOf("Managed beneficiary campaigns require direct-provider checkout");
  const intentInsert = paymentLedger.indexOf('db("ifund_payment_intents","POST"', paymentLedger.indexOf('if(body.op==="begin")'));
  assert.notEqual(gate, -1);
  assert.notEqual(intentInsert, -1);
  assert.ok(gate < intentInsert, "managed beneficiary gate must precede payment-intent creation");
  assert.match(paymentLedger, /ifund_managed_campaign_profiles\?select=campaign_id&campaign_id=eq\./);
});


test("managed external donation destinations are private, creator-approved, provider-verified and compliance-gated", () => {
  assert.match(externalDestination, /create table if not exists public\.ifund_managed_external_destinations/);
  assert.match(externalDestination, /enable row level security/);
  assert.match(externalDestination, /revoke all on table public\.ifund_managed_external_destinations from public,\s*anon,\s*authenticated/);
  assert.match(externalDestination, /grant select,\s*insert,\s*update on table public\.ifund_managed_external_destinations to service_role/);
  assert.match(externalDestination, /creator_approved_url_sha256/);
  assert.match(externalDestination, /provider_owner_verified_at/);
  assert.match(externalDestination, /provider_verification_evidence/);
  assert.match(externalDestination, /compliance_checked_at/);
  assert.match(externalDestination, /compliance_evidence/);
  assert.match(externalDestination, /one_open_mandate_idx/);
  assert.match(externalDestination, /one_open_campaign_idx/);
  assert.match(externalDestination, /ifund_managed_external_destination_creator_state_check/);
  assert.match(externalDestination, /ifund_managed_external_destination_provider_state_check/);
  assert.match(externalDestination, /status <> 'ready'/);
  assert.match(externalDestination, /pending_creator_approval/);
  assert.match(externalDestination, /external_destination_creator_approved/);
  assert.match(externalDestination, /ifund_guard_managed_external_destination/);
  assert.match(externalDestination, /for update/);
  assert.match(externalDestination, /creator-approved destination details are immutable/);
  assert.match(externalDestination, /creator approval evidence is immutable/);
  assert.match(externalDestination, /new\.creator_approved_url_sha256 is distinct from old\.creator_approved_url_sha256/);
  assert.match(externalDestination, /provider verification evidence is immutable/);
  assert.match(externalDestination, /compliance review evidence is immutable/);
  assert.match(externalDestination, /active mandate and separate creator publication scope are required/);
  assert.match(externalDestination, /ifund_block_managed_campaign_publication/);
  assert.match(externalDestination, /ifund_public_managed_external_destinations/);
  assert.match(externalDestination, /m\.identity_verified_at is not null/);
  assert.match(externalDestination, /m\.full_control_acknowledged is true/);
  assert.match(externalDestination, /m\.ai_all_features_acknowledged is true/);
  assert.match(externalDestination, /m\.creator_authority_confirmed is true/);
  assert.match(externalDestination, /join public\.ifund_managed_campaign_profiles p/);
  assert.match(externalDestination, /p\.mandate_id = m\.id/);
  assert.match(externalDestination, /c\.owner_id = m\.assigned_admin_id/);
  assert.match(externalDestination, /d\.provider_owner_verified_by is not null/);
  assert.match(externalDestination, /d\.compliance_checked_by is not null/);
  assert.match(externalDestination, /creator-approved direct-provider destination/);
  assert.match(publicData, /ifund_public_managed_external_destinations/);
  assert.match(publicData, /external_donation_url/);
  assert.ok(publicData.includes(".filter((campaign) => !campaign.managed_campaign || Boolean(campaign.external_donation_url))"));
  assert.match(fundingCard, /campaign\.external_donation_url/);
  assert.match(fundingCard, /Donate directly via/);
  assert.match(fundingCard, /noopener noreferrer/);
  assert.match(paymentLedger, /Managed beneficiary campaigns require direct-provider checkout/);
  assert.match(externalDestination, /No browser-role access/);
});

test("external donation destination approval is token-bound, expiring, and invalidated on mandate or draft changes", () => {
  assert.match(mandateApi, /external_destination_approve/);
  assert.match(mandateApi, /creator_approval_token_hash/);
  assert.match(mandateApi, /creator_approved_url_sha256/);
  assert.match(mandateApi, /creator_authorization_expired_or_revoked/);
  assert.match(mandateApi, /if \(!verifiedDestination\) return json\(409/);
  assert.match(mandateApi, /if \(!readyDestination\) return json\(409/);
  assert.match(mandateApi, /status: "revoked", creator_approval_token_hash: null/);
  assert.match(mandateApi, /privateHost/);
  assert.match(review, /external_destination_token/);
  assert.match(review, /approveExternalDestination/);
  assert.match(admin, /create_external_destination/);
  assert.match(admin, /verify_external_destination/);
  assert.match(admin, /check_external_destination_compliance/);
  assert.ok(admin.includes("selected.scopes?.publish === true"));
});

test("pre-save Story AI requires a backend-verified campaign, mandate, or native creation session", () => {
  const request = {
    request_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    details: "Prepare a truthful campaign story from organizer-supplied facts.",
  };
  const session = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  assert.throws(() => storyInput(request), /IFund campaign creator/);
  assert.throws(() => campaignPreviewInput(request), /IFund campaign creator/);
  assert.equal(storyInput({ ...request, campaign_creation_session_id: session }).campaign_creation_session_id, session);
  assert.equal(campaignPreviewInput({ ...request, campaign_creation_session_id: session }).campaign_creation_session_id, session);
  assert.throws(() => storyInput({ ...request, campaign_creation_session_id: "invalid" }), /campaign creator/);
  assert.throws(() => storyInput({ ...request, managed_mandate_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", campaign_creation_session_id: session }), /one authorized writing context/);
  assert.match(story, /ifund_story_campaign_creation_session_authorized/);
  assert.match(story, /ifund_creator_mandate_ai_authorized/);
  assert.match(story, /ifund_campaign_agent_ai_access/);
  assert.match(story, /api\/agents\/story\/authorize/);
  assert.match(preview, /api\/agents\/story\/authorize/);
  assert.match(preview, /campaign_creation_session_id/);
  assert.match(draftClient, /ifund_story_campaign_creation_session_begin/);
  assert.match(storyCreationSessions, /enable row level security/);
  assert.match(storyCreationSessions, /owner_id uuid not null/);
  assert.match(storyCreationSessions, /request_id uuid not null/);
  assert.match(storyCreationSessions, /expires_at > statement_timestamp/);
  assert.match(storyCreationSessions, /delete from public\.ifund_story_campaign_creation_sessions/);
  assert.match(storyCreationSessions, /where expires_at <= statement_timestamp/);
  assert.match(storyCreationSessions, /email_confirmed_at is not null/);
  assert.match(storyCreationSessions, /grant execute on function public\.ifund_story_campaign_creation_session_authorized\(uuid, uuid\) to authenticated/);
});
