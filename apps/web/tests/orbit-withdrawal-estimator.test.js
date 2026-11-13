import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quoteWithdrawalFee } from "../src/lib/withdrawalFeeQuote.mjs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const ui=read("../src/components/agents/WithdrawalFeeEstimator.jsx");
const finance=read("../src/pages/FinanceDashboard.jsx");
test("ORBIT quote matches 7 percent half-up integer cents",()=>{
 for(const gross of [1,10,100,1000,1050,3333,10001,50000,9999999]){
   const quote=quoteWithdrawalFee((gross/100).toFixed(2));
   assert.equal(quote.platform_fee_cents,Number((BigInt(gross)*7n+50n)/100n));
   assert.equal(quote.platform_fee_cents+quote.estimated_owner_cents,gross);
 }
});
test("ORBIT rejects missing, negative, imprecise and malformed quotes",()=>{
 for(const bad of [null,undefined,"","-1","0","0.00","1.001","1e6","NaN","Infinity","1,000","not money"]){
   assert.equal(quoteWithdrawalFee(bad),null);
 }
 assert.equal(quoteWithdrawalFee("100.00").platform_fee_cents,700);
});
test("ORBIT is a read-only financial education widget with no provider action",()=>{
 assert.match(finance,/<WithdrawalFeeEstimator \/>/);
 assert.match(ui,/does not create a withdrawal or charge/);
 assert.match(ui,/does not verify cleared balance/);
 assert.doesNotMatch(ui,/fetch\(|\.rpc\(|create-order|capture-order|payouts\/execute/);
});
