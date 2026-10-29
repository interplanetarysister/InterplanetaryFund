#!/usr/bin/env node
// Offline, zero-network source-to-independent-runtime function audit.
// A candidate route or a synthetic test does NOT prove original behavior.
import { readFileSync } from "node:fs";
const load=path=>JSON.parse(readFileSync(new URL("../"+path,import.meta.url),"utf8"));
const functions=load("docs/migration/contracts/functions.json").items;
const entities=load("docs/migration/contracts/entities.json").items;
const automations=load("docs/migration/contracts/automations.json");
const byEntity=new Set(entities.map(x=>x.name));
const byFunction=new Set(functions.map(x=>x.name));
const errors=[];
if(functions.length!==184||byFunction.size!==184)errors.push("Expected 184 unique functions.");
if(entities.length!==95||byEntity.size!==95)errors.push("Expected 95 unique entities.");
let callers=0,links=0;
const risks={};
for(const fn of functions){
  if(!fn.source?.includes("base44/functions/"+fn.name+"/entry.ts"))errors.push(fn.name+": missing original source path");
  if(!Array.isArray(fn.source_entities_detected)||!Array.isArray(fn.source_function_invocations_detected))
    errors.push(fn.name+": missing source dependency audit");
  for(const entity of fn.source_entities_detected||[]){
    links++;
    if(!byEntity.has(entity))errors.push(fn.name+": unrecognized entity "+entity);
  }
  for(const callee of fn.source_function_invocations_detected||[])
    if(!byFunction.has(callee))errors.push(fn.name+": unknown invoked function "+callee);
  callers+=(fn.frontend_direct_callers||[]).length;
  if(!["financial_high_risk","privileged_identity","external_side_effect","metered_agent","application"].includes(fn.audit_domain))
    errors.push(fn.name+": unclassified risk");
  risks[fn.audit_domain]=(risks[fn.audit_domain]||0)+1;
  if(fn.runtime_proven!==true && fn.release_class!=="blocked_pending_implementation_and_qa")
    errors.push(fn.name+": unverified runtime not fail-closed");
  if(fn.port_candidate){
    if(!fn.port_candidate.code || !fn.port_candidate.operations?.length)errors.push(fn.name+": incomplete candidate mapping");
  }
}
for(const w of automations.workflows){
  for(const f of w.source_trigger_spec?.source_handlers||[])
    if(!byFunction.has(f))errors.push("Workflow "+w.name+" refers to unknown handler "+f);
}
if(callers!==236)errors.push("Original 236 direct frontend function references changed: "+callers);
if(links!==398)errors.push("Original 398 source function/entity edges changed: "+links);
if(automations.workflows.length!==17)errors.push("Original 17 workflows missing");
const verified=functions.filter(f=>(f.runtime_proven===true&&f.original_feature_parity_verified===true) ||
  (f.retired_by_owner===true&&f.retirement_evidence&&f.retirement_approved_by)).length;
const candidate=functions.filter(f=>f.port_candidate).length;
const summary={functions:184,risk_distribution:risks,source_entity_dependency_edges:links,
  direct_frontend_call_sites:callers,source_workflows:automations.workflows.length,
  candidate_partial_replacements:candidate,verified_full_ports:verified,
  not_verified_full_ports:184-verified,validation_errors:errors.length};
console.log(JSON.stringify(summary,null,2));
if(process.argv.includes("--release")&&verified!==184)
  errors.push("Release denied: "+(184-verified)+" function entrypoints not independently verified/retired.");
if(errors.length){console.error(errors.slice(0,25).join("\n"));process.exitCode=1;}
else if(!process.argv.includes("--release"))
  console.log("Source graph accounted for; this is NOT proof of full backend runtime operation.");
