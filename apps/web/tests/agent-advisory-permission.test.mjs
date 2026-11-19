import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canAskAgentWithSavedPermission } from "../src/lib/agentAdvisoryPermission.mjs";

const ownerId="11111111-1111-4111-8111-111111111111";
const user={id:ownerId,email_confirmed_at:"2026-11-19T12:00:00Z",is_anonymous:false};
const base={owner_id:ownerId,allow_ai_campaign_drafts:false,allow_future_internal_ai_assistance:false};
const eligible=(identity=user,prefs=base)=>canAskAgentWithSavedPermission({user:identity,ownerId,preferences:prefs});

test("Agent Team preflight accepts either owner-scoped saved advisory grant",()=>{
  assert.equal(eligible(user,{...base,allow_ai_campaign_drafts:true}),true);
  assert.equal(eligible(user,{...base,allow_future_internal_ai_assistance:true}),true);
  assert.equal(eligible(user,{...base,allow_ai_campaign_drafts:true,allow_future_internal_ai_assistance:true}),true);
});

test("Agent Team preflight denies revoked, foreign, anonymous or unverified grants",()=>{
  assert.equal(eligible(),false);
  assert.equal(eligible(user,{...base,owner_id:"22222222-2222-4222-8222-222222222222",allow_future_internal_ai_assistance:true}),false);
  assert.equal(eligible({...user,email_confirmed_at:null},{...base,allow_ai_campaign_drafts:true}),false);
  assert.equal(eligible({...user,is_anonymous:true},{...base,allow_future_internal_ai_assistance:true}),false);
  assert.equal(canAskAgentWithSavedPermission({user,ownerId:"33333333-3333-4333-8333-333333333333",preferences:{...base,allow_ai_campaign_drafts:true}}),false);
  assert.equal(eligible(user,{...base,allow_ai_campaign_drafts:"true",allow_future_internal_ai_assistance:"true"}),false);
});

test("Agent Team UI checks verified owner consent and links to its revocation settings",()=>{
  const source=readFileSync(new URL("../src/pages/AgentsTeam.jsx",import.meta.url),"utf8");
  assert.match(source,/\.select\("owner_id,allow_ai_campaign_drafts,allow_future_internal_ai_assistance"\)/);
  assert.match(source,/\.eq\("owner_id",owner\)\.maybeSingle\(\)/);
  assert.match(source,/canAskAgentWithSavedPermission\(/);
  assert.match(source,/\!membershipActive \|\| \!aiPermissionGranted/);
  assert.match(source,/to="\/permissions\?section=ai"/);
  assert.match(source,/No question was sent/);
  assert.match(source,/private AI assistance permission/);
});
