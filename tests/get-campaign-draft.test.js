import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/api/get-campaign-draft.js';

const owner='11111111-1111-4111-8111-111111111111';
const draft='22222222-2222-4222-8222-222222222222';
const env={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'publishable'};
function req(id=draft) {return new Request('https://example.com/api/get-campaign-draft',{method:'POST',headers:{authorization:'Bearer example','content-type':'application/json'},body:JSON.stringify({campaign_id:id})});}
function install(rows) {
 const prev=globalThis.fetch, calls=[];
 globalThis.fetch=async (u,opts)=>{const url=new URL(u);calls.push({url,opts});
 if(url.pathname==='/auth/v1/user')return Response.json({id:owner});
 if(url.pathname==='/rest/v1/ifund_profiles')return Response.json([{account_status:'active',account_deletion_pending:false,lifecycle_provenance:'signup'}]);
 if(url.pathname==='/rest/v1/ifund_campaigns')return Response.json(rows);
 return new Response(null,{status:404});};
 return {calls,restore(){globalThis.fetch=prev;}};
}
test('draft endpoint requires authentication',async()=>{
 const response=await onRequestPost({request:new Request('https://example.com/api/get-campaign-draft',{method:'POST'}),env});
 assert.equal(response.status,401);
});
test('draft endpoint rejects malformed IDs',async()=>{
 const mock=install([]);
 try{const response=await onRequestPost({request:req('not-a-uuid'),env});assert.equal(response.status,400);assert.equal(mock.calls.length,2);}
 finally{mock.restore();}
});
test('draft endpoint restricts owner and draft status',async()=>{
 const mock=install([{id:draft,owner_id:owner,title:'Owner draft',status:'draft'}]);
 try{
  const response=await onRequestPost({request:req(),env});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.campaign.owner_id,undefined);
  const query=mock.calls[2].url.searchParams;
  assert.equal(query.get('owner_id'),'eq.'+owner);
  assert.equal(query.get('status'),'eq.draft');
  assert.equal(query.get('id'),'eq.'+draft);
 }finally{mock.restore();}
});
test('draft endpoint returns 404 on no owner-visible draft',async()=>{
 const mock=install([]);
 try{const response=await onRequestPost({request:req(),env});assert.equal(response.status,404);}
 finally{mock.restore();}
});
