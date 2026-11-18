import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {emptyWizard,restoreWizard,rememberWizard,forgetWizard,importGuestWizard,withStoryVersion} from "../src/lib/campaignWizard.js";
import {campaignSetupPayload,loadCampaignSetup,saveCampaignSetup} from "../src/api/campaignSetup.js";
const owner="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",campaign="33333333-3333-4333-8333-333333333333";

test("wizard scope permanently blocks a setup write after the final version read",async()=>{
 const h=clientFixture();let active=true;
 const original=h.client.from.bind(h.client);
 h.client.from=table=>{const query=original(table);if(table==='ifund_campaign_creation_state'){
  const read=query.maybeSingle.bind(query);query.maybeSingle=async()=>{const result=await read();active=false;return result;};
 }return query;};
 await assert.rejects(saveCampaignSetup(h.client,campaign,emptyWizard(),2,{ownerId:owner,assertActive(){if(!active)throw Error('Account changed');}}),/Account changed/);
 assert.equal(h.getState(),null);
});
function storage(){const rows=new Map();return {rows,getItem:key=>rows.get(key)||null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)};}
function clientFixture(){
  let user={id:owner,email_confirmed_at:"2026-11-15",is_anonymous:false},state=null;
  const calls=[];
  const client={auth:{getUser:async()=>({data:{user},error:null})},from(table){
    const q={table,filters:[],op:"read",payload:null};
    const query={select(){return query;},eq(key,value){q.filters.push([key,value]);return query;},insert(payload){q.op="insert";q.payload=payload;return query;},update(payload){q.op="update";q.payload=payload;return query;},async maybeSingle(){
      calls.push(q);
      if(table==="ifund_profiles")return {data:{account_status:"active",account_deletion_pending:false}};
      if(table==="ifund_campaigns")return {data:user.id===owner?{id:campaign,owner_id:owner,status:"draft"}:null};
      assert.equal(table,"ifund_campaign_creation_state");
      if(q.op==="insert"){if(state)return {error:{message:"conflict"}};state={...q.payload,updated_at:"2026-11-15T00:00:00Z"};}
      if(q.op==="update"){
        if(q.filters.some(([key,value])=>state?.[key]!==value))return {data:null};
        state={...state,...q.payload};
      }
      const result=state&&(q.op!=="read"||q.filters.every(([key,value])=>state[key]===value))?structuredClone(state):null;
      return {data:result,error:null};
    }};return query;
  }};
  return {client,calls,setUser:value=>{user=value;},getState:()=>state,setState:value=>{state=value;}};
}
test("new creators see three essential pages; legacy AI preparation drafts still restore",()=>{
  assert.equal(emptyWizard().draft_step,1);
  const s=storage();
  const legacy={...emptyWizard(),draft_step:0};
  assert.equal(rememberWizard(s,owner,campaign,legacy),true);
  assert.equal(restoreWizard(s,owner,campaign).draft_step,0);
  assert.match(source,/WIZARD_STEPS\.slice\(1\)/);
  assert.match(source,/Optional AI preparation and writing preferences/);
  assert.match(source,/No minimum character count/);
});

test("each wizard stage and private context survives reload without crossing account or campaign scope",()=>{
  const s=storage();let wizard=emptyWizard();
  for(let stage=0;stage<4;stage++){
    wizard={...wizard,draft_step:stage,location:"Private organizer note",ai_profile:{tone:"Warm and practical",never_change:"Preserve exact budget",writing_brief:{details:"Pantry needs refrigeration",beneficiary:"Local pantry",need:"Fridge",writingPath:"write"}}};
    assert.equal(rememberWizard(s,owner,campaign,wizard),true);
    assert.equal(restoreWizard(s,owner,campaign).draft_step,stage);
    assert.equal(restoreWizard(s,owner,campaign).ai_profile.never_change,"Preserve exact budget");
  }
  assert.equal(restoreWizard(s,other,campaign).location,"");
  assert.equal(restoreWizard(s,owner,null).location,"");
  assert.equal(restoreWizard(s,null,campaign).location,"");
  assert.equal(forgetWizard(s,other,campaign),true);
  assert.equal(restoreWizard(s,owner,campaign).draft_step,3);
});
test("guest wizard context transfers only after explicit import and never overwrites an owner draft",()=>{
  const s=storage(),wizard={...emptyWizard(),draft_step:2,location:"Guest's private place"};
  rememberWizard(s,null,null,wizard);
  assert.equal(restoreWizard(s,owner).location,"");
  assert.equal(importGuestWizard(s,owner),true);
  assert.equal(restoreWizard(s,owner).location,wizard.location);
  assert.equal(restoreWizard(s,null).location,"");
  rememberWizard(s,null,null,{...wizard,location:"Other guest"});
  assert.equal(importGuestWizard(s,owner),false);
  assert.equal(restoreWizard(s,owner).location,wizard.location);
  assert.equal(restoreWizard(s,null).location,"Other guest");
});
test("corrupt setup and storage failures do not falsely acknowledge saved progress",()=>{
  const s=storage();rememberWizard(s,owner,null,emptyWizard());
  const key=[...s.rows.keys()][0];s.rows.set(key,"broken private bytes");
  assert.equal(rememberWizard(s,owner,null,{...emptyWizard(),draft_step:3}),false);
  assert.equal(s.rows.get(key),"broken private bytes");
  assert.equal(rememberWizard({getItem(){throw Error("private storage blocked");}},owner,null,emptyWizard()),false);
});
test("setup save and reload preserve progress, deadline, instructions and writing brief in existing relation",async()=>{
  const h=clientFixture(),snapshot={...emptyWizard(),end_date:"2026-12-30",location:"Private note",ai_profile:{tone:"Clear",never_change:"Do not invent donors"},writing_brief:{writingPath:"write",details:"Budget details",need:"Fridge",beneficiary:"Pantry"}};
  const written=await saveCampaignSetup(h.client,campaign,snapshot,2);
  assert.equal(written.draft_step,2);
  assert.equal(written.ai_profile.writing_brief.details,"Budget details");
  assert.equal((await loadCampaignSetup(h.client,campaign)).end_date,"2026-12-30");
  await saveCampaignSetup(h.client,campaign,snapshot,3);
  assert.equal((await loadCampaignSetup(h.client,campaign)).draft_step,3);
  assert.ok(h.calls.some(q=>q.op==="update"&&q.filters.some(([key])=>key==="updated_at")),"progress updates compare the version read before saving");
});
test("other owners and anonymous or unconfirmed identities cannot load or save private setup",async()=>{
  const h=clientFixture();
  for(const user of [{id:other,email_confirmed_at:"yes",is_anonymous:false},{id:owner,email_confirmed_at:null,is_anonymous:false},{id:owner,email_confirmed_at:"yes",is_anonymous:true}]){
    h.setUser(user);
    await assert.rejects(loadCampaignSetup(h.client,campaign),/account|confirmed/);
    await assert.rejects(saveCampaignSetup(h.client,campaign,emptyWizard(),3),/account|confirmed/);
  }
  assert.equal(h.getState(),null);
});
test("a read reply from another owner and an account switch during load are rejected",async()=>{
  const h=clientFixture();h.setState({campaign_id:campaign,owner_id:owner,draft_step:2});
  let checks=0;h.client.auth.getUser=async()=>({data:{user:{id:++checks>=3?other:owner,email_confirmed_at:"yes",is_anonymous:false}}});
  await assert.rejects(loadCampaignSetup(h.client,campaign),/account changed/);
});
test("story versions are bounded snapshots and preserve raw user text",()=>{
  let wizard=emptyWizard();
  wizard=withStoryVersion(wizard,"Hello ",()=>"2026-11-15");
  wizard=withStoryVersion(wizard,"Hello ");
  assert.equal(wizard.story_versions.length,1);assert.equal(wizard.story_versions[0].text,"Hello ");
  for(let n=0;n<25;n++)wizard=withStoryVersion(wizard,"Long prior story "+n+"x".repeat(14000));
  assert.ok(wizard.story_versions.length<=20);
  assert.ok(new TextEncoder().encode(JSON.stringify(wizard.story_versions)).length<=180000);
  assert.throws(()=>campaignSetupPayload({end_date:"2026-02-30"}),/valid campaign end date/);
});
const source=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
function stepController({saved=true,blocked=false}={}){
  let wizard={...emptyWizard(),draft_step:1};const notices=[],savedTargets=[];
  const names={disabled:blocked,saveLock:{current:false},step:1,form:{title:"Owned campaign"},ownerId:owner,draftId:campaign,
    wizardSaveStep:{current:null},alive:{current:true},save:async()=>{savedTargets.push(names.wizardSaveStep.current);return saved;},
    setWizard:update=>{wizard=typeof update==="function"?update(wizard):update;},wizardSnapshot:next=>({...wizard,draft_step:next}),
    sessionStorage:storage(),rememberWizard,setWizardError:message=>notices.push(message),setProgressNotice:message=>notices.push(message)};
  const start=source.indexOf("  async function advanceWizard(next){"),end=source.indexOf("\n  useEffect(()=>{",start);
  const advance=new Function(...Object.keys(names),source.slice(start,end)+";return advanceWizard;")(...Object.values(names));
  return {advance,getWizard:()=>wizard,notices,savedTargets,names};
}
test("verified owners can save untitled drafts locally without creating an incomplete server campaign",()=>{
  assert.match(source,/status === "draft" && !form\.title\.trim\(\) && !campaignId\.current/);
  assert.match(source,/rememberBrowserCampaign\(sessionStorage,ownerId,form/);
  assert.match(source,/rememberWizard\(sessionStorage,ownerId,null/);
  assert.match(source,/No account draft was created/);
  assert.match(source,/Add a title to save it to your account/);
  const owners=storage();
  assert.equal(rememberWizard(owners,owner,null,emptyWizard()),true);
  assert.equal(restoreWizard(owners,other).draft_step,1);
});

test("actual wizard controller advances only after the campaign and setup save is confirmed",async()=>{
  const good=stepController();await good.advance(2);assert.equal(good.getWizard().draft_step,2);assert.deepEqual(good.savedTargets,[2]);
  const failed=stepController({saved:false});await failed.advance(2);assert.equal(failed.getWizard().draft_step,1);
  const blocked=stepController({blocked:true});await blocked.advance(2);assert.deepEqual(blocked.savedTargets,[]);
});
test("actual writing preference changes immediately invalidate in-flight proposals",()=>{
  let invalidated=false,wizard=emptyWizard();
  const start=source.indexOf("  function changeWritingPreference(field,value){"),end=source.indexOf("\n  async function advanceWizard",start);
  const change=new Function("invalidateWriting","setSaved","setProgressNotice","setWizard",source.slice(start,end)+";return changeWritingPreference;")(
    clear=>{assert.equal(clear,true);invalidated=true;},()=>{},()=>{},update=>{wizard=update(wizard);});
  change("never_change","Keep original figures");
  assert.equal(invalidated,true);assert.equal(wizard.ai_profile.never_change,"Keep original figures");
});
