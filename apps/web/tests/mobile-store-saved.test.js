import test from "node:test";
import assert from "node:assert/strict";
import { savedCampaignIds,setCampaignSaved,clearSavedCampaigns } from "../src/mobile/savedCampaigns.js";

const id1="11111111-1111-4111-8111-111111111111";
const id2="22222222-2222-4222-8222-222222222222";
function memoryStore(){
  const items=new Map();
  return {
    getItem:key=>items.get(key)||null,
    setItem:(key,value)=>items.set(key,value),
    removeItem:key=>items.delete(key),
    entries:()=>[...items],
  };
}
test("mobile saved campaigns store only deduplicated UUID links",()=>{
  const storage=memoryStore();
  assert.deepEqual(savedCampaignIds(storage),[]);
  assert.equal(setCampaignSaved(id1,true,storage),true);
  assert.equal(setCampaignSaved(id1,true,storage),true);
  assert.equal(setCampaignSaved(id2,true,storage),true);
  assert.deepEqual(savedCampaignIds(storage),[id1,id2]);
  assert.equal(setCampaignSaved(id1,false,storage),false);
  assert.deepEqual(savedCampaignIds(storage),[id2]);
  assert.doesNotMatch(JSON.stringify(storage.entries()),/story|financial|access_token|email/i);
  clearSavedCampaigns(storage);
  assert.deepEqual(savedCampaignIds(storage),[]);
});
test("mobile bookmark IDs and local data are bounded",()=>{
  const storage=memoryStore();
  assert.throws(()=>setCampaignSaved("not-a-uuid",true,storage),TypeError);
  storage.setItem("ifund-mobile-saved-campaign-ids",JSON.stringify(["bad",id1,id1,id2]));
  assert.deepEqual(savedCampaignIds(storage),[id1,id2]);
});
test("offline WebView privacy or unavailable local storage is handled without crashing reads",()=>{
  const locked={getItem(){throw new Error("SecurityError");},
    setItem(){throw new Error("QuotaExceededError");},
    removeItem(){throw new Error("SecurityError");}};
  assert.deepEqual(savedCampaignIds(locked),[]);
  assert.deepEqual(savedCampaignIds(null),[]);
  assert.throws(()=>setCampaignSaved(id1,true,locked),/QuotaExceededError/);
  assert.throws(()=>setCampaignSaved(id1,true,null),/unavailable on this device/);
  assert.throws(()=>clearSavedCampaigns(null),/unavailable on this device/);
});
