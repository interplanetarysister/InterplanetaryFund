import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mayUseFutureInternalAI, isHighImpactAIAction } from "../src/lib/internalAIConsent.mjs";

const user={ id:"11111111-1111-4111-8111-111111111111",email_confirmed_at:"2026-11-19T10:00:00Z",is_anonymous:false };
const preferences={owner_id:user.id,allow_future_internal_ai_assistance:true};
const read=path=>readFileSync(new URL(path,import.meta.url),"utf8");

test("verified owner may use only explicitly allowed private AI features",()=>{
  for(const capability of ["draft","analysis","recommendation","summarize","refine"]){
    assert.equal(mayUseFutureInternalAI({user,preferences,capability}),true,capability);
  }
  for(const capability of ["publish","post","send","message","connect","external_access","payment","payout","withdraw","delegate","represent","delete","future_capability",""]){
    assert.equal(mayUseFutureInternalAI({user,preferences,capability}),false,capability);
  }
  assert.equal(isHighImpactAIAction("withdraw"),true);
});

test("revocation, unverified and different account deny future AI",()=>{
  assert.equal(mayUseFutureInternalAI({user,preferences:{...preferences,allow_future_internal_ai_assistance:false},capability:"draft"}),false);
  assert.equal(mayUseFutureInternalAI({user:{...user,email_confirmed_at:null},preferences,capability:"draft"}),false);
  assert.equal(mayUseFutureInternalAI({user:{...user,is_anonymous:true},preferences,capability:"draft"}),false);
  assert.equal(mayUseFutureInternalAI({user:{...user,id:"another"},preferences,capability:"draft"}),false);
});

test("signup discloses default and account permissions can revoke without third party grant",()=>{
  const signup=read("../src/pages/AuthPage.jsx");
  const setting=read("../src/components/permissions/AIPermissionPreferences.jsx");
  const onboarding=read("../src/pages/MemberOnboarding.jsx");
  const signupService=read("../src/lib/signupAIPreferences.js");
  const sql=read("../../../supabase/migrations/20261119110000_ifund_future_internal_ai_assistance_preference.sql");
  assert.match(signup,/allow_future_internal_ai_assistance:true/);
  assert.match(signup,/To decline any of these options, uncheck them before signup/);
  assert.match(signup,/financial actions.*separate authorization/);
  assert.match(setting,/uncheck the option here and select Save AI preferences/);
  assert.match(setting,/allow_future_internal_ai_assistance: false/);
  assert.match(onboarding,/To revoke either preference now or later/);
  assert.match(signupService,/"allow_future_internal_ai_assistance"/);
  assert.match(sql,/add column if not exists allow_future_internal_ai_assistance boolean not null default false/);
  assert.doesNotMatch(sql,/update\s+public\.ifund_ai_permission_preferences\s+set\s+allow_future_internal_ai_assistance\s*=\s*true/i);
});

test("social signup preserves the selected default and legal agreement only for matched verified identity",()=>{
  const signup=read("../src/pages/AuthPage.jsx");
  const oauthButtons=read("../src/components/auth/OAuthButtons.jsx");
  const callback=read("../src/pages/AuthCallback.jsx");
  assert.match(signup,/onBeforeStart=\{isRegister \?/);
  assert.match(signup,/rememberSignupAgreement\(sessionStorage, address\)/);
  assert.match(signup,/rememberSignupAIChoices\(sessionStorage, address, signupAIChoices\)/);
  assert.match(oauthButtons,/await onBeforeStart\?\.\(provider\)/);
  assert.match(callback,/finalizeSignupAgreement\(authClient\(\), user, sessionStorage\)/);
  assert.match(callback,/if \(accepted\) await finalizeSignupAIChoices/);
});
