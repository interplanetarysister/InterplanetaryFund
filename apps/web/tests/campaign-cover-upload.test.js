import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCoverFile, uploadCampaignCover, isVerifiedCoverOwner, MAX_COVER_BYTES } from '../src/api/campaignCovers.js';
import { uploadCampaignCover as canonicalUpload } from '../src/api/campaignMedia.js';
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const origin='https://interplanetaryfund.com';
const file=new File([new Uint8Array([137,80,78,71,13,10,26,10])],'cover.png',{type:'image/png'});
const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
const receipt={url:origin+'/api/media/campaign/file/'+id+'.png',content_type:'image/png',bytes:file.size,sha256:digest};
function clientFor(user={id:owner,email_confirmed_at:'2026-11-16',is_anonymous:false}) {
 return {auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),getUser:async()=>({data:{user}}),getSession:async()=>({data:{session:{user,access_token:'synthetic-token'}}})},
  from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{account_status:'active',account_deletion_pending:false}})}),
  get storage(){assert.fail('New covers must not use Supabase Storage');}};
}
test('image studio compatibility entrypoint uses the same canonical R2 uploader',()=>assert.equal(uploadCampaignCover,canonicalUpload));
test('rejects unsafe and oversized cover files before contacting storage',()=>{
 assert.match(validateCoverFile({size:MAX_COVER_BYTES+1,type:'image/png'}),/smaller than 5 MB/);
 assert.match(validateCoverFile({size:1024,type:'image/svg+xml'}),/JPG, PNG/);
 assert.match(validateCoverFile({size:0,type:'image/jpeg'}),/smaller than 5 MB/);
 assert.equal(validateCoverFile(file),'');
});
test('only a verified owner can request a canonical image upload',async()=>{
 const user={id:owner,is_anonymous:true};assert.equal(isVerifiedCoverOwner(user),false);
 await assert.rejects(uploadCampaignCover(clientFor(user),file,{origin,fetcher:()=>assert.fail('unverified upload')}),/confirmed/);
});
test('verified uploader attaches only its own digest-checked opaque public receipt',async()=>{
 const client=clientFor();let calls=0;
 const url=await uploadCampaignCover(client,file,{origin,fetcher:async(path,init)=>{calls++;assert.equal(path,'/api/media/campaign/upload');assert.equal(init.body,file);assert.equal(init.headers.authorization,'Bearer synthetic-token');return Response.json(receipt,{status:201});}});
 assert.equal(calls,1);assert.equal(url,receipt.url);assert.ok(!url.includes(owner));
});
test('storage errors and forged image receipts never become successful uploads',async()=>{
 await assert.rejects(uploadCampaignCover(clientFor(),file,{origin,fetcher:async()=>Response.json({error:'Media unavailable'},{status:503})}),/unavailable/);
 for(const patch of [{url:'https://evil.example/image.png'},{url:'https://attacker@interplanetaryfund.com/api/media/campaign/file/'+id+'.png'},
  {url:receipt.url+'?redirect=evil'},{url:origin+'/api/media/campaign/file/other.png'},{sha256:'a'.repeat(64)},{bytes:file.size+1}]) {
  await assert.rejects(uploadCampaignCover(clientFor(),file,{origin,fetcher:async()=>Response.json({...receipt,...patch},{status:201})}),/verified image link/);
 }
});
test('composer locks save/publish during upload and guests retain only local drafts',()=>{
 const src=readFileSync(new URL('../src/pages/CreateCampaign.jsx',import.meta.url),'utf8');
 assert.match(src,/coverUploading \|\| handoffBusy/);assert.match(src,/await uploadCampaignCover\(authClient\(\), file\)/);assert.match(src,/applyCampaignFields\(\{cover_image_url:coverImageUrl\(url\),cover_image_is_ai:false\}\)/);
 assert.match(src,/user\.is_anonymous === true \|\| !user\.email_confirmed_at/);assert.match(src,/rememberBrowserCampaign\(sessionStorage, null, form/);
});
