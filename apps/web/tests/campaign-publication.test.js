import test from "node:test";
import assert from "node:assert/strict";
import {validateCampaignContent,persistCampaignContent,CATEGORIES} from "../src/lib/campaignPublication.js";
const uid="d09f4f67-68c3-45e8-bbf8-f76610de18ec";
const draft="d3155ba4-5376-49b5-b637-0e8dad75725a";
const form={title:"A community garden",summary:"Support the garden",story:"A real public story about our project.",category:"community",goal_amount:"1250.50",cover_image_url:""};
function client({user=uid,rows=[{id:draft,status:"active"}],error=null}={}){
  const ops=[];
  const query={
    update(values){ops.push(["update",values]);return this},
    insert(values){ops.push(["insert",values]);return this},
    eq(k,v){ops.push(["eq",k,v]);return this},
    select(...v){ops.push(["select",...v]);return this},
    single(){ops.push(["single"]);return Promise.resolve({data:rows[0],error})},
  };
  return {ops,api:{auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:null})},from(name){ops.push(["from",name]);return query}}};
}
test("all eleven original categories accepted",()=>{
  assert.equal(CATEGORIES.length,11);
  for(const category of CATEGORIES)assert.equal(validateCampaignContent({...form,category},{publish:true}).category,category);
});
test("drafts may remain empty but publishing requires complete actual content",()=>{
  assert.equal(validateCampaignContent({category:"other"},{}).status,"draft");
  assert.throws(()=>validateCampaignContent({title:"",summary:"",story:"",category:"other",goal_amount:""},{publish:true}),/Publication requires/);
  assert.equal(validateCampaignContent(form,{publish:true}).goal_amount,1250.5);
  assert.throws(()=>validateCampaignContent({...form,goal_amount:"0"},{publish:true}),/Publication requires/);
});
test("prevent URL injection and invalid amounts",()=>{
  assert.throws(()=>validateCampaignContent({...form,cover_image_url:"javascript:alert(1)"},{publish:true}),/public web URL/);
  assert.throws(()=>validateCampaignContent({...form,goal_amount:"1e9"},{publish:true}),/USD goal/);
  assert.throws(()=>validateCampaignContent({...form,goal_amount:"-5"},{publish:true}),/USD goal/);
});
test("source-aligned publish changes only owner draft, never any financial columns",async()=>{
  const {api,ops}=client();
  const result=await persistCampaignContent(api,form,{id:draft,publish:true});
  assert.deepEqual(result,{id:draft,status:"active"});
  assert.deepEqual(ops.filter(o=>o[0]==="eq"),[["eq","id",draft],["eq","owner_id",uid],["eq","status","draft"]]);
  const payload=ops.find(o=>o[0]==="update")[1];
  assert.deepEqual(Object.keys(payload).sort(),["category","cover_image_url","goal_amount","status","story","summary","title"].sort());
  assert.equal(payload.status,"active");
});
test("denies unauthenticated content mutation and unknown reference IDs",async()=>{
  const x=client({user:null});await assert.rejects(()=>persistCampaignContent(x.api,form,{publish:true}),/sign in/i);
  assert.equal(x.ops.length,0);
  await assert.rejects(()=>persistCampaignContent(client().api,form,{id:"../../campaigns",publish:true}),/Invalid campaign/);
});
test("server response must verify resulting status, not infer successful publish",async()=>{
  const x=client({rows:[{id:draft,status:"draft"}]});
  await assert.rejects(()=>persistCampaignContent(x.api,form,{id:draft,publish:true}),/did not confirm/);
});
