import test from "node:test";
import assert from "node:assert/strict";
import { verifiedFundingProgress } from "../src/lib/fundingTotals.js";

test("unknown is not zero",()=>{
 assert.equal(verifiedFundingProgress({raised_amount:null,goal_amount:100}),null);
 assert.equal(verifiedFundingProgress({raised_amount:undefined,goal_amount:100}),null);
});
test("confirmed zero is valid",()=>{
 assert.deepEqual(verifiedFundingProgress({raised_amount:0,goal_amount:100}),{raised:0,goal:100,percentage:0});
});
