import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");

test("original space-glass AuthLayout is reused for signup and password recovery",()=>{
 const original=read("components/AuthLayout.jsx");
 const register=read("pages/AuthPage.jsx");
 const recovery=read("pages/ResetPassword.jsx");
 assert.match(original,/deep-space/);
 assert.match(original,/glass-panel/);
 assert.match(original,/brand-gradient-text/);
 assert.match(original,/Interplanetary Fund · Member Access/);
 assert.match(register,/<AuthLayout/);
 assert.match(recovery,/<AuthLayout/);
});

test("both Home and sidebar use canonical Auth getUser, never hardcoded guest state",()=>{
 const hook=read("lib/useVerifiedUser.js");
 const verifier=read("lib/verifiedEmailUser.js");
 const home=read("pages/Home.jsx");
 const layout=read("components/Layout.jsx");
 assert.match(verifier,/auth\.getUser\(\)/);
 assert.match(verifier,/auth\.getSession\(\)/);
 assert.match(hook,/resolveVerifiedEmailUser/);
 assert.match(hook,/onAuthStateChange/);
 assert.match(hook,/SIGNED_OUT/);
 assert.match(home,/useVerifiedUser\(\)/);
 assert.match(layout,/useVerifiedUser\(\)/);
 assert.doesNotMatch(home,/const isAuthenticated = false/);
 assert.doesNotMatch(layout,/const user = null/);
 assert.match(layout,/app_metadata\?\.role/);
 assert.doesNotMatch(layout,/user_metadata\?\.role/);
});

test("after password sign-in, account and email confirmation are reverified",()=>{
 const login=read("pages/AuthPage.jsx");
 const post=read("lib/postLogin.js");
 assert.match(login,/landingAfterLogin/);
 assert.match(login,/signInWithPassword/);
 assert.match(post,/email_confirmed_at/);
 assert.match(post,/ifund_profiles/);
 assert.match(post,/onboarding/);
});

test("legacy OAuth or email fragments are diverted to explicit callback",()=>{
 const router=read("App.jsx");
 assert.match(router,/legacyAuthLandingRedirect\(window\.location\.href\)/);
 assert.match(router,/path="\/auth\/callback"/);
 const callback=read("pages/AuthCallback.jsx");
 assert.match(callback,/window\.history\.replaceState/);
 assert.match(callback,/completeAuthCallback/);
});
