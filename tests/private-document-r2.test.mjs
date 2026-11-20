import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalDocumentKey,removeVerifiedR2Document} from '../worker/services/privateDocumentR2.mjs';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',campaign='33333333-3333-4333-8333-333333333333',id='44444444-4444-4444-8444-444444444444';
const row={document_id:id,campaign_id:campaign,storage_path:`private/campaign-documents/${owner}/${campaign}/${id}.pdf`,object_etag:'a'.repeat(32),object_sha256:'b'.repeat(64),object_verified_at:'2026-11-19T00:00:00Z',file_size:42};
function bucket(overrides={}){let present=true,deleted=0;return {get deleted(){return deleted},head:async()=>present?{etag:'a'.repeat(32),size:42,customMetadata:{sha256:'b'.repeat(64)}}:null,delete:async()=>{deleted++;present=false},...overrides};}
test('canonical owner key',()=>assert.equal(canonicalDocumentKey(row,owner),row.storage_path));
test('cross owner denied',()=>assert.throws(()=>canonicalDocumentKey(row,other)));
test('path traversal denied',()=>assert.throws(()=>canonicalDocumentKey({...row,storage_path:row.storage_path+'../x'},owner)));
test('missing sha denied',()=>assert.throws(()=>canonicalDocumentKey({...row,object_sha256:null},owner)));
test('binding absent denied',async()=>assert.rejects(removeVerifiedR2Document({row,owner,bucket:null})));
test('verified receipt and HEAD absence',async()=>{const b=bucket();assert.equal((await removeVerifiedR2Document({bucket:b,row,owner})).absent,true);assert.equal(b.deleted,1)});
test('etag mismatch denies deletion',async()=>{const b=bucket({head:async()=>({etag:'c'.repeat(32),size:42,customMetadata:{sha256:'b'.repeat(64)}})});await assert.rejects(removeVerifiedR2Document({bucket:b,row,owner}));assert.equal(b.deleted,0)});
test('missing SHA metadata denies deletion',async()=>{const b=bucket({head:async()=>({etag:'a'.repeat(32),size:42,customMetadata:{}})});await assert.rejects(removeVerifiedR2Document({bucket:b,row,owner}));assert.equal(b.deleted,0)});
test('size mismatch denies deletion',async()=>{const b=bucket({head:async()=>({etag:'a'.repeat(32),size:43,customMetadata:{sha256:'b'.repeat(64)}})});await assert.rejects(removeVerifiedR2Document({bucket:b,row,owner}));assert.equal(b.deleted,0)});
test('HEAD still present denies absence receipt',async()=>{const b=bucket({delete:async()=>{}});await assert.rejects(removeVerifiedR2Document({bucket:b,row,owner}))});
