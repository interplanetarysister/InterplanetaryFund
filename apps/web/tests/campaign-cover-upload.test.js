import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCoverFile, uploadCampaignCover, isVerifiedCoverOwner, MAX_COVER_BYTES, COVER_BUCKET } from "../src/api/campaignCovers.js";
import { isVerifiedEmailUser } from "../src/lib/verifiedEmailUser.js";
import { payoutIdentity } from "../src/lib/guestAccess.js";

const owner="11111111-1111-4111-8111-111111111111";
const fileId="22222222-2222-4222-8222-222222222222";
function clientFor(user={id:owner,email_confirmed_at:"2026-11-12T00:00:00Z",is_anonymous:false}) {
  const calls=[];
  const storage={
    upload:async(path,file,opts)=>{calls.push({kind:"upload",path,file,opts});return {data:{path}};},
    getPublicUrl:path=>({data:{publicUrl:"https://example.supabase.co/storage/v1/object/public/"+COVER_BUCKET+"/"+path}}),
  };
  const client={
    auth:{getUser:async()=>({data:{user}})},
    from:table=>{
      assert.equal(table,"ifund_profiles");
      return {select:cols=>({eq:(field,id)=>({
        maybeSingle:async()=>({data:{account_status:"active",account_deletion_pending:false},error:null}),
      })})};
    },
    storage:{from:bucket=>{assert.equal(bucket,COVER_BUCKET);return storage;}},
  };
  return {client,calls,storage};
}
test("rejects unsafe cover types and oversized files without network access",()=>{
  assert.match(validateCoverFile({size:MAX_COVER_BYTES+1,type:"image/png"}),/smaller than 5 MB/);
  assert.match(validateCoverFile({size:1024,type:"image/svg+xml"}),/JPG, PNG/);
  assert.match(validateCoverFile({size:0,type:"image/jpeg"}),/smaller than 5 MB/);
  assert.equal(validateCoverFile({size:2048,type:"image/webp"}),"");
});
test("owner upload requires verified email and account status",async()=>{
  const x=clientFor({id:owner,is_anonymous:true});
  await assert.rejects(uploadCampaignCover(x.client,{size:1024,type:"image/png"},{makeId:()=>fileId}),/confirmed email/);
  assert.equal(x.calls.length,0);
});
test("upload confirms owner-only path and the public URL before attaching",async()=>{
  const x=clientFor();
  const observed=await x.client.auth.getUser();
  assert.equal(isVerifiedEmailUser(observed.data.user),true,"email-confirmed user fixture");
  assert.equal(payoutIdentity(observed.data.user),true,"member payout identity fixture");
  assert.match(observed.data.user.id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.equal(isVerifiedCoverOwner(observed.data.user),true,"cover owner authorization fixture");
  const url=await uploadCampaignCover(x.client,{size:1024,type:"image/png"},{makeId:()=>fileId});
  assert.equal(x.calls.length,1);
  assert.equal(x.calls[0].path,owner+"/"+fileId+".png");
  assert.equal(x.calls[0].opts.upsert,false);
  assert.match(url,/storage\/v1\/object\/public\/ifund-campaign-covers/);
});
test("upload failure must not be reported as successful",async()=>{
  const x=clientFor();
  const observed=await x.client.auth.getUser();
  assert.equal(isVerifiedEmailUser(observed.data.user),true,"email-confirmed user fixture");
  assert.equal(payoutIdentity(observed.data.user),true,"member payout identity fixture");
  assert.match(observed.data.user.id,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.equal(isVerifiedCoverOwner(observed.data.user),true,"cover owner authorization fixture");
  x.storage.upload=async()=>({error:{message:"denied"},data:null});
  await assert.rejects(uploadCampaignCover(x.client,{size:1024,type:"image/png"},{makeId:()=>fileId}),/could not be uploaded/);
});
test("composer disables saving and publishing during upload and attaches returned URL",()=>{
  const src=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
  assert.match(src,/coverUploading \|\| handoffBusy/);
  assert.match(src,/await uploadCampaignCover\(authClient\(\), file\)/);
  assert.match(src,/change\("cover_image_url", url\)/);
  assert.match(src,/type="file"/);
  assert.match(src,/Save this draft or publish to attach/);
});

test("anonymous guest campaign saves remain browser-only instead of calling owner writes",()=>{
  const src=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
  assert.match(src,/user\.is_anonymous === true \|\| !user\.email_confirmed_at/);
  assert.match(src,/rememberBrowserCampaign\(sessionStorage, null, form/);
});
