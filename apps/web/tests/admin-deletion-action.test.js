import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createAdminReviewSession,runAdminReview} from '../src/lib/adminReviewSession.js';

// Execute the actual route action, isolating only React state and transport.
// The real persistent owner guard remains in use; no production erasure runs.
const source=readFileSync(new URL('../src/pages/AdminDeletionQueue.jsx',import.meta.url),'utf8');
const start=source.indexOf('  async function act('),end=source.indexOf('\n  return <main',start);
assert.ok(start>=0&&end>start);
const row={request_id:'request-A'},other={request_id:'request-B'};
const note='Reviewed synthetic retention and document dependencies.';
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function harness({selected=row.request_id,reviewNote=note,gate=null}={}){
 const calls=[],errors=[],notices=[],scope=createAdminReviewSession();scope.bind('admin-A');
 let checks=0,refresh=0;
 const client={auth:{getUser:async()=>{checks++;if(gate)await gate.promise;return {data:{user:{id:'admin-A'}}};}},
  rpc:async(name,args)=>{calls.push({name,args});return {data:true};}};
 const context=vm.createContext({reviewScope:{current:scope},actionLock:{current:false},processing:'',selected,reviewNote,
  // React state writes do not change variables captured by an existing handler.
  setProcessing(){},setError:v=>errors.push(v),setNotice:v=>notices.push(v),setReviewNote(){},setRefresh:fn=>{refresh=fn(refresh);},
  authClient:()=>client,runAdminReview,window:{confirm:()=>assert.fail('review must not request erasure')},
  fetch:()=>assert.fail('review must not execute erasure'),AbortSignal});
 vm.runInContext(source.slice(start,end),context);
 return {act:context.act,calls,errors,notices,scope,context,get checks(){return checks;},get refresh(){return refresh;}};
}
test('review evidence for another selected request is rejected before identity or mutation access',async()=>{
 const h=harness();await h.act(other,true);assert.equal(h.checks,0);assert.equal(h.calls.length,0);assert.match(h.errors.at(-1),/Select this request/);
});
test('blank, short and oversized evidence is rejected before any administrative call',async()=>{
 for(const reviewNote of ['', ' '.repeat(40), 'x'.repeat(29), 'x'.repeat(1001)]){
  const h=harness({reviewNote});await h.act(row,true);assert.equal(h.checks,0);assert.equal(h.calls.length,0);
 }
});
test('request and evidence are fixed before asynchronous verification and never become erasure authority',async()=>{
 const gate=deferred(),h=harness({gate}),pending=h.act(row,true);
 h.context.selected=other.request_id;h.context.reviewNote='Edited after the original review was submitted.';gate.resolve();await pending;
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'ifund_super_admin_review_private_document_cleanup');
 assert.equal(h.calls[0].args.p_request_id,row.request_id);assert.equal(h.calls[0].args.p_review_note,note);
 assert.equal(h.refresh,1);assert.match(h.notices.at(-1),/does not complete the account deletion/);
});
test('two clicks before React commits processing state start only one administrative mutation',async()=>{
 const gate=deferred(),h=harness({gate}),first=h.act(row,true),second=h.act(row,true);
 gate.resolve();await Promise.all([first,second]);assert.equal(h.calls.length,1);
});
test('an account switch during verification permanently prevents review and private acknowledgement',async()=>{
 const gate=deferred(),h=harness({gate}),pending=h.act(row,true);
 h.scope.observe('admin-B');h.scope.observe('admin-A');gate.resolve();await pending;
 assert.equal(h.calls.length,0);assert.equal(h.refresh,0);assert.ok(!h.notices.some(Boolean));
});
