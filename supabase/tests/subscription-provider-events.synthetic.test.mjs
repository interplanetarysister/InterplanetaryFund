// Synthetic fixtures ONLY: no provider approvals, API calls, database writes, or live events.
import test from 'node:test';
import assert from 'node:assert/strict';

const base = Object.freeze({
  environment: 'live', currency: 'USD', memberId: 'member-A',
  subscriptionId: 'I-SYNTHETIC-001', intentId: 'intent-A',
  captureId: 'CAPTURE-SYNTHETIC-A', providerMerchantId: 'MERCHANT-SYNTHETIC',
  verified: true,
});
const refund = (overrides = {}) => ({ ...base, type: 'refund', resourceId: 'REFUND-SYNTHETIC-001',
  eventId: 'WH-SYNTHETIC-001', cents: 250, occurredAt: '2026-11-14T12:00:00Z', ...overrides });

// An independent economic resource is identified by environment, type and PayPal resource ID;
// webhook delivery ID is transport identity and may vary for the same economic event.
const economicKey = e => `${e.environment}:${e.type}:${e.resourceId}`;
const validIdentity = (a,b) => a.environment===b.environment && a.currency===b.currency &&
  a.memberId===b.memberId && a.subscriptionId===b.subscriptionId && a.intentId===b.intentId &&
  a.type===b.type && a.resourceId===b.resourceId && a.cents===b.cents &&
  a.captureId===b.captureId && a.providerMerchantId===b.providerMerchantId;
const refundFitsCapture = (captureCents, priorRefunds, proposedCents) =>
  Number.isSafeInteger(captureCents) && captureCents>=0 &&
  priorRefunds.every(n=>Number.isSafeInteger(n)&&n>=0) &&
  Number.isSafeInteger(proposedCents) && proposedCents>0 &&
  priorRefunds.reduce((a,b)=>a+b,0)+proposedCents<=captureCents;
const statePrecedence = e => e.type==='reversal'||e.type==='refund' ? 2 : 1;
const canApplyState = (incoming,current) => incoming.occurredAt > current.occurredAt ||
  (incoming.occurredAt === current.occurredAt && statePrecedence(incoming)>statePrecedence(current));
const webhookAdmissible = e => e.signatureVerified===true && e.providerLookupVerified===true;

test('synthetic: two webhook IDs for one refund remain one economic resource',()=>{
  const first=refund(),replay=refund({eventId:'WH-SYNTHETIC-002'});
  assert.notEqual(first.eventId,replay.eventId);
  assert.equal(economicKey(first),economicKey(replay));
  assert.equal(validIdentity(first,replay),true);
});
test('synthetic: same refund ID cannot be reused with changed owner, currency, or environment',()=>{
  const first=refund();
  for(const conflict of [{memberId:'member-B'},{currency:'EUR'},{environment:'sandbox'},
    {captureId:'CAPTURE-SYNTHETIC-B'},{cents:251},{intentId:'intent-B'}]) {
    assert.equal(validIdentity(first,refund(conflict)),false,JSON.stringify(conflict));
  }
});
test('synthetic: refunds are bounded by their own parent capture, not aggregate subscription receipts',()=>{
  assert.equal(refundFitsCapture(500,[250],250),true);
  assert.equal(refundFitsCapture(500,[250],251),false);
  assert.equal(refundFitsCapture(500,[250,250],1),false);
  assert.equal(refundFitsCapture(500,[],501),false);
  assert.equal(refundFitsCapture(500,[],0),false);
});
test('synthetic: stale status-only event cannot overtake later reversal',()=>{
  const current={type:'reversal',occurredAt:'2026-11-14T12:00:00Z'};
  assert.equal(canApplyState({type:'payment',occurredAt:'2026-11-14T11:59:00Z'},current),false);
  assert.equal(canApplyState({type:'payment',occurredAt:current.occurredAt},current),false);
  assert.equal(canApplyState({type:'payment',occurredAt:'2026-11-14T12:01:00Z'},current),true);
});
test('synthetic: unsigned or provider-unverified webhooks are never financial proof',()=>{
  assert.equal(webhookAdmissible({signatureVerified:false,providerLookupVerified:true}),false);
  assert.equal(webhookAdmissible({signatureVerified:true,providerLookupVerified:false}),false);
  assert.equal(webhookAdmissible({signatureVerified:true,providerLookupVerified:true}),true);
});
