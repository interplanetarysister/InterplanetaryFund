import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createUnclaimedPayload, pageSlug } from '../base44/shared/justGivingUnclaimed.js';

// Exercise the actual Base44 handler with isolated dependency injection:
// no JustGiving network calls, real accounts, credentials, or provider writes.
const source = readFileSync(new URL('../base44/functions/justGivingStagingPilot/entry.ts', import.meta.url), 'utf8')
  .replace(/^import .*?;\s*$/gm, '')
  .replace('export default async function(req)', 'return async function(req)');

let now;
function harness({ user = {id:'owner-test',role:'admin'}, prior = [], configured = true,
  allowWrite = true, failing = '', response } = {}) {
  const calls = [];
  const store = [...prior];
  const campaign = {id:'campaign-test-123456',created_by_id:'owner-test',title:'Test Fundraiser',
    story:'A staging-only authorized charity test.',goal_amount:250,status:'active'};
  const sr = {entities:{ExternalCampaignPublication:{
    filter: async () => { calls.push('filter'); if(failing === 'filter')throw new Error('db'); return store.slice(); },
    create: async data => { calls.push('reserve'); if(failing === 'reserve')throw new Error('db');
      const row = {...data,id:'reservation-1'};store.push(row);return row; },
    update: async (id,data) => { calls.push('update'); const row=store.find(x=>x.id===id);
      if(!row)throw new Error('missing reservation');Object.assign(row,data);return row; },
  }}};
  const base44 = {
    entities:{ Campaign:{get: async ()=>campaign}},
    asServiceRole:sr,
  };
  const create = async () => {
    calls.push('provider');
    if(failing === 'provider')throw new Error('staging timeout');
    return response || {ok:true,status:'staging_created',page_id:'77',
      page_url:'https://www.staging.justgiving.com/id/test-page',
      claim_url:'https://www.staging.justgiving.com/create-page/id/test-page/secret'};
  };
  const fn = new Function('createClientFromRequest','assertActiveAccount','createUnclaimedPayload',
    'createJustGivingStagingPage','pageSlug','Deno','Response',source)(
    () => base44, async()=>({ok:true,user}),createUnclaimedPayload,create,pageSlug,
    {env:{get:key=>key==='JUSTGIVING_APP_ID'?(configured?'TestAppID1':''):
      key==='JUSTGIVING_STAGING_WRITE_ENABLED'?(allowWrite?'true':'false'):''}},
    Response);
  const request = async (action='create_staging', overrides={}) =>
    fn({json: async()=>({
      action,campaign_id:campaign.id,charity_id:12345,
      activity_type:'OtherPersonalChallenge',currency:'GBP',
      target_amount:'200.25',confirm_target_amount:true,
      confirm_staging_creation:true,confirm_charity_eligibility:true,confirm_provider_terms:true,
      ...overrides,
    })});
  return {request,calls,store,campaign};
}
const ok = harness();
let res = await ok.request();
assert.equal(res.status,200);
let data = await res.json();
assert.equal(data.status,'staging_created');
assert.deepEqual(ok.calls.slice(0,3),['filter','reserve','provider']);
assert.equal(ok.store[0].status,'staging_created');
assert.equal(ok.store[0].provider_page_id,'77');
res = await ok.request();
data = await res.json();
assert.equal(data.duplicate,true);
assert.equal(ok.calls.filter(x=>x==='provider').length,1);

const denied = harness({user:{id:'owner-test',role:'user'}});
res = await denied.request();
assert.equal(res.status,403);
assert.deepEqual(denied.calls,[]);

const readiness = harness({configured:false,allowWrite:false});
res = await readiness.request('readiness');
data = await res.json();
assert.equal(data.ready,false);
assert.deepEqual(readiness.calls,[]);

const preview = harness({configured:false,allowWrite:false});
res = await preview.request('preview');
data = await res.json();
assert.equal(data.preview_only,true);
assert.equal(data.target_amount,'200.25');
assert.deepEqual(preview.calls,[]);

const noKey=harness({configured:false});
res=await noKey.request(); assert.equal(res.status,409);
assert.deepEqual(noKey.calls,[]);

const noPermission=harness();
res=await noPermission.request('create_staging',{confirm_provider_terms:false});
assert.equal(res.status,403);
assert.deepEqual(noPermission.calls,[]);

const noHistory = harness({failing:'filter'});
res = await noHistory.request();
assert.equal(res.status,503);
assert.deepEqual(noHistory.calls,['filter']);

const noReservation=harness({failing:'reserve'});
res=await noReservation.request();
assert.equal(res.status,503);
assert.deepEqual(noReservation.calls,['filter','reserve']);

const inconclusive=harness({failing:'provider'});
res=await inconclusive.request();
assert.equal(res.status,502);
assert.deepEqual(inconclusive.calls.slice(0,3),['filter','reserve','provider']);
assert.equal(inconclusive.store[0].status,'needs_attention');
res=await inconclusive.request();
assert.equal(res.status,409);
assert.equal(inconclusive.calls.filter(x=>x==='provider').length,1);

const conflict=harness({response:{ok:false,status:'provider_conflict'}});
res=await conflict.request();
assert.equal(res.status,409);
assert.equal(conflict.store[0].status,'needs_attention');
assert.equal(conflict.calls.filter(x=>x==='provider').length,1);

const oldRecord=harness({prior:[{id:'before',status:'needs_attention'}]});
res=await oldRecord.request();
assert.equal(res.status,409);
assert.deepEqual(oldRecord.calls,['filter']);

console.log('JustGiving worker authorization, staging preview, no-config, request reservation, duplicate, and ambiguous outcome tests: PASS');
