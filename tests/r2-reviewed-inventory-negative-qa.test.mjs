import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewedR2Inventory } from '../worker/services/r2ReviewedInventory.mjs';

const requestId='11111111-1111-4111-8111-111111111111';
const ownerId='22222222-2222-4222-8222-222222222222';
const campaignId='33333333-3333-4333-8333-333333333333';
const documentId='44444444-4444-4444-8444-444444444444';
const timestamp='2026-11-20T00:00:00.000Z';
const row={document_id:documentId,campaign_id:campaignId,
 storage_path:`private/campaign-documents/${ownerId}/${campaignId}/${documentId}.txt`,
 deletion_requested_at:timestamp,object_etag:'"etag"',object_sha256:'a'.repeat(64),
 file_size:12,media_type:'text/plain'};
const receipt={...row,id:documentId,owner_id:ownerId,object_store:'r2',
 allow_agent_use:false,object_verified_at:timestamp};
function harness({mutateRow=x=>x,mutateReceipt=x=>x,queueReady=true,owner=ownerId}={}){
 const calls=[];
 const rpc=async(name,args,jwt)=>{
  calls.push({name,args,jwt});
  if(name==='ifund_super_admin_private_document_reviewed_queue')
   return [{request_id:requestId,review_ready:queueReady}];
  if(name==='ifund_super_admin_account_deletion_queue')
   return [{request_id:requestId,request_status:'reviewing',requested_user_id:owner}];
  if(name==='ifund_super_admin_private_document_inventory')return [mutateRow({...row})];
  throw Error('Unexpected RPC');
 };
 const resolveReceipt=async()=>mutateReceipt({...receipt});
 return {calls,run:()=>reviewedR2Inventory({requestId,jwt:'synthetic-admin-jwt',rpc,resolveReceipt})};
}
test('reviewed queue and owner-matched immutable R2 receipt admit bounded inventory',async()=>{
 const h=harness();const result=await h.run();
 assert.equal(result.length,1);
 assert.equal(result[0].document_id,documentId);
 assert.deepEqual(h.calls.map(x=>x.name),[
 'ifund_super_admin_private_document_reviewed_queue',
 'ifund_super_admin_account_deletion_queue',
 'ifund_super_admin_private_document_inventory']);
 assert.ok(h.calls.every(x=>x.jwt==='synthetic-admin-jwt'));
});
for(const [name,options] of [
 ['unreviewed queue',{queueReady:false}],
 ['swapped owner',{owner:'55555555-5555-4555-8555-555555555555'}],
 ['non-R2 receipt',{mutateReceipt:r=>({...r,object_store:'supabase'})}],
 ['forged media type',{mutateReceipt:r=>({...r,media_type:'application/pdf'})}],
 ['forged etag',{mutateReceipt:r=>({...r,object_etag:'"different"'})}],
 ['forged sha256',{mutateReceipt:r=>({...r,object_sha256:'b'.repeat(64)})}],
 ['forged campaign',{mutateReceipt:r=>({...r,campaign_id:'66666666-6666-4666-8666-666666666666'})}],
 ['stale deletion timestamp',{mutateReceipt:r=>({...r,deletion_requested_at:'2026-11-19T00:00:00.000Z'})}],
 ['agent consent not revoked',{mutateReceipt:r=>({...r,allow_agent_use:true})}],
 ['swapped document path',{mutateReceipt:r=>({...r,storage_path:'private/campaign-documents/invalid'})}],
 ['forged file size',{mutateReceipt:r=>({...r,file_size:13})}]
])test('fail closed: '+name,async()=>{await assert.rejects(harness(options).run());});
