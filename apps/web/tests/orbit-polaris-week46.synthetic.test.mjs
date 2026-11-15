// Week 46: isolated fictional training exercises. No live agent, payment, or provider calls.
import test from 'node:test';
import assert from 'node:assert/strict';
const pantry = Object.freeze({shelving:1200,refrigeration:2900,safety:700,goal:4800,providerFee:null,externalGifts:0});
const budgetTotal = p => p.shelving+p.refrigeration+p.safety;
const canClaimVerified = item => item?.source==='provider_verified' && item?.environment==='live' && item?.providerReceipt===true;
const handoff = (source,target,facts,approved=false) => ({source,target,facts,ownerApproval:approved,status:'proposed',transmitted:false});
const rubric = Object.freeze({purpose:3,clarity:4,financing:3,consent:0,accessibility:2,donorRelevance:3});
const readiness = values => ({score:Object.values(values).reduce((a,b)=>a+b,0),max:Object.keys(values).length*4,probability:null});
test('ORBIT fictional pantry budget is exact and provider fees remain unknown',()=>{assert.equal(budgetTotal(pantry),pantry.goal);assert.equal(pantry.providerFee,null);assert.equal(pantry.externalGifts,0)});
test('ORBIT refuses to merge external or owner-reported gifts into verified ledger',()=>{assert.equal(canClaimVerified({source:'owner_reported',environment:'live',providerReceipt:false}),false);assert.equal(canClaimVerified({source:'provider_verified',environment:'sandbox',providerReceipt:true}),false);assert.equal(canClaimVerified({source:'provider_verified',environment:'live',providerReceipt:true}),true)});
test('ORBIT to STORY financial brief requires owner approval before external handoff',()=>{const h=handoff('orbit','story',[{claim:'$4,800 proposed budget',source:'fictional example',verified:false}]);assert.equal(h.ownerApproval,false);assert.equal(h.transmitted,false);assert.equal(h.status,'proposed')});
test('POLARIS readiness rubric is explainable, not donation probability',()=>{const r=readiness(rubric);assert.equal(r.score,15);assert.equal(r.max,24);assert.equal(r.probability,null);assert.equal(rubric.consent,0)});
test('POLARIS routes financing to ORBIT and narrative to STORY without contacting either',()=>{const f=handoff('polaris','orbit',[{claim:'financing needs verification',verified:false}]);const s=handoff('polaris','story',[{claim:'story clarity needs review',verified:false}]);assert.deepEqual([f.target,s.target],['orbit','story']);assert.equal(f.transmitted||s.transmitted,false)});
