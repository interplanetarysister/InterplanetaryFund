import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261118090000_ifund_external_creator_managed_mandates.sql", import.meta.url), "utf8");
const api = await readFile(new URL("../supabase/functions/ifund-managed-creator-mandates/index.ts", import.meta.url), "utf8");
const consent = await readFile(new URL("../apps/web/src/pages/CreatorAuthorization.jsx", import.meta.url), "utf8");
const review = await readFile(new URL("../apps/web/src/pages/CreatorReview.jsx", import.meta.url), "utf8");
const admin = await readFile(new URL("../apps/web/src/pages/ManagedCreatorMandates.jsx", import.meta.url), "utf8");

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
  assert.match(api, /consent_token_hash: null/);
});

test("creator must affirm full control and all AI features; sensitive scopes remain separate", () => {
  assert.match(api, /full_control_acknowledged !== true/);
  assert.match(api, /ai_all_features_acknowledged !== true/);
  assert.match(api, /creator_authority_confirmed !== true/);
  assert.match(api, /financial_actions/);
  assert.match(api, /payout_changes/);
  assert.match(consent, /full operational control/);
  assert.match(consent, /every AI feature and AI agent/);
  assert.match(consent, /Separate high-impact permissions/);
});

test("creator review supports change requests, exact draft approval and revocation", () => {
  assert.match(api, /creator_requested_changes/);
  assert.match(api, /creator_approved/);
  assert.match(api, /status: "revoked"/);
  assert.match(review, /Approve this final draft/);
  assert.match(review, /Request changes/);
  assert.match(review, /Revoke IFund authorization/);
});

test("managed service does not create creator accounts, change campaign ownership or publish automatically", () => {
  assert.doesNotMatch(api, /auth\.admin\.createUser|signUp\(/);
  assert.doesNotMatch(api, /from\(["']ifund_campaigns["']\)\.(insert|update)/);
  assert.match(admin, /does not create or publish/);
  assert.match(review, /Publishing still requires separate authorization/);
});
