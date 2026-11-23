import test from 'node:test';
import assert from 'node:assert/strict';
import { createR2ErasureAdapter } from '../worker/services/r2ErasureAdapter.mjs';
const ownerId='11111111-1111-4111-8111-111111111111';
const documentId='22222222-2222-4222-8222-222222222222';
const campaignId='33333333-3333-4333-8333-333333333333';
const storage_path=`private/campaign-documents/${ownerId}/${campaignId}/${documentId}.pdf`;
const receipt={id:documentId,owner_id:ownerId,campaign_id:campaignId,storage_path,object_store:'r2',object_etag:'"v1"',object_sha256:'a'.repeat(64),object_verified_at:'2026-11-22T00:00:00Z',file_size:8,allow_agent_use:false,deletion_requested_at:'2026-11-22T00:00:00Z'};
const fence=()=>({document_id:documentId,owner_id:ownerId,fence_id:'44444444-4444-4444-8444-444444444444',version:1,state:'deleting',writers_blocked:true,object_etag:receipt.object_etag,object_sha256:receipt.object_sha256,storage_path,expires_at:new Date(Date.now()+120000).toISOString()});
const head={httpEtag:receipt.object_etag,size:8,checksums:{sha256:receipt.object_sha256}};
function setup({fenceOverride={},receiptOverride={},headOverride=head,deleteResult=true,finalResult=true}={}){
 const calls=[];let removed=false;
 const bucket={head:async()=>{calls.push('head');return removed?null:headOverride;},deleteIfMatch:async(key,etag,token)=>{calls.push('delete');assert.equal(key,storage_path);assert.equal(etag,receipt.object_etag);assert.equal(token.version,1);if(deleteResult)removed=true;return deleteResult;}};
 const erase=createR2ErasureAdapter({bucket,resolveReceipt:async()=>({...receipt,...receiptOverride}),lock:async(_ids,fn)=>fn({...fence(),...fenceOverride}),finalize:async arg=>{calls.push('finalize');assert.equal(arg.fenceId,fence().fence_id);return finalResult;}});
 return {calls,erase:()=>erase({documentId,ownerId,jwt:'synthetic.jwt'})};
}
test('verified fenced conditional deletion finalizes after HEAD absence',async()=>{const s=setup();assert.deepEqual(await s.erase(),{documentId,objectAbsent:true,metadataRemoved:true,accountDeleted:false});assert.deepEqual(s.calls,['head','delete','head','finalize']);});
for(const [label,options] of Object.entries({crossOwner:{fenceOverride:{owner_id:campaignId}},unblocked:{fenceOverride:{writers_blocked:false}},expired:{fenceOverride:{expires_at:'2020-01-01T00:00:00Z'}},replacedReceipt:{receiptOverride:{object_etag:'"v2"'}},missingConsent:{receiptOverride:{allow_agent_use:true}},wrongHead:{headOverride:{...head,httpEtag:'"v2"'}}}))test('fails closed before delete: '+label,async()=>{const s=setup(options);await assert.rejects(s.erase());assert.equal(s.calls.includes('delete'),false);});
test('failed conditional delete does not finalize',async()=>{const s=setup({deleteResult:false});await assert.rejects(s.erase());assert.equal(s.calls.includes('finalize'),false);});
test('failed immutable metadata CAS does not claim success',async()=>{const s=setup({finalResult:false});await assert.rejects(s.erase());});
test('standard R2 bucket with only delete() is rejected',()=>assert.throws(()=>createR2ErasureAdapter({bucket:{head:async()=>null,delete:async()=>{}},resolveReceipt:()=>{},lock:()=>{},finalize:()=>{}}),/dependencies unavailable/));
