import test from "node:test";
import assert from "node:assert/strict";
import {emptyWizard,rememberWizard,restoreWizard,forgetWizard,importGuestWizard} from "../src/lib/campaignWizard.js";
const A="11111111-1111-4111-8111-111111111111";
const B="22222222-2222-4222-8222-222222222222";
function memory({ignoreRemove=false,throwOn=null}={}){
 const data=new Map();
 return {data,
  getItem(k){if(throwOn==="get")throw Error("denied");return data.get(k)??null;},
  setItem(k,v){if(throwOn==="set")throw Error("denied");data.set(k,v);},
  removeItem(k){if(throwOn==="remove")throw Error("denied");if(!ignoreRemove)data.delete(k);}
 };
}
test("guest import succeeds only when guest draft actually disappears",()=>{
 const s=memory();assert.equal(rememberWizard(s,null,null,emptyWizard()),true);
 assert.equal(importGuestWizard(s,A),true);assert.equal(s.data.size,1);
 assert.equal(restoreWizard(s,A).draft_step,0);
});
test("silent remove failure cannot falsely acknowledge guest import",()=>{
 const s=memory({ignoreRemove:true});rememberWizard(s,null,null,emptyWizard());
 assert.equal(importGuestWizard(s,A),false);
 assert.equal(s.data.size,2);
 assert.equal(importGuestWizard(s,B),false);
});
test("storage errors fail closed and do not claim successful save",()=>{
 for(const op of ["get","set","remove"]){
  const s=memory({throwOn:op});
  if(op==="get")assert.equal(rememberWizard(s,A,null,emptyWizard()),false);
  if(op==="set")assert.equal(rememberWizard(s,A,null,emptyWizard()),false);
  if(op==="remove"){
   const seeded=memory();assert.equal(rememberWizard(seeded,A,null,emptyWizard()),true);
   for(const [key,value] of seeded.data)s.data.set(key,value);
   assert.equal(forgetWizard(s,A),false);
   assert.equal(s.data.size,1,"failed removal must preserve the owner draft");
  }
 }
});
test("A to B to A never hydrates A's draft into B",()=>{
 const s=memory();const a={...emptyWizard(),draft_step:3};
 assert.equal(rememberWizard(s,A,null,a),true);
 assert.equal(restoreWizard(s,B).draft_step,0);
 assert.equal(restoreWizard(s,A).draft_step,3);
});

test("silent setItem failure cannot acknowledge wizard save",()=>{
 const s=memory();s.setItem=()=>{};
 assert.equal(rememberWizard(s,A,null,emptyWizard()),false);
 assert.equal(s.data.size,0);
});
test("storage read-back mismatch cannot acknowledge wizard save",()=>{
 const s=memory();const original=s.getItem.bind(s);
 s.getItem=(k)=>{const value=original(k);return value===null?null:value+"-corrupted";};
 assert.equal(rememberWizard(s,A,null,emptyWizard()),false);
});

test("silent removeItem failure cannot acknowledge wizard deletion",()=>{
 const s=memory({ignoreRemove:true});
 assert.equal(rememberWizard(s,A,null,emptyWizard()),true);
 assert.equal(forgetWizard(s,A),false);
 assert.equal(s.data.size,1,"unremoved owner draft must remain intact");
});
