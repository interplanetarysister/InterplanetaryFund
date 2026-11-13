import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sumVerifiedCounts } from "../src/lib/verifiedMoney.mjs";
const page=readFileSync(new URL("../src/pages/AdminFinance.jsx",import.meta.url),"utf8");
test("ORBIT capture count remains unknown when record evidence is incomplete",()=>{
 assert.equal(sumVerifiedCounts([{captured_payments:1},{captured_payments:"3"}],"captured_payments"),4);
 assert.equal(sumVerifiedCounts([],"captured_payments"),0);
 for (const value of [null,undefined,-1,false,"","1e6",NaN,3.5]) {
  assert.equal(sumVerifiedCounts([{captured_payments:value}],"captured_payments"),null);
 }
});
test("super admin displays unverified count as unavailable, not zero",()=>{
 assert.match(page,/sumVerifiedCounts\(state\.rows, "captured_payments"\)/);
 assert.match(page,/count===null\?"Unavailable":count/);
 assert.doesNotMatch(page,/Number\(row\.captured_payments\)\|\|0/);
});
