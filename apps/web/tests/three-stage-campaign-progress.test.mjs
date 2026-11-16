import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignSetupPayload} from '../src/api/campaignSetup.js';
import {restoreWizard,rememberWizard} from '../src/lib/campaignWizard.js';
test('current three-stage saves remain stable across repeated normalization and storage reload',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
 for(const step of [0,1,2]){
  const first=campaignSetupPayload({},step),second=campaignSetupPayload(first,step);
  assert.equal(first.draft_step,step);assert.equal(second.draft_step,step);
  assert.equal(rememberWizard(storage,'owner',null,second),true);assert.equal(restoreWizard(storage,'owner').draft_step,step);
 }
});
test('legacy four-stage records migrate once without losing private instructions',()=>{
 for(const [oldStep,newStep] of [[0,0],[1,0],[2,1],[3,2]]){
  const storage={getItem:()=>JSON.stringify({version:1,owner_id:'owner',campaign_id:null,setup:{draft_step:oldStep,ai_profile:{tone:'Preserve my facts'}}})};
  const restored=restoreWizard(storage,'owner');assert.equal(restored.draft_step,newStep);assert.equal(restored.ai_profile.tone,'Preserve my facts');
  assert.equal(campaignSetupPayload(restored,restored.draft_step).draft_step,newStep);
 }
});
