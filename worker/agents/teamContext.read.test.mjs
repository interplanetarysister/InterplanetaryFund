import test from 'node:test';
import assert from 'node:assert/strict';
import {readTeamContext} from './teamContext.js';
const env={IFUND_TEAM_CONTEXT_ENABLED:'enabled',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test-key'};
const jwt='verified.member.jwt';
const ownerEvent={id:'11111111-1111-4111-8111-111111111111',event_key:'22222222-2222-4222-8222-222222222222',agent_id:'discover',speaker:'user',content:'Synthetic private request'};
test('disabled flag fails closed without calling network',async()=>{
 let calls=0;
 const result=await readTeamContext({env:{...env,IFUND_TEAM_CONTEXT_ENABLED:'off'},jwt,fetcher:async()=>{calls++;throw Error('should not fetch')}});
 assert.deepEqual(result,{state:'disabled',events:[]});assert.equal(calls,0);
});
test('request never supplies owner ID, only authenticated JWT and owned campaign filter',async()=>{
 const campaignId='33333333-3333-4333-8333-333333333333';let request;
 const result=await readTeamContext({env,jwt,campaignId,limit:1,fetcher:async(url,init)=>{request={url,init};return {ok:true,json:async()=>[ownerEvent]}}});
 assert.equal(result.state,'ready');assert.equal(result.events.length,1);
 assert.equal(request.init.headers.Authorization,'Bearer '+jwt);
 assert.equal(request.init.headers['x-ifund-workforce-key'],undefined);
 const args=JSON.parse(request.init.body);assert.equal(args.p_campaign_id,campaignId);assert.equal(args.p_limit,1);
 assert.equal(Object.hasOwn(args,'owner_id'),false);
});
test('invalid cursor and unverified response are rejected',async()=>{
 await assert.rejects(readTeamContext({env,jwt,before:'2026-11-15T10:00:00Z'}),/cursor/);
 await assert.rejects(readTeamContext({env,jwt,fetcher:async()=>({ok:true,json:async()=>[{...ownerEvent,agent_id:'other'}]})}),/could not be verified/);
});

test('valid JWT and ISO cursor reach Supabase without privileged executor header',async()=>{
 const beforeId='44444444-4444-4444-8444-444444444444';
 let request;
 await readTeamContext({env,jwt,before:'2026-11-15T10:00:00Z',beforeId,fetcher:async(url,init)=>{request={url,init};return {ok:true,json:async()=>[]}}});
 assert.equal(request.url,env.SUPABASE_URL+'/rest/v1/rpc/ifund_team_recent');
 assert.equal(JSON.parse(request.init.body).p_before_id,beforeId);
 assert.equal(request.init.headers['x-ifund-workforce-key'],undefined);
});
test('missing JWT and invalid calendar cursor fail before network requests',async()=>{
 let calls=0;const fetcher=async()=>{calls++;throw Error('unexpected network')};
 await assert.rejects(readTeamContext({env,jwt:'',fetcher}),/token/);
 await assert.rejects(readTeamContext({env,jwt,before:'not-a-date',beforeId:'44444444-4444-4444-8444-444444444444',fetcher}),/cursor/);
 assert.equal(calls,0);
});
