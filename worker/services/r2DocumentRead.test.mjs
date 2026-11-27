import test from "node:test";
import assert from "node:assert/strict";
import { requireCampaignR2, normalizeR2Head, verifiedPrivateDocumentHead, verifiedPrivateDocumentRead } from "./r2DocumentRead.mjs";

const owner = "11111111-1111-4111-8111-111111111111";
const campaign = "22222222-2222-4222-8222-222222222222";
const doc = "33333333-3333-4333-8333-333333333333";
const sha = "ab".repeat(32);
const key = `private/campaign-documents/${owner}/${campaign}/${doc}.pdf`;
const row = { document_id:doc, campaign_id:campaign, storage_path:key, object_store:"r2", owner_id:owner, object_etag:'"receipt"', object_sha256:sha, object_verified_at:"2026-11-20T00:00:00Z", file_size:5 };
const head = { httpEtag:'"receipt"', size:5, checksums:{sha256:sha} };
test("R2 binding is mandatory",()=>assert.throws(()=>requireCampaignR2({})));
test("ArrayBuffer SHA256 is normalized to hex",()=>{
 const bytes = Uint8Array.from({length:32},()=>0xab);
 assert.equal(normalizeR2Head({...head,checksums:{sha256:bytes.buffer}}).checksums.sha256,sha);
});
test("matching owner and immutable receipt permits HEAD/read",async()=>{
 const env={IFUND_CAMPAIGN_MEDIA:{head:async()=>head,get:async()=>({...head,body:"bytes"})}};
 assert.equal((await verifiedPrivateDocumentHead({env,row,ownerId:owner})).key,key);
 assert.equal((await verifiedPrivateDocumentRead({env,row,ownerId:owner})).body,"bytes");
});
test("cross-owner, missing HEAD, forged receipt and changed GET fail closed",async()=>{
 const env={IFUND_CAMPAIGN_MEDIA:{head:async()=>head,get:async()=>({...head,size:6,body:"bytes"})}};
 await assert.rejects(verifiedPrivateDocumentHead({env,row,ownerId:campaign}));
 await assert.rejects(verifiedPrivateDocumentRead({env,row,ownerId:owner}));
 await assert.rejects(verifiedPrivateDocumentHead({env:{IFUND_CAMPAIGN_MEDIA:{head:async()=>null,get:async()=>null}},row,ownerId:owner}));
 await assert.rejects(verifiedPrivateDocumentHead({env,row:{...row,object_sha256:"cd".repeat(32)},ownerId:owner}));
});
