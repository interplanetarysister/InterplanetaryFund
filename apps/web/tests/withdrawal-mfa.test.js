import test from "node:test";
import assert from "node:assert/strict";
import { confirmWithdrawalFactor, hasWithdrawalAssurance } from "../src/lib/withdrawalMfa.js";
import { readFileSync } from "node:fs";
const email = { id: "member", email_confirmed_at: "2026-11-10T01:00:00Z", is_anonymous: false };
const anon = { id: "guest", is_anonymous: true };
function mock(level="aal2") {
 const calls = [];
 const auth = { mfa: {
   async challenge({factorId}) {calls.push(["challenge",factorId]);return {data:{id:"challenge-1"},error:null};},
   async verify({factorId,challengeId,code}) {calls.push(["verify",factorId,challengeId,code]);return {data:{},error:null};},
   async getAuthenticatorAssuranceLevel(){calls.push(["assurance"]);return {data:{currentLevel:level},error:null};}
 }};
 return {auth,calls};
}
test("anonymous visitor and unconfirmed email never meet withdrawal assurance",()=>{
 assert.equal(hasWithdrawalAssurance(anon,"aal2"), false);
 assert.equal(hasWithdrawalAssurance({id:"x"},"aal2"), false);
 assert.equal(hasWithdrawalAssurance(email,"aal1"), false);
 assert.equal(hasWithdrawalAssurance(email,"aal2"), true);
});
test("authenticator verification requires confirmed email before challenge", async()=>{
 const a=mock();
 await assert.rejects(confirmWithdrawalFactor(a.auth,anon,"factor-1","123456"),/verified email/);
 assert.equal(a.calls.length,0);
});
test("malformed TOTP and absent factor fail before network requests", async()=>{
 const a=mock();
 await assert.rejects(confirmWithdrawalFactor(a.auth,email,"factor-1","123"),/six-digit/);
 await assert.rejects(confirmWithdrawalFactor(a.auth,email,"","123456"),/valid enrolled/);
 assert.equal(a.calls.length,0);
});
test("withdrawal step up challenges, verifies, and requires AAL2", async()=>{
 const a=mock("aal2");
 assert.equal(await confirmWithdrawalFactor(a.auth,email,"factor-1","123456"),true);
 assert.deepEqual(a.calls,[["challenge","factor-1"],["verify","factor-1","challenge-1","123456"],["assurance"]]);
 const b=mock("aal1");
 await assert.rejects(confirmWithdrawalFactor(b.auth,email,"factor-1","123456"),/not confirmed/);
});
test("withdrawal screen is first use MFA, never an actual payout",()=>{
 const s=readFileSync(new URL("../src/pages/WithdrawalVerification.jsx",import.meta.url),"utf8");
 assert.match(s,/mfa\.enroll\(\{ factorType: "totp" \}\)/);
 assert.match(s,/confirmWithdrawalFactor/);
 assert.match(s,/only requested when you begin your/);
 assert.doesNotMatch(s,/\.rpc\(["']ifund_request_withdrawal/);
});
