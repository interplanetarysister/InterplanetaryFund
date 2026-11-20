import test from "node:test";
import assert from "node:assert/strict";
import {classifySpokenDecision,evaluateVoiceActionIntent,HIGH_RISK_ACTIONS} from "../src/lib/agentVoiceApproval.mjs";
const pending={ownerId:"owner-1",status:"awaiting_review",actionId:"act-1",parametersHash:"sha256",actionType:"save_draft",expiresAt:20000};
test("spoken intent rejects background or ambiguous phrases",()=>{
  for(const text of ["yes","sounds good","do whatever you want","approve all actions","approve the transfer","the TV says approve",""]) assert.equal(classifySpokenDecision(text),"unknown");
  assert.equal(classifySpokenDecision("I approve this action"),"approve");
  assert.equal(classifySpokenDecision("no, cancel"),"deny");
});
test("spoken approval never executes even low-risk action",()=>{
  assert.deepEqual(evaluateVoiceActionIntent({transcript:"approve",pending,ownerId:"owner-1",now:10000}),
    {state:"backend_confirmation_required",decision:"approve",execute:false});
  assert.equal(evaluateVoiceActionIntent({transcript:"deny",pending,ownerId:"owner-1",now:10000}).state,"deny_requested");
});
test("owner, expiration and proposal integrity take priority",()=>{
  assert.equal(evaluateVoiceActionIntent({transcript:"approve",pending,ownerId:"owner-2",now:10000}).state,"owner_mismatch");
  assert.equal(evaluateVoiceActionIntent({transcript:"approve",pending,ownerId:"owner-1",now:20000}).state,"expired");
  assert.equal(evaluateVoiceActionIntent({transcript:"approve",pending:{...pending,parametersHash:""},ownerId:"owner-1",now:10000}).state,"invalid_proposal");
  assert.equal(evaluateVoiceActionIntent({transcript:"approve",pending:null,ownerId:"owner-1"}).state,"no_pending_action");
});
test("high-risk actions must use visible confirmation",()=>{
  for(const actionType of HIGH_RISK_ACTIONS){
    const result=evaluateVoiceActionIntent({transcript:"approve",pending:{...pending,actionType},ownerId:"owner-1",now:10000});
    assert.equal(result.state,"screen_confirmation_required");
    assert.equal(result.execute,false);
  }
});
