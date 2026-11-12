// Synthetic sandbox-only invariants; never writes provider or database state.
import test from 'node:test';
import assert from 'node:assert/strict';

const validTransitions = {
  created: new Set(['approved', 'cancelled', 'failed']),
  approved: new Set(['captured', 'cancelled', 'failed']),
  captured: new Set(['refunded', 'partially_refunded']),
  partially_refunded: new Set(['partially_refunded', 'refunded']),
  refunded: new Set(), cancelled: new Set(), failed: new Set()
};
function transition(from, to) {
  if (!validTransitions[from]?.has(to)) throw Error('invalid payment transition '+from+' -> '+to);
  return to;
}
function postEvent(state, event) {
  if (event.environment !== 'sandbox' || !event.signatureVerified || !event.eventId || !event.captureId) throw Error('untrusted event');
  if (state.eventIds.has(event.eventId)) return false;
  if (state.captureIds.has(event.captureId) && event.type === 'CAPTURE.COMPLETED') throw Error('duplicate capture under new event ID');
  if (event.type !== 'CAPTURE.COMPLETED') throw Error('unsupported event');
  state.eventIds.add(event.eventId);
  state.captureIds.add(event.captureId);
  return true;
}
function newState() { return {eventIds:new Set(),captureIds:new Set()}; }
const event = {environment:'sandbox',signatureVerified:true,eventId:'synthetic-e1',captureId:'synthetic-c1',type:'CAPTURE.COMPLETED'};

test('synthetic normal state transition and refund lifecycle',()=>{
  assert.equal(transition('created','approved'),'approved');
  assert.equal(transition('approved','captured'),'captured');
  assert.equal(transition('captured','partially_refunded'),'partially_refunded');
  assert.equal(transition('partially_refunded','refunded'),'refunded');
});
test('synthetic cancellation, failure and impossible state transitions rejected',()=>{
  for (const [a,b] of [['created','captured'],['cancelled','captured'],['failed','approved'],['refunded','captured'],['captured','approved']]) assert.throws(()=>transition(a,b));
});
test('synthetic signed event idempotency',()=>{
  const state=newState(); assert.equal(postEvent(state,event),true); assert.equal(postEvent(state,event),false);
  assert.equal(state.eventIds.size,1); assert.equal(state.captureIds.size,1);
});
test('synthetic duplicate capture under different event ID rejected',()=>{
  const state=newState(); postEvent(state,event);
  assert.throws(()=>postEvent(state,{...event,eventId:'synthetic-e2'}));
});
test('synthetic unsigned, missing identity and production events rejected',()=>{
  for (const invalid of [{signatureVerified:false},{environment:'live'},{eventId:''},{captureId:''}]) {
    const state=newState(); assert.throws(()=>postEvent(state,{...event,...invalid}));
    assert.equal(state.eventIds.size,0);
  }
});
test('synthetic out-of-order event rejected without ledger effects',()=>{
  const state=newState(); assert.throws(()=>postEvent(state,{...event,type:'CAPTURE.REFUNDED'}));
  assert.equal(state.eventIds.size,0); assert.equal(state.captureIds.size,0);
});
