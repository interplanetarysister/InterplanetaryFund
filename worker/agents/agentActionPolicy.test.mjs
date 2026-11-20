import test from "node:test";
import assert from "node:assert/strict";
import {assessAgentAction} from "./agentActionPolicy.mjs";
import {runSpecialistPractice} from "./agentPracticalSkills.mjs";
import {TEAM_CONTEXT_AGENTS} from "./teamContext.js";
const full={identityVerified:true,ownerScoped:true,serverAuthorized:true,auditReady:true,idempotent:true,
 standingConsentVerified:true,providerScopesVerified:true,providerConnected:true,
 destinationVerified:true,revocationChecked:true,releaseEvidenceVerified:true,independentQA:true,
 ownerDeploymentAuthorization:true,exactSHA:true,rollbackReady:true,secretsValidated:true};
test("all nine specialists can actually execute local practices with owner scope",()=>{
 assert.equal(TEAM_CONTEXT_AGENTS.length,9);
 for(const agent of TEAM_CONTEXT_AGENTS){
  const result=runSpecialistPractice({agent,question:"Explain my fundraising campaign",identityVerified:true,ownerScoped:true});
  assert.equal(result.status,"executed_local_advisory");assert.ok(result.checklist.length>=3);
  assert.equal(result.actions_performed,false);
 }
});
test("practice fails closed without verified identity and ownership",()=>{
 assert.throws(()=>runSpecialistPractice({agent:"story",question:"fundraiser please"}),/owner/);
 assert.throws(()=>runSpecialistPractice({agent:"admin",question:"fundraiser please",identityVerified:true,ownerScoped:true}),/Unknown/);
});
test("safe activities only permitted under verified owner scope",()=>{
 assert.equal(assessAgentAction("create_private_draft",full).decision,"autonomous");
 assert.equal(assessAgentAction("analyze",{identityVerified:true}).allowed,false);
});
test("owner-record updates need server authorization and idempotent audit",()=>{
 assert.equal(assessAgentAction("save_owner_draft",full).allowed,true);
 assert.equal(assessAgentAction("save_owner_draft",{...full,idempotent:false}).allowed,false);
});
test("external publishing needs revocable per-destination standing consent",()=>{
 assert.equal(assessAgentAction("publish_connected_social",full).allowed,true);
 for(const k of ["standingConsentVerified","providerScopesVerified","providerConnected","destinationVerified","revocationChecked","auditReady"]){
  assert.equal(assessAgentAction("publish_connected_social",{...full,[k]:false}).allowed,false);
 }
});
test("production deployment never proceeds on model authority alone",()=>{
 assert.equal(assessAgentAction("deploy_production",{}).allowed,false);
 for(const k of ["releaseEvidenceVerified","independentQA","ownerDeploymentAuthorization","exactSHA","rollbackReady","secretsValidated"])
  assert.equal(assessAgentAction("deploy_production",{...full,[k]:false}).allowed,false);
 assert.equal(assessAgentAction("deploy_production",full).decision,"controlled_deployment");
});
test("money, permission escalation and private deletion never auto-execute",()=>{
 for(const action of ["withdraw_funds","issue_refund","change_billing","delete_private_documents","change_roles","alter_consent","run_live_payment"])
  assert.equal(assessAgentAction(action,full).allowed,false);
});
test("unknown actions and credential leaks denied",()=>{
 assert.equal(assessAgentAction("unknown_foo",full).allowed,false);
 const out=runSpecialistPractice({agent:"story",question:"Bearer abcdefghijklmnopqrstuv",identityVerified:true,ownerScoped:true});
 assert.ok(!out.question.includes("abcdefghijklmnopqrstuv"));
});
