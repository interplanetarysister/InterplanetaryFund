import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withStoryVersion } from "../src/lib/campaignWizard.js";
import { createCampaignWritingRequests } from "../src/lib/campaignWritingRequests.js";
const source=readFileSync(new URL("../src/pages/CreateCampaign.jsx",import.meta.url),"utf8");
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
function harness(kind="section") {
  const pending=deferred(),guard=createCampaignWritingRequests();
  const state={error:"",proposals:{},suggestions:null,section:-1,suggesting:false};
  const refs={writingLock:{current:false},writingRevision:{current:guard},alive:{current:true},storySectionsRef:{current:["Original section","Second section"]}};
  const names={...refs,privacyDecisionPending:false,regeneratingSection:-1,suggesting:false,busy:false,
    loadingDraft:false,draftLoadError:"",draftDetails:"Original context",draftBeneficiary:"",draftNeed:"",writingPath:"need",
    form:{category:"community",goal_amount:"100"},writingSuggestion:()=>pending.promise,guidedCampaignDetails:()=>"Original context",
    splitStory:value=>value.split(/\n\s*\n/),setWritingQueued(){},
    setRegeneratingSection:value=>{state.section=value;},setSectionError:value=>{state.error=value;},
    setSectionProposals:value=>{state.proposals=typeof value==="function"?value(state.proposals):value;},
    setSuggesting:value=>{state.suggesting=value;},setSuggestionError:value=>{state.error=value;},
    setSuggestions:value=>{state.suggestions=value;},setStorySections:value=>{state.sections=value;}};
  const start=source.indexOf(kind==="section"?"  async function regenerateSection(index) {":"  async function suggestDraft() {");
  const end=source.indexOf(kind==="section"?"\n\n  async function suggestDraft()":"\n  useEffect(() => {",start+1);
  assert.ok(start>=0&&end>start);
  const body=source.slice(start,end);
  const fn=new Function(...Object.keys(names),body+`;return ${kind==="section"?"regenerateSection":"suggestDraft"};`)(...Object.values(names));
  return {pending,guard,state,refs,start:()=>fn(0)};
}
for(const kind of ["section","ideas"]){
  test(`actual ${kind} request discards a successful response after campaign context edits`,async()=>{
    const h=harness(kind),task=h.start();
    h.guard.invalidate();
    h.pending.resolve({story:"Obsolete story",titles:[],summaries:[]});
    await task;
    assert.deepEqual(h.state.proposals,{});assert.equal(h.state.suggestions,null);
  });
  test(`actual ${kind} request hides obsolete errors and cannot unlock a newer request`,async()=>{
    const h=harness(kind),task=h.start();
    h.guard.invalidate();const newer=h.guard.begin();
    h.pending.reject(Error("Old provider failure"));await task;
    assert.equal(h.state.error,"");assert.equal(h.guard.current(newer),true);
    assert.equal(h.refs.writingLock.current,true,"obsolete finally must not clear newer lock");
  });
  test(`actual ${kind} request accepts a response for its current campaign context`,async()=>{
    const h=harness(kind),task=h.start();
    h.pending.resolve({story:"Reviewed new story",titles:[],summaries:[]});await task;
    if(kind==="section")assert.equal(h.state.proposals[0],"Reviewed new story");
    else assert.equal(h.state.suggestions.story,"Reviewed new story");
    assert.equal(h.refs.writingLock.current,false);
  });
}
test("section edits save through the canonical story update and saved drafts expose their section editor",()=>{
  assert.match(source,/function editSection\(index, value\)[\s\S]*?setForm\(previous=>\(\{\.\.\.previous,story:sections.join/);
  assert.match(source,/const sections=splitStory\(data.story \|\| ""\)/);
  const editor=source.indexOf('aria-label="Story section editor"');
  const visibleGuard=source.lastIndexOf('{storySections.length>0&&<>',editor);
  assert.ok(visibleGuard>=0);
  assert.match(source,/function changeWritingBrief\(setter, value\) \{\s*invalidateWriting\(true\)/);
  assert.match(source,/key==="category"\|\|key==="goal_amount"\)invalidateWriting\(true\)/);
});

function sectionEditor(initial) {
  const storySectionsRef={current:[...initial]},userEditedDraft={current:false};
  const state={sections:[...initial],form:{title:"Unchanged title",story:initial.join("\n\n")},invalidations:0};
  let wizard={story_versions:[],draft_step:0};
  const names={storySectionsRef,userEditedDraft,form:state.form,storyEditStarted:{current:false},withStoryVersion,setWizard:update=>{wizard=update(wizard);},
    invalidateWriting:()=>{state.invalidations++;},setSaved(){},setBrowserSaved(){},
    setStorySections:value=>{state.sections=value;},setForm:update=>{state.form=update(state.form);}};
  const start=source.indexOf("  function editSection(index, value) {");
  const end=source.indexOf("\n  async function writingSuggestion(input)",start);
  assert.ok(start>=0&&end>start);
  const edit=new Function(...Object.keys(names),source.slice(start,end)+";return editSection;")(...Object.values(names));
  return {state,storySectionsRef,userEditedDraft,edit};
}
test("actual section editor preserves trailing spaces while typing the next word",()=>{
  const h=sectionEditor(["Hello","Other paragraph"]);
  h.edit(0,"Hello ");
  assert.equal(h.state.sections[0],"Hello ");
  assert.equal(h.storySectionsRef.current[0],"Hello ");
  assert.equal(h.state.form.story,"Hello \n\nOther paragraph");
  h.edit(0,"Hello world ");
  assert.equal(h.state.sections[0],"Hello world ");
  assert.equal(h.state.form.title,"Unchanged title");
  assert.equal(h.userEditedDraft.current,true);
  assert.equal(h.state.invalidations,2);
});
test("actual section editor retains empty paragraphs and stable later textarea indices",()=>{
  const h=sectionEditor(["First","Second","Third"]);
  h.edit(1,"");
  assert.deepEqual(h.state.sections,["First","","Third"]);
  assert.deepEqual(h.storySectionsRef.current,["First","","Third"]);
  assert.equal(h.state.form.story,"First\n\n\n\nThird");
  h.edit(2,"Third revised");
  assert.deepEqual(h.state.sections,["First","","Third revised"]);
  assert.equal(h.state.form.story,"First\n\n\n\nThird revised");
});
