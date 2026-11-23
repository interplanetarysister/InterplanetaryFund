import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticatedDocumentReceiptResolver } from './r2DocumentReceiptResolver.mjs';

const owner='11111111-1111-4111-8111-111111111111';
const other='22222222-2222-4222-8222-222222222222';
const campaign='33333333-3333-4333-8333-333333333333';
const documentId='44444444-4444-4444-8444-444444444444';
const jwt='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature';
const storage_path=`private/campaign-documents/${owner}/${campaign}/${documentId}.pdf`;
const receipt=()=>({id:documentId,owner_id:owner,campaign_id:campaign,object_store:'r2',storage_path,object_etag:'synthetic-etag',object_sha256:'a'.repeat(64),object_verified_at:'2026-11-19T22:00:00Z',file_size:100,media_type:'application/pdf'});
const request={documentId,ownerId:owner,jwt};

test('returns a frozen, exact owner receipt and passes token to trusted RPC',async()=>{
 let seen;
 const resolve=createAuthenticatedDocumentReceiptResolver({rpc:async(...args)=>{seen=args;return [receipt()]}});
 const result=await resolve(request);
 assert.equal(result.storage_path,storage_path);
 assert.equal(Object.isFrozen(result),true);
 assert.deepEqual(seen,['ifund_super_admin_private_document_receipt',{p_document_id:documentId,p_owner_id:owner},jwt]);
});

test('rejects malformed identity and token without invoking RPC',async()=>{
 let calls=0;
 const resolve=createAuthenticatedDocumentReceiptResolver({rpc:async()=>{calls++;return [receipt()]}});
 for(const args of [{...request,ownerId:'invalid'},{...request,documentId:'invalid'},{...request,jwt:'bad-token'},{...request,jwt:''}])
  await assert.rejects(resolve(args),/Invalid receipt identity/);
 assert.equal(calls,0);
});

test('rejects missing, duplicate, cross-owner, altered and malformed receipts',async()=>{
 const cases=[
  [],[receipt(),receipt()],
  [{...receipt(),owner_id:other}],
  [{...receipt(),storage_path:storage_path+'/extra'}],
  [{...receipt(),storage_path:storage_path.replace('/'+owner+'/','/'+other+'/')}],
  [{...receipt(),storage_path:storage_path.replace('.pdf','.exe')}],
  [{...receipt(),object_store:'supabase'}],
  [{...receipt(),object_sha256:'bad'}],
  [{...receipt(),object_etag:''}],
  [{...receipt(),object_verified_at:'not-a-date'}],
  [{...receipt(),file_size:-1}],
  [{...receipt(),campaign_id:other}],
 ];
 for(const rows of cases){
  const resolve=createAuthenticatedDocumentReceiptResolver({rpc:async()=>rows});
  await assert.rejects(resolve(request),/Receipt unavailable or ambiguous|Immutable receipt is invalid/);
 }
});

test('fails closed when trusted receipt RPC rejects authorization',async()=>{
 const resolve=createAuthenticatedDocumentReceiptResolver({rpc:async()=>{throw Error('permission denied')}});
 await assert.rejects(resolve(request),/permission denied/);
});
