import test from 'node:test';
import assert from 'node:assert/strict';
import {rememberPendingCampaignSetup,pendingCampaignSetup,clearPendingCampaignSetup} from '../src/lib/campaignCreationRecovery.mjs';
import {campaignSetupPayload} from '../src/api/campaignSetup.js';

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const campaign='33333333-3333-4333-8333-333333333333',otherCampaign='44444444-4444-4444-8444-444444444444';
const setup={draft_step:3,end_date:'2026-12-31',location:'Private synthetic setup',
 ai_profile:{tone:'Clear',never_change:'Keep the actual budget'},story_versions:[{text:'Original private story ',saved_at:'2026-11-16'}]};
function storage(){
 const data=new Map();return {data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
}
function envelope(patch={}){return JSON.stringify({version:1,owner_id:owner,campaign_id:campaign,setup,...patch});}
function ownerKey(s){
 assert.equal(rememberPendingCampaignSetup(s,owner,campaign,setup),true);
 return [...s.data.keys()][0];
}
test('verified core receipt and normalized private setup survive reload without losing user text',()=>{
 const s=storage();assert.equal(rememberPendingCampaignSetup(s,owner,campaign,setup),true);
 const reloaded={getItem:s.getItem};
 assert.deepEqual(pendingCampaignSetup(reloaded,owner),{campaignId:campaign,setup:campaignSetupPayload(setup,3)});
 assert.equal(pendingCampaignSetup(reloaded,owner,campaign).setup.story_versions[0].text,'Original private story ');
 assert.equal(rememberPendingCampaignSetup(s,owner,campaign,{...setup,draft_step:2}),true);
 assert.equal(pendingCampaignSetup(s,owner).setup.draft_step,2);
});
test('pending receipts remain isolated by account and exact campaign',()=>{
 const s=storage();rememberPendingCampaignSetup(s,owner,campaign,setup);
 assert.equal(pendingCampaignSetup(s,other),null);assert.equal(pendingCampaignSetup(s,owner,otherCampaign),null);
 assert.equal(rememberPendingCampaignSetup(s,other,otherCampaign,{...setup,location:'Other owner'}),true);
 assert.equal(pendingCampaignSetup(s,owner).setup.location,setup.location);
 assert.equal(pendingCampaignSetup(s,other).campaignId,otherCampaign);
 assert.equal(clearPendingCampaignSetup(s,owner,otherCampaign),false);
 assert.equal(pendingCampaignSetup(s,other).setup.location,'Other owner');
});
test('a valid receipt for another campaign is preserved until its own setup is confirmed',()=>{
 const s=storage();ownerKey(s);const before=[...s.data.entries()];
 assert.equal(rememberPendingCampaignSetup(s,owner,otherCampaign,setup),false);
 assert.deepEqual([...s.data.entries()],before);
 assert.equal(clearPendingCampaignSetup(s,owner,campaign),true);
 assert.equal(rememberPendingCampaignSetup(s,owner,otherCampaign,setup),true);
});
test('malformed, wrong-owner and unsupported envelopes are never accepted, overwritten or removed',()=>{
 for(const raw of ['','{broken', 'null','[]',envelope({version:2}),envelope({owner_id:other}),
  envelope({campaign_id:'not-a-campaign'}),envelope({setup:[]}),envelope({setup:{end_date:'invalid'}}),
  envelope({unexpected:'unverifiable extra data'})]){
  const s=storage(),key=ownerKey(s);s.data.set(key,raw);
  assert.equal(pendingCampaignSetup(s,owner),null);
  assert.equal(rememberPendingCampaignSetup(s,owner,campaign,setup),false);
  assert.equal(clearPendingCampaignSetup(s,owner,campaign),false);
  assert.equal(s.data.get(key),raw);
 }
});
test('oversized records are refused by bytes before JSON parsing, including multibyte text',()=>{
 for(const raw of ['x'.repeat(220001),envelope({setup:{location:'é'.repeat(115000)}})]){
  const s=storage(),key=ownerKey(s);s.data.set(key,raw);
  assert.equal(pendingCampaignSetup(s,owner),null);assert.equal(clearPendingCampaignSetup(s,owner,campaign),false);
  assert.equal(rememberPendingCampaignSetup(s,owner,campaign,setup),false);assert.equal(s.data.get(key),raw);
 }
});
test('only strict UUID identities can read or mutate a recovery slot',()=>{
 const s=storage();ownerKey(s);const before=[...s.data.entries()];
 for(const invalid of [null,undefined,'',owner+' ',owner+'/other','../'+owner,owner.replaceAll('-',''),{}]){
  assert.equal(pendingCampaignSetup(s,invalid),null);
  assert.equal(rememberPendingCampaignSetup(s,invalid,campaign,setup),false);
  assert.equal(clearPendingCampaignSetup(s,invalid,campaign),false);
  assert.equal(rememberPendingCampaignSetup(s,owner,invalid,setup),false);
  assert.equal(clearPendingCampaignSetup(s,owner,invalid),false);
  if(invalid!==undefined)assert.equal(pendingCampaignSetup(s,owner,invalid),null);
 }
 assert.deepEqual([...s.data.entries()],before);
});
test('UUID case cannot create a second owner slot or evade conditional clearing',()=>{
 const namedOwner='abcdefab-cdef-4abc-8def-abcdefabcdef',namedCampaign='fedcbafe-dcba-4fed-8cba-fedcbafedcba',s=storage();
 assert.equal(rememberPendingCampaignSetup(s,namedOwner.toUpperCase(),namedCampaign.toUpperCase(),setup),true);
 assert.equal(pendingCampaignSetup(s,namedOwner).campaignId,namedCampaign);assert.equal(s.data.size,1);
 assert.equal(clearPendingCampaignSetup(s,namedOwner,namedCampaign.toUpperCase()),true);assert.equal(s.data.size,0);
});
test('clear succeeds only after removing the matching receipt and preserves changed or unverifiable storage',()=>{
 const s=storage(),key=ownerKey(s);
 assert.equal(clearPendingCampaignSetup(s,owner,campaign),true);assert.equal(pendingCampaignSetup(s,owner),null);
 assert.equal(clearPendingCampaignSetup(s,owner,campaign),true);
 rememberPendingCampaignSetup(s,owner,campaign,setup);
 assert.equal(clearPendingCampaignSetup({...s,removeItem(){}},owner,campaign),false);assert.ok(s.data.has(key));
 let reads=0;const changed={...s,getItem:k=>{if(++reads===2)s.data.set(k,envelope({campaign_id:otherCampaign}));return s.getItem(k);}};
 assert.equal(clearPendingCampaignSetup(changed,owner,campaign),false);
 assert.equal(pendingCampaignSetup(s,owner).campaignId,otherCampaign);
});
test('read, write quota and removal failures never claim that recovery was persisted or cleared',()=>{
 const s=storage(),key=ownerKey(s),before=s.data.get(key);
 const unreadable={...s,getItem(){throw Error('storage unavailable');}};
 assert.equal(pendingCampaignSetup(unreadable,owner),null);
 assert.equal(rememberPendingCampaignSetup(unreadable,owner,campaign,setup),false);
 assert.equal(clearPendingCampaignSetup(unreadable,owner,campaign),false);
 assert.equal(rememberPendingCampaignSetup({...s,setItem(){throw Error('quota');}},owner,campaign,{...setup,draft_step:1}),false);
 assert.equal(clearPendingCampaignSetup({...s,removeItem(){throw Error('remove denied');}},owner,campaign),false);
 assert.equal(s.data.get(key),before);
 assert.equal(rememberPendingCampaignSetup({...s,setItem(){}},owner,campaign,{...setup,draft_step:1}),false);
});
