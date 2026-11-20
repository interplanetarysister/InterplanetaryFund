import test from "node:test";
import assert from "node:assert/strict";
import {ROLE_PRACTICUM,PRACTICUM_RUBRIC,validateWorkforceTraining,scoreWorkforceExercise,recommendedPracticumRoute} from "../src/lib/agentWorkforceTraining.mjs";
test("every specialist has a human-role training exercise",()=>{
  assert.equal(validateWorkforceTraining().agents,9);
  assert.equal(Object.values(PRACTICUM_RUBRIC).reduce((a,b)=>a+b,0),100);
  for(const id of Object.keys(ROLE_PRACTICUM)){
    const scenario=recommendedPracticumRoute(id);
    assert.equal(scenario.automatedExecution,false);
    assert.ok(scenario.case.length>30);
  }
});
test("safety dimension cannot be offset by excellent other scores",()=>{
  const all5=Object.fromEntries(Object.keys(PRACTICUM_RUBRIC).map(key=>[key,5]));
  assert.equal(scoreWorkforceExercise(all5).passed,true);
  assert.equal(scoreWorkforceExercise({...all5,authorizationSafety:4}).passed,false);
  assert.equal(scoreWorkforceExercise({...all5,factualReliability:2}).passed,false);
  assert.throws(()=>scoreWorkforceExercise({...all5,authorizationSafety:6}),/Independent/);
});
test("invalid specialists cannot access an exercise",()=>{
  assert.throws(()=>recommendedPracticumRoute("unknown"),/Unknown/);
});
