import test from "node:test";
import assert from "node:assert/strict";
import { rememberSignupAIChoices, finalizeSignupAIChoices, SIGNUP_AI_CHOICES_KEY } from "../src/lib/signupAIPreferences.js";

const user = { id: "11111111-1111-4111-8111-111111111111", email: "member@example.com", email_confirmed_at: "2026-11-15" };
function storage() {
  const m = new Map();
  return {getItem:key=>m.get(key)||null,setItem:(k,v)=>m.set(k,v),removeItem:key=>m.delete(key)};
}
function mockClient(initial = null) {
  let saved = initial, writes = 0;
  return {
    get writes() {return writes;},
    get saved() {return saved;},
    from(table) {
      assert.equal(table,"ifund_ai_permission_preferences");
      return {
        select() {
          return {eq() {return {async maybeSingle(){return {data:saved,error:null}}}}};
        },
        upsert(row,options) {
          assert.equal(options.onConflict,"owner_id");
          assert.equal(options.ignoreDuplicates,true);
          writes++;
          if(!saved)saved=row;
          return {select() {return {async maybeSingle(){return {data:saved && {owner_id:saved.owner_id},error:null}}}}};
        },
      };
    },
  };
}
test("explicit same-email signup preferences are saved only after verification",async()=>{
  const s=storage(),c=mockClient();
  rememberSignupAIChoices(s,"MEMBER@example.com",{allow_ai_campaign_drafts:true,allow_ai_outreach_drafts:false,interested_in_future_automation:true},1000);
  assert.equal(await finalizeSignupAIChoices(c,user,s,2000),true);
  assert.equal(c.writes,1);
  assert.equal(c.saved.allow_ai_campaign_drafts,true);
  assert.equal(c.saved.allow_ai_outreach_drafts,false);
  assert.equal(c.saved.interested_in_future_automation,true);
  assert.equal(c.saved.default_action,"ask");
  assert.equal(s.getItem(SIGNUP_AI_CHOICES_KEY),null);
});
test("missing, anonymous, unverified, stale and mismatched signup cannot authorize AI",async()=>{
  for(const invalid of [
    {...user,email:"other@example.com"},
    {...user,email_confirmed_at:null},
    {...user,is_anonymous:true},
  ]) {
    const s=storage(),c=mockClient();
    rememberSignupAIChoices(s,user.email,{allow_ai_campaign_drafts:true},1000);
    assert.equal(await finalizeSignupAIChoices(c,invalid,s,2000),false);
    assert.equal(c.writes,0);
  }
  const s=storage(),c=mockClient();
  rememberSignupAIChoices(s,user.email,{allow_ai_campaign_drafts:true},1000);
  assert.equal(await finalizeSignupAIChoices(c,user,s,86401001),false);
  assert.equal(c.writes,0);
});
test("signup callback cannot overwrite a preference already changed by owner",async()=>{
  const existing={owner_id:user.id,allow_ai_campaign_drafts:false};
  const s=storage(),c=mockClient(existing);
  rememberSignupAIChoices(s,user.email,{allow_ai_campaign_drafts:true},1000);
  assert.equal(await finalizeSignupAIChoices(c,user,s,2000),true);
  assert.equal(c.writes,0);
  assert.equal(c.saved.allow_ai_campaign_drafts,false);
});
