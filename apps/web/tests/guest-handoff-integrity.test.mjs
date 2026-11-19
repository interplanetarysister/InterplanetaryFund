import test from "node:test";
import assert from "node:assert/strict";
import { importGuestCampaign, rememberBrowserCampaign, restoreBrowserCampaign } from "../src/lib/browserCampaignDraft.js";
import { emptyCampaignForm } from "../src/lib/campaignLifecycle.js";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const ownerKey = "ifund-guest-campaign-v1:owner:" + owner;
const guestKey = "ifund-guest-campaign-v1:guest";
const form = { ...emptyCampaignForm(), title: "Private guest campaign" };
function memory() {
  const records = new Map();
  return {
    getItem: key => records.get(key) ?? null,
    setItem: (key,value) => { records.set(key,value); },
    removeItem: key => { records.delete(key); },
  };
}
test("silent owner-write failure retains guest data and never claims successful import", () => {
  const s=memory(); rememberBrowserCampaign(s,null,form);
  const broken={...s,setItem(key,value) { if(key!==ownerKey)s.setItem(key,value); }};
  assert.deepEqual(importGuestCampaign(broken,owner),{status:"write_failed"});
  assert.equal(s.getItem(ownerKey),null);
  assert.equal(restoreBrowserCampaign(s,null).title,form.title);
});
test("silent guest delete failure reports retained private copy and supports explicit retry",()=>{
  const s=memory();rememberBrowserCampaign(s,null,form);
  const broken={...s,removeItem(key) {if(key!==guestKey)s.removeItem(key);}};
  assert.deepEqual(importGuestCampaign(broken,owner),{status:"imported_guest_retained"});
  assert.equal(restoreBrowserCampaign(s,owner).title,form.title);
  assert.equal(restoreBrowserCampaign(s,null).title,form.title);
  assert.deepEqual(importGuestCampaign(s,owner),{status:"imported"});
  assert.equal(s.getItem(guestKey),null);
  assert.equal(restoreBrowserCampaign(s,owner).title,form.title);
});
test("changed owner data blocks retry without deleting the retained guest",()=>{
  const s=memory();rememberBrowserCampaign(s,null,form);
  const broken={...s,removeItem(){}};
  assert.deepEqual(importGuestCampaign(broken,owner),{status:"imported_guest_retained"});
  const edited={...form,title:"Edited by owner"};
  assert.equal(rememberBrowserCampaign(s,owner,edited),true);
  assert.deepEqual(importGuestCampaign(s,owner),{status:"owner_exists"});
  assert.equal(restoreBrowserCampaign(s,null).title,form.title);
  assert.equal(restoreBrowserCampaign(s,owner).title,edited.title);
  assert.deepEqual(restoreBrowserCampaign(s,other),emptyCampaignForm());
});
