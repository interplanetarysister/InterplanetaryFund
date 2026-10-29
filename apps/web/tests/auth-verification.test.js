import test from "node:test";
import assert from "node:assert/strict";
import {
  authCallbackUrl,callbackParameters,completeAuthCallback,strippedAuthCallbackLocation
} from "../src/lib/authCallback.js";
import {safeReturnTo} from "../src/lib/safeReturnTo.js";
import {landingAfterLogin} from "../src/lib/postLogin.js";
import {legacyAuthLandingRedirect} from "../src/lib/legacyAuthLanding.js";
import {readFileSync} from "node:fs";

test("confirmation and recovery use fixed first-party callback destinations",()=>{
  assert.equal(authCallbackUrl("https://interplanetaryfund.com"),
    "https://interplanetaryfund.com/auth/callback?next=/onboarding");
  assert.equal(authCallbackUrl("https://interplanetaryfund.com",{recovery:true}),
    "https://interplanetaryfund.com/auth/callback?next=/reset-password");
  assert.equal(strippedAuthCallbackLocation("https://interplanetaryfund.com"),"/auth/callback");
  assert.throws(()=>authCallbackUrl("javascript:alert(1)"),/Secure/);
});

test("confirmation token hashes verify with Auth and require confirmed user",async()=>{
  const url="https://interplanetaryfund.com/auth/callback?token_hash=opaque-token&type=signup&next=/onboarding";
  const params=callbackParameters(url);
  assert.equal(params.type,"token_hash");
  const calls=[];
  const auth={
    async verifyOtp(value){calls.push(value);return {data:{session:{access_token:"opaque"}},error:null};},
    async getUser(){return {data:{user:{id:"test-user",email_confirmed_at:"2026-10-29T19:00:00Z"}},error:null};}
  };
  const result=await completeAuthCallback(auth,params);
  assert.equal(result,"/onboarding");
  assert.deepEqual(calls,[{token_hash:"opaque-token",type:"signup"}]);
});
test("Supabase implicit email verification fragments are processed and removed from history",async()=>{
  const params=callbackParameters("https://interplanetaryfund.com/auth/callback?next=/onboarding#access_token=access&refresh_token=refresh&type=signup");
  assert.equal(params.type,"session");
  const calls=[];
  const auth={
    async setSession(value){calls.push(value);return {data:{},error:null};},
    async getUser(){return {data:{user:{id:"test-user",email_confirmed_at:"2026-10-29"}},error:null};}
  };
  assert.equal(await completeAuthCallback(auth,params),"/onboarding");
  assert.deepEqual(calls,[{access_token:"access",refresh_token:"refresh"}]);
});
test("PKCE code exchange supports explicit session callback but detects invalid response",async()=>{
  const params=callbackParameters("https://interplanetaryfund.com/auth/callback?code=one-use-code");
  let exchanged=0;
  const auth={
    async exchangeCodeForSession(code){exchanged++;assert.equal(code,"one-use-code");return {data:{},error:null};},
    async getUser(){return {data:{user:{id:"verified",email_confirmed_at:"2026-10-29"}},error:null};}
  };
  assert.equal(await completeAuthCallback(auth,params),"/onboarding");
  assert.equal(exchanged,1);
  await assert.rejects(()=>completeAuthCallback({
    ...auth,exchangeCodeForSession:async()=>({error:new Error("expired")})
  },params),/invalid, expired/);
});
test("recovery link completes a session and points only to reset password",async()=>{
  const params=callbackParameters("https://interplanetaryfund.com/auth/callback?next=%2Freset-password&token_hash=hash&type=recovery");
  const auth={verifyOtp:async()=>({data:{},error:null}),getUser:async()=>({
    data:{user:{id:"verified"}},error:null
  })};
  assert.equal(await completeAuthCallback(auth,params),"/reset-password");
});
test("never redirect to external origins, recursive auth or unsafe token links",async()=>{
  const params=callbackParameters("https://interplanetaryfund.com/auth/callback?next=https%3A%2F%2Fevil.invalid&token_hash=hash&type=signup");
  assert.equal(params.next,"/dashboard");
  const rejected=callbackParameters("https://interplanetaryfund.com/auth/callback?token_hash=hash&type=unknown");
  assert.equal(rejected.type,"error");
  assert.equal(safeReturnTo("/auth/callback"),"/dashboard");
  assert.equal(safeReturnTo("//attacker.invalid"),"/dashboard");
  assert.equal(safeReturnTo("/%2Fattacker.invalid"),"/dashboard");
  assert.equal(callbackParameters("https://interplanetaryfund.com/auth/callback#access_token=only").type,"error");
});
test("failure and missing confirmation never become an authenticated success",async()=>{
  const params=callbackParameters("https://interplanetaryfund.com/auth/callback#access_token=a&refresh_token=b");
  const auth={setSession:async()=>({data:{},error:null}),
    getUser:async()=>({data:{user:{id:"verified",email_confirmed_at:null}},error:null})};
  await assert.rejects(()=>completeAuthCallback(auth,params),/confirmation is not complete/);
  const failed=callbackParameters("https://interplanetaryfund.com/auth/callback?error=access_denied");
  await assert.rejects(()=>completeAuthCallback(auth,failed),/access_denied/);
});

test("first confirmed login routes incomplete profiles to onboarding",async()=>{
  const calls=[];
  const query={select(){return this},eq(k,v){calls.push([k,v]);return this},
    async maybeSingle(){return {data:{display_name:null,handle:null},error:null};}};
  const client={auth:{getUser:async()=>({data:{user:{id:"verified",email_confirmed_at:"2026-10-29"}},error:null})},
    from(table){calls.push(["table",table]);return query;}};
  assert.equal(await landingAfterLogin(client,"/dashboard"),"/onboarding");
  assert.ok(calls.some(x=>x[0]==="id"&&x[1]==="verified"));
  assert.equal(await landingAfterLogin(client,"/mine"),"/mine");
});
test("returning member login resumes dashboard; profile errors do not block login",async()=>{
  const client={auth:{getUser:async()=>({data:{user:{id:"verified",email_confirmed_at:"2026-10-29"}},error:null})},
    from(){return {select(){return this},eq(){return this},
      maybeSingle:async()=>({data:{display_name:"Member",handle:"person"},error:null})};}};
  assert.equal(await landingAfterLogin(client,"/dashboard"),"/dashboard");
  await assert.rejects(()=>landingAfterLogin({
    auth:{getUser:async()=>({data:{user:null},error:null})}
  },"/dashboard"),/could not verify/);
});

test("previously issued dashboard verification links land at callback without losing tokens",()=>{
  const fromLegacy="https://interplanetaryfund.com/dashboard#access_token=access&refresh_token=refresh&type=signup";
  assert.equal(legacyAuthLandingRedirect(fromLegacy),
    "/auth/callback?next=%2Fonboarding#access_token=access&refresh_token=refresh&type=signup");
  assert.equal(legacyAuthLandingRedirect("https://interplanetaryfund.com/reset-password#access_token=a&refresh_token=b&type=recovery"),
    "/auth/callback?next=%2Freset-password#access_token=a&refresh_token=b&type=recovery");
  assert.equal(legacyAuthLandingRedirect("https://interplanetaryfund.com/dashboard#campaign-story"),null);
  assert.equal(legacyAuthLandingRedirect("https://interplanetaryfund.com/auth/callback?token_hash=hash"),null);
});
test("register and login use verified Supabase Auth sessions, and original email OTP is available",()=>{
  const page=readFileSync(new URL("../src/pages/AuthPage.jsx",import.meta.url),"utf8");
  assert.match(page,/auth\.signUp\(/);
  assert.match(page,/emailRedirectTo:authCallbackUrl/);
  assert.match(page,/auth\.signInWithPassword\(/);
  assert.match(page,/auth\.verifyOtp\(/);
  assert.match(page,/type:"signup"/);
  assert.match(page,/autoComplete="one-time-code"/);
  assert.match(page,/Resend confirmation email/);
  assert.match(page,/preferred_handle/);
  assert.match(page,/landingAfterLogin/);
  const auth=readFileSync(new URL("../src/api/auth.js",import.meta.url),"utf8");
  assert.match(auth,/detectSessionInUrl: false/);
  const router=readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
  assert.match(router,/path="\/auth\/callback"/);
  assert.match(router,/legacyAuthLandingRedirect/);
});

test("a provider session without confirmed email cannot access member navigation",async()=>{
 const client={auth:{getUser:async()=>({data:{user:{id:"signedup",email_confirmed_at:null}},error:null})}};
 await assert.rejects(()=>landingAfterLogin(client,"/dashboard"),/Confirm your email/);
});
