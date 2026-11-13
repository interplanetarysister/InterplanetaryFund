import test from "node:test";
import assert from "node:assert/strict";
import { evaluateGrowthTrend } from "../src/lib/growthTrendReview.mjs";

test("FORGE trend compares recent 7-day daily rate with prior 23 days",()=>{
  const decline=evaluateGrowthTrend(1,47,{label:"captures"});
  assert.equal(decline.status,"declining");
  assert.equal(decline.previousCount,46);
  const growth=evaluateGrowthTrend(10,33,{label:"followers"});
  assert.equal(growth.status,"growing");
  assert.equal(evaluateGrowthTrend(7,30).status,"stable");
});
test("FORGE does not confuse missing records with zero activity",()=>{
  for(const v of [null,undefined,"",false,NaN,-1,"1e4"]){
    assert.equal(evaluateGrowthTrend(v,100).status,"unavailable");
    assert.equal(evaluateGrowthTrend(3,v).status,"unavailable");
  }
  assert.equal(evaluateGrowthTrend(30,7).status,"unavailable");
  assert.equal(evaluateGrowthTrend(0,0).status,"quiet");
  assert.equal(evaluateGrowthTrend(1,2).status,"insufficient");
});
