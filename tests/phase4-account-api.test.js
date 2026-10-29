import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import { routeAccountRequest } from '../worker/accountRoutes.js';

const uid='a09c3b82-1758-454d-912c-e69ea4136daa';
const other='9baa21da-845b-46d9-9476-a41c38564756';
const env={MIGRATION_API_PREVIEW:'enabled',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_only'};
const base='https://ifund.example';
function request(path,method='GET',body,auth=true){
  return new Request(base+path,{method,headers:{
    ...(auth?{authorization:'Bearer verified.test.jwt'}:{}),
    ...(body===undefined?{}:{'content-type':'application/json'}),
  },...(body===undefined?{}:{body:JSON.stringify(body)})});
}
function remote(calls,rows=[]){
  return async(url,opts)=>{
    calls.push({url:String(url),opts});
    if(String(url).endsWith('/auth/v1/user'))return Response.json({id:uid});
    return Response.json(rows);
  };
}
test('account routes default to 503 until migration gate is enabled',async()=>{
  for(const p of ['/api/account/me','/api/account/profile','/api/account/connections']){
    assert.equal((await worker.fetch(request(p))).status,503);
  }
});
test('anonymous account access does not read private provider tables',async()=>{
  const calls=[];const r=await routeAccountRequest(request('/api/account/connections','GET',undefined,false),env,remote(calls));
  assert.equal(r.status,401);assert.equal(calls.length,0);
});
test('session endpoint returns only verified uid, no arbitrary role claims',async()=>{
  const calls=[];
  const r=await routeAccountRequest(request('/api/account/me'),env,remote(calls));
  assert.deepEqual(await r.json(),{id:uid});
  assert.equal(calls.length,1);
  assert.ok(calls[0].url.endsWith('/auth/v1/user'));
});
test('profile GET filters by signed-in uid and never uses service-role credentials',async()=>{
  const calls=[];
  const row={id:uid,handle:'Clean_Up',display_name:'Beach'};
  const r=await routeAccountRequest(request('/api/account/profile'),env,remote(calls,[row]));
  assert.equal(r.status,200);assert.deepEqual(await r.json(),row);
  assert.ok(calls[1].url.includes('ifund_profiles?'));
  assert.ok(calls[1].url.includes(uid));
  assert.equal(calls[1].opts.headers.Authorization,'Bearer verified.test.jwt');
  assert.equal(calls[1].opts.headers.apikey,env.SUPABASE_PUBLISHABLE_KEY);
});
test('PUT profile derives uid and uses RLS-scoped upsert without an admin role',async()=>{
  const calls=[];
  const r=await routeAccountRequest(request('/api/account/profile','PUT',
    {handle:'Planet_One',display_name:' IFund '}),env,
    remote(calls,[{id:uid,handle:'Planet_One',display_name:'IFund'}]));
  assert.equal(r.status,200);
  assert.equal(calls[1].opts.method,'POST');
  assert.equal(calls[1].opts.headers.Prefer,'resolution=merge-duplicates,return=representation');
  assert.ok(calls[1].url.includes('on_conflict=id'));
  assert.deepEqual(JSON.parse(calls[1].opts.body),{id:uid,handle:'Planet_One',display_name:'IFund'});
});
test('profile write rejects identity overrides and reserved privileged fields',async()=>{
  const attempts=[{handle:'person',id:other},{display_name:'OK',role:'admin'},
    {handle:'x'},{handle:'no space'},{handle:'b'.repeat(33)},{display_name:'x'.repeat(101)},
    {handle:null},{created_at:'yesterday'},{},['not a profile']];
  for(const attempt of attempts){
    const calls=[];const r=await routeAccountRequest(request('/api/account/profile','PUT',attempt),env,remote(calls));
    assert.equal(r.status,422);assert.equal(calls.length,1);
  }
});
test('profile upsert requires a returned row owned by the authenticated user',async()=>{
  const calls=[];
  assert.equal((await routeAccountRequest(request('/api/account/profile','PUT',{handle:'Person_1'}),
    env,remote(calls,[]))).status,503);
  assert.equal((await routeAccountRequest(request('/api/account/profile','PUT',{handle:'Person_1'}),
    env,remote([],[{id:other,handle:'Person_1'}]))).status,503);
});
test('provider connections can only be read for current account, cannot be set connected by user',async()=>{
  const calls=[];
  const r=await routeAccountRequest(request('/api/account/connections'),env,remote(calls,
    [{provider:'facebook',status:'connected',verified_at:null},
     {provider:'paypal',status:'connected',verified_at:'2026-10-24T12:00:00Z'}]));
  assert.equal(r.status,200);
  assert.deepEqual(await r.json(),[
    {provider:'facebook',status:'pending',verified_at:null},
    {provider:'paypal',status:'connected',verified_at:'2026-10-24T12:00:00Z'},
  ]);
  assert.ok(calls[1].url.includes(uid));assert.match(calls[1].url,/owner_id=eq/);
  const forbidden=await routeAccountRequest(request('/api/account/connections','PUT',{provider:'paypal',status:'connected'}),env,
    ()=>{throw Error('forbidden write must not fetch');});
  assert.equal(forbidden.status,405);
});
test('account writes reject inappropriate methods, content types and oversized bodies',async()=>{
  assert.equal((await routeAccountRequest(request('/api/account/me','POST',{}),env)).status,405);
  const bad=new Request(base+'/api/account/profile',{method:'PUT',body:'not-json',headers:{authorization:'Bearer verified.test.jwt'}});
  assert.equal((await routeAccountRequest(bad,env)).status,415);
  const body={display_name:'x'.repeat(3000)};const calls=[];
  assert.equal((await routeAccountRequest(request('/api/account/profile','PUT',body),env,remote(calls))).status,413);
  assert.equal(calls.length,1); // authenticated before size check, no database write
});
test('provider failures are sanitized and cannot expose upstream details',async()=>{
  const r=await routeAccountRequest(request('/api/account/profile'),env,async(url)=>{
    if(String(url).endsWith('/auth/v1/user'))return Response.json({id:uid});
    return new Response('provider diagnostic SECRET',{status:500});
  });
  assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/SECRET/);
});


test('member can clear optional handle without impersonation', async()=>{
  const calls=[];
  const result=await routeAccountRequest(request('/api/account/profile','PUT',{handle:null}),env,
    remote(calls,[{id:uid,handle:null,display_name:'Member'}]));
  assert.equal(result.status,200);
  const sent=JSON.parse(calls[1].opts.body);
  assert.equal(sent.id,uid);
  assert.equal(sent.handle,null);
});
