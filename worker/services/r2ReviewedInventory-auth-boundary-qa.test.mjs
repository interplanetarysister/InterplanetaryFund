import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewedR2Inventory } from './r2ReviewedInventory.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const foreign='22222222-2222-4222-8222-222222222222';
const campaign='33333333-3333-4333-8333-333333333333';
const documentId='44444444-4444-4444-8444-444444444444';
const requestId='55555555-5555-4555-8555-555555555555';
const row={document_id:documentId,campaign_id:campaign,storage_path:`private/campaign-documents/${owner}/${campaign}/${documentId}.pdf`,object_store:'r2',owner_id:owner,object_etag:'"etag"',object_sha256:'a'.repeat(64),file_size:10,deletion_requested_at:'2026-11-20T00:00:00Z'};
const receipt={id:documentId,owner_id:owner,campaign_id:campaign,object_store:'r2',storage_path:row.storage_path,object_etag:row.object_etag,object_sha256:row.object_sha256,file_size:10,object_verified_at:'2026-11-20T00:00:00Z',deletion_requested_at:row.deletion_requested_at,allow_agent_use:false};
function setup({review=[{request_id:requestId,review_ready:true}],requests=[{request_id:requestId,request_status:'reviewing',requested_user_id:owner}],rows=[row],proof=receipt}={}){
 const calls=[];
 const rpc=async(name,args,jwt)=>{calls.push({name,args,jwt});assert.equal(jwt,'admin-jwt');if(name==='ifund_super_admin_private_document_reviewed_queue')return review;if(name==='ifund_super_admin_account_deletion_queue')return requests;if(name==='ifund_super_admin_private_document_inventory')return rows;throw Error('Unexpected RPC');};
 const resolveReceipt=async({documentId,ownerId,jwt})=>{assert.equal(jwt,'admin-jwt');assert.match(documentId,/^[0-9a-f-]{36}$/);assert.equal(ownerId,owner);return typeof proof==='function'?proof(documentId):proof;};
 return {calls,run:()=>reviewedR2Inventory({requestId,jwt:'admin-jwt',rpc,resolveReceipt})};
}
test('authenticated queue and immutable receipt permit verified row absent verified_at in inventory',async()=>{
 const s=setup();assert.equal((await s.run()).length,1);
 assert.deepEqual(s.calls.map(x=>x.name),['ifund_super_admin_private_document_reviewed_queue','ifund_super_admin_account_deletion_queue','ifund_super_admin_private_document_inventory']);
});
test('review approval alone without account deletion owner binding denies',async()=>{await assert.rejects(setup({requests:[]}).run());});
test('duplicate deletion request identities deny',async()=>{const r={request_id:requestId,request_status:'reviewing',requested_user_id:owner};await assert.rejects(setup({requests:[r,r]}).run());});
test('foreign owner in authenticated queue denies',async()=>{await assert.rejects(setup({requests:[{request_id:requestId,request_status:'reviewing',requested_user_id:foreign}]}).run());});
test('missing immutable receipt denies',async()=>{await assert.rejects(setup({proof:null}).run());});
test('receipt without verified timestamp denies',async()=>{await assert.rejects(setup({proof:{...receipt,object_verified_at:undefined}}).run());});
test('receipt with mismatched etag denies',async()=>{await assert.rejects(setup({proof:{...receipt,object_etag:'"different"'}}).run());});
test('cross-owner storage path denies entire batch',async()=>{await assert.rejects(setup({rows:[{...row,storage_path:row.storage_path.replace(owner,foreign)}]}).run());});
test('unreviewed request never reads deletion or inventory queues',async()=>{const s=setup({review:[]});await assert.rejects(s.run());assert.equal(s.calls.length,1);});
test('more than ten inventory rows deny',async()=>{await assert.rejects(setup({rows:Array(101).fill(row)}).run());});
test('duplicate document identities deny',async()=>{await assert.rejects(setup({rows:[row,row]}).run());});
test('ten-document batch returns all ten without mutating R2',async()=>{
 const rows=Array.from({length:10},(_,i)=>{
  const id='44444444-4444-4444-8444-'+String(i+1).padStart(12,'0');
  return {...row,document_id:id,storage_path:row.storage_path.replace(documentId,id)};
 });
 const s=setup({rows,proof:id=>({...receipt,id,storage_path:rows.find(r=>r.document_id===id).storage_path})});
 const result=await s.run();assert.equal(result.length,10);
 assert.equal(result[9].document_id,rows[9].document_id);
});
