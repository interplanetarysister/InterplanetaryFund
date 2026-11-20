import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canAskAgentWithSavedPermission } from "../src/lib/agentAdvisoryPermission.mjs";

const ownerId="11111111-1111-4111-8111-111111111111";
const user={id:ownerId,email_confirmed_at:"2026-11-19T12:00:00Z",is_anonymous:false};
const enabled={owner_id:ownerId,allow_ai_campaign_drafts:true,allow_ai_outreach_drafts:true,allow_future_internal_ai_assistance:true};
const eligible=(identity=user,prefs=enabled)=>canAskAgentWithSavedPermission({user:identity,ownerId,preferences:prefs});

test("agent availability mirrors one AI switch, never a partial legacy grant",()=>{
  assert.equal(eligible(),true);
  for (const field of ["allow_ai_campaign_drafts","allow_ai_outreach_drafts","allow_future_internal_ai_assistance"])
    assert.equal(eligible(user,{...enabled,[field]:false}),false,field);
});
test("agent availability is account-scoped and fails closed on unverified identity",()=>{
  assert.equal(eligible({...user,is_anonymous:true}),false);
  assert.equal(eligible({...user,email_confirmed_at:null}),false);
  assert.equal(eligible(user,{...enabled,owner_id:"22222222-2222-4222-8222-222222222222"}),false);
  assert.equal(canAskAgentWithSavedPermission({user,ownerId:"33333333-3333-4333-8333-333333333333",preferences:enabled}),false);
});
test("agent team checks verified owner and all AI flags",()=>{
  const source=readFileSync(new URL("../src/pages/AgentsTeam.jsx",import.meta.url),"utf8");
  assert.match(source,/\.select\("owner_id,allow_ai_campaign_drafts,allow_ai_outreach_drafts,allow_future_internal_ai_assistance"\)/);
  assert.match(source,/\.eq\("owner_id",owner\)\.maybeSingle\(\)/);
  assert.match(source,/canAskAgentWithSavedPermission\(/);
  assert.match(source,/!membershipActive \|\| !aiPermissionGranted/);
});
