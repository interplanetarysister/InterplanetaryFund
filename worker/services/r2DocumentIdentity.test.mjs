import test from "node:test";
import assert from "node:assert/strict";
import {documentObjectKey,verifyDocumentIdentity,verifyR2Head,verifyR2Absence,boundedDocumentBatch} from "./r2DocumentIdentity.mjs";
const owner="11111111-1111-4111-8111-111111111111";
const other="22222222-2222-4222-8222-222222222222";
const campaign="33333333-3333-4333-8333-333333333333";
const id="44444444-4444-4444-8444-444444444444";
const sha="a".repeat(64);
const key=documentObjectKey({ownerId:owner,campaignId:campaign,documentId:id,extension:"pdf"});
const row={document_id:id,campaign_id:campaign,storage_path:key,object_etag:'"etag"',object_sha256:sha,object_verified_at:"2026-11-20T00:00:00Z",file_size:123};
test("exact owner R2 metadata receipt",()=>{
 const receipt=verifyDocumentIdentity(row,owner);
 assert.equal(receipt.key,key);
 assert.equal(verifyR2Head(receipt,{httpEtag:'"etag"',size:123,checksums:{sha256:sha}}),true);
 assert.equal(verifyR2Absence(null),true);
});
test("cross-owner and forged metadata denied",()=>{
 for(const mutation of [{storage_path:key.replace(owner,other)},{document_id:other},{campaign_id:other},{object_sha256:"bad"},{object_etag:""},{object_verified_at:null},{file_size:-1}])
  assert.throws(()=>verifyDocumentIdentity({...row,...mutation},owner));
 assert.throws(()=>verifyDocumentIdentity(row,other));
});
test("R2 changed or ambiguous objects fail closed",()=>{
 const receipt=verifyDocumentIdentity(row,owner);
 for(const head of [undefined,null,{}, {httpEtag:'"different"',size:123,checksums:{sha256:sha}},{httpEtag:'"etag"',size:124,checksums:{sha256:sha}},{httpEtag:'"etag"',size:123,checksums:{sha256:"b".repeat(64)}}])
  assert.throws(()=>verifyR2Head(receipt,head));
 for(const head of [undefined,{},false,{status:404}])assert.throws(()=>verifyR2Absence(head));
});
test("bounded deletion never processes more than ten",()=>{
 assert.equal(boundedDocumentBatch(Array.from({length:100},(_,i)=>i)).length,10);
 assert.throws(()=>boundedDocumentBatch(Array.from({length:101},(_,i)=>i)));
 assert.throws(()=>boundedDocumentBatch({}));
});
