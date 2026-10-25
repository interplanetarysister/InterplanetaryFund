import test from 'node:test';
import assert from 'node:assert/strict';
import { matchConfirmedLegacyOwner, canBeginClaim } from '../worker/ownerLinkRules.js';

const one = [{ source_user_id: 'legacy-A', source_email: 'someone@example.com', status: 'awaiting_destination_login' }];
const trusted = { email: 'Someone@Example.com', emailConfirmed: true, active: true };

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
test('consent must be explicit and the session/challenge fresh', () => {
  const proof = { confirmedUser: { id: 'server-derived-uid', emailConfirmed: true }, eligible: true,
    clickedConfirm: true, freshSession: true, validChallenge: true };
  assert.equal(canBeginClaim(proof), true);
  assert.equal(canBeginClaim({ ...proof, clickedConfirm: false }), false);
  assert.equal(canBeginClaim({ ...proof, freshSession: false }), false);
  assert.equal(canBeginClaim({ ...proof, validChallenge: false }), false);
});
