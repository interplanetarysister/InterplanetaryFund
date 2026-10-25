import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCutover, REQUIRED_PROOFS } from '../scripts/cutover-readiness.mjs';
const make = () => ({
  project: 'ifund2', destination: 'tzehxfikoslihnclhxuz', cutoverActivated: false,
  proofs: Object.fromEntries(REQUIRED_PROOFS.map(k => [k, {
    status: 'verified', reference: `reviewed:${k}`, checkedAt: '2026-10-24T18:00:00Z', environment: 'live',
  }])),
});
test('rejects empty evidence', () => assert.equal(assessCutover(null).ready, false));
test('rejects project substitution', () => { const e=make(); e.project='other'; assert.equal(assessCutover(e).ready,false); });
test('rejects activation during preflight', () => { const e=make(); e.cutoverActivated=true; assert.equal(assessCutover(e).ready,false); });
test('rejects missing proof', () => { const e=make(); delete e.proofs.owner_dual_provider_session_proof; assert.equal(assessCutover(e).ready,false); });
test('rejects source-only unverified proof', () => { const e=make(); e.proofs.cross_owner_denial_and_tenant_rls.status='source-only'; assert.equal(assessCutover(e).ready,false); });
test('rejects evidence without timestamp or reference', () => { const e=make(); e.proofs.owner_consent_audit_receipts.checkedAt=''; e.proofs.owner_consent_audit_receipts.reference=''; assert.equal(assessCutover(e).ready,false); });
test('rejects source-only evidence even when labeled verified', () => { const e=make(); e.proofs.owner_dual_provider_session_proof.environment='source'; assert.equal(assessCutover(e).ready,false); });
test('rejects staging-only evidence for live payment proof', () => { const e=make(); e.proofs.provider_verified_paypal_settlement_and_webhook_idempotency.environment='staged'; assert.equal(assessCutover(e).ready,false); });
test('requires every declared proof', () => { const e=make(); for(const key of REQUIRED_PROOFS){const x=structuredClone(e); delete x.proofs[key]; assert.equal(assessCutover(x).ready,false,key);} });
test('complete manifest is review-ready, never activates cutover', () => { const e=make(); const result=assessCutover(e); assert.equal(result.ready,true); assert.equal(e.cutoverActivated,false); });
