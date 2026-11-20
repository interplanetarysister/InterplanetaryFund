import test from "node:test";
import assert from "node:assert/strict";
import { printfulConfigured, inspectPrintfulStore } from "../worker/printfulStore.js";

test("Printful store must be configured with a secret and an integer ID", () => {
  assert.equal(printfulConfigured({}), false);
  assert.equal(printfulConfigured({PRINTFUL_API_TOKEN:"x".repeat(20)}),false);
  assert.equal(printfulConfigured({PRINTFUL_API_TOKEN:"x".repeat(20),PRINTFUL_STORE_ID:"123abc"}),false);
  assert.equal(printfulConfigured({PRINTFUL_API_TOKEN:"x".repeat(20),PRINTFUL_STORE_ID:"123"}),true);
});
test("unconfigured Printful never makes network requests", async () => {
  let called=0;
  assert.deepEqual(await inspectPrintfulStore({},()=>{called++;throw Error("Must not fetch");}),
    {configured:false,connected:false});
  assert.equal(called,0);
});
test("Printful health check is read-only and never sends token to caller", async () => {
  let request;
  const data=await inspectPrintfulStore({PRINTFUL_API_TOKEN:"s".repeat(30),PRINTFUL_STORE_ID:"42"},async (url,options)=>{
    request={url,options};
    return {ok:true,json:async()=>({result:{id:42,name:"Interplanetary Fund"}})};
  });
  assert.equal(request.url,"https://api.printful.com/stores/42");
  assert.equal(request.options.method,"GET");
  assert.match(request.options.headers.Authorization,/^Bearer /);
  assert.deepEqual(data,{configured:true,connected:true,storeId:42,storeName:"Interplanetary Fund"});
  assert.equal(JSON.stringify(data).includes("ssss"),false);
});
test("wrong store identity and failures fail closed", async () => {
  const env={PRINTFUL_API_TOKEN:"s".repeat(30),PRINTFUL_STORE_ID:"42"};
  assert.deepEqual(await inspectPrintfulStore(env,async()=>({ok:true,json:async()=>({result:{id:45}})})),{configured:true,connected:false});
  assert.deepEqual(await inspectPrintfulStore(env,async()=>({ok:false})),{configured:true,connected:false});
  assert.deepEqual(await inspectPrintfulStore(env,async()=>{throw Error("offline")}),{configured:true,connected:false});
});

test("malformed and coerced Printful identities fail closed", async () => {
  const env={PRINTFUL_API_TOKEN:"s".repeat(30),PRINTFUL_STORE_ID:"42"};
  for (const payload of [null, {}, {result:null}, {result:[]},
    {result:{id:"42",name:"iFund"}}, {result:{id:42}},
    {result:{id:42,name:" "}}, {result:{id:43,name:"iFund"}}]) {
    assert.deepEqual(await inspectPrintfulStore(env,async()=>({ok:true,json:async()=>payload})),
      {configured:true,connected:false});
  }
  assert.deepEqual(await inspectPrintfulStore(env,async()=>({ok:true,json:async()=>{throw Error("invalid JSON")}})),
    {configured:true,connected:false});
  assert.deepEqual(await inspectPrintfulStore(env,async()=>{throw Error("timeout")}),
    {configured:true,connected:false});
});
