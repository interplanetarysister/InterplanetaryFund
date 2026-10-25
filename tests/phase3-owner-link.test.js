import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchConfirmedLegacyOwner, canBeginClaim } from '../worker/ownerLinkRules.js';

const one = [{ source_user_id: 'legacy-A', source_email: 'someone@example.com', status: 'awaiting_destination_login' }];
const trusted = { email: 'Someone@Example.com', emailConfirmed: true, active: true };
const digest = 'a'.repeat(64); // synthetic test fixture, not a real consent receipt

test('one confirmed unique email candidate is eligible, without using name', () => {
  const found = matchConfirmedLegacyOwner(trusted, one);
  assert.equal(found.eligible, true);
  assert.equal(found.sourceOwner.source_user_id, 'legacy-A');
});
test('unverified provider identity fails closed', () =>
  assert.equal(matchConfirmedLegacyOwner({ ...trusted, emailConfirmed: false }, one).eligible, false));
test('duplicate legacy email cannot be claimed automatically', () =>
  assert.equal(matchConfirmedLegacyOwner(trusted, [...one, { ...one[0], source_user_id: 'legacy-B' }]).eligible, false));
test('missing or mismatched legacy email requires alternate code flow', () =>
  assert.equal(matchConfirmedLegacyOwner(trusted, [{ ...one[0], source_email: 'other@example.com' }]).eligible, false));
test('blocked and already linked records are not eligible', () =>
  assert.equal(matchConfirmedLegacyOwner(trusted, [{ ...one[0], status: 'linked' }]).eligible, false));
test('dual live sessions, explicit versioned consent and challenge required', () => {
  const proof = { confirmedUser: { id: 'server-derived-uid', emailConfirmed: true }, eligible: true,
    clickedConfirm: true, freshSession: true, validChallenge: true,
    sourceSessionVerified: true, destinationSessionVerified: true,
    consentVersion: 'owner-link-v1', consentSha256: digest };
  assert.equal(canBeginClaim(proof), true);
  for (const key of ['clickedConfirm', 'freshSession', 'validChallenge', 'sourceSessionVerified', 'destinationSessionVerified']) {
    assert.equal(canBeginClaim({ ...proof, [key]: false }), false, key);
    assert.equal(canBeginClaim({ ...proof, [key]: undefined }), false, key);
  }
  assert.equal(canBeginClaim({ ...proof, consentVersion: 'owner-link-v0' }), false);
  assert.equal(canBeginClaim({ ...proof, consentSha256: '' }), false);
  assert.equal(canBeginClaim({ ...proof, consentSha256: 'a'.repeat(63) }), false);
  assert.equal(canBeginClaim({ ...proof, confirmedUser: { id: 'server-derived-uid', emailConfirmed: false } }), false);
  assert.equal(canBeginClaim(), false);
});
test('email candidate alone cannot authorize a claim', () => {
  const found = matchConfirmedLegacyOwner(trusted, one);
  assert.equal(found.eligible, true);
  assert.equal(canBeginClaim({confirmedUser: {id:'dest',emailConfirmed:true}, eligible:found.eligible,
    clickedConfirm:true,freshSession:true,validChallenge:true}), false);
});

// Static checks of the UNAPPLIED SQL proposal; not database or bearer proof.
const sql = readFileSync(new URL('../supabase/migrations/pending/phase3_owner_link_proposal.sql', import.meta.url),'utf8');
test('proposed owner link remains explicitly inactive and separate from legacy map',()=>{
  assert.match(sql,/PENDING \/ INACTIVE/);
  assert.match(sql,/does NOT alter legacy ifund_migration\.owner_identity_map/);
});
test('SQL requires both fresh provider proofs and explicit versioned consent',()=>{
  for (const s of [
    'source_session_verified_at BETWEEN issued_at AND now()',
    'destination_session_verified_at BETWEEN issued_at AND now()',
    "source_session_verified_at >= now() - interval '5 minutes'",
    "destination_session_verified_at >= now() - interval '5 minutes'",
    'explicit_user_consent_at BETWEEN issued_at AND now()',
    "consent_version = 'owner-link-v1'",
    "consent_sha256 ~ '^[a-f0-9]{64}$'",
  ]) assert.ok(sql.includes(s),s);
});
test('SQL rejects legacy email OTP until separately audited',()=>{
  assert.match(sql,/IF v_candidate\.proof_kind <> 'verified_provider_email' THEN RETURN false/);
});
test('SQL does not allow direct client or service-role mutation of audit receipts',()=>{
  assert.match(sql,/REVOKE ALL ON ifund_identity\.link_consent_audit FROM service_role/);
  assert.match(sql,/GRANT SELECT ON ifund_identity\.link_consent_audit TO service_role/);
  assert.match(sql,/REVOKE ALL ON ALL TABLES IN SCHEMA ifund_identity FROM PUBLIC, anon, authenticated/);
});
test('SQL keeps audited linking atomic and service-role only',()=>{
  assert.match(sql,/SECURITY DEFINER/);
  assert.match(sql,/current_setting\('request\.jwt\.claim\.role', true\) IS DISTINCT FROM 'service_role'/);
  assert.match(sql,/FOR UPDATE;/);
  assert.match(sql,/INSERT INTO ifund_identity\.link_consent_audit/);
  assert.match(sql,/auth\.sessions/);
});
