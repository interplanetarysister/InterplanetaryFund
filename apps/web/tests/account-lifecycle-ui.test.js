import test from "node:test";
import assert from "node:assert/strict";
import { verifyAccountLifecycle } from "../src/lib/accountLifecycle.js";
const uid="b7a2dd75-c4c1-4fb0-b91d-4e2b57a4f391";
function client(data,error=null){return {from(table){assert.equal(table,"ifund_profiles");return {select(columns){assert.equal(columns,"account_status,account_deletion_pending");return {eq(column,value){assert.equal(column,"id");assert.equal(value,uid);return {maybeSingle:async()=>({data,error})};}};}};}};}
test("active profile passes",async()=>assert.deepEqual(await verifyAccountLifecycle(client({account_status:"active",account_deletion_pending:false}),{id:uid}),{ok:true}));
test("deletion-pending account is blocked",async()=>{const r=await verifyAccountLifecycle(client({account_status:"active",account_deletion_pending:true}),{id:uid});assert.equal(r.status,403);assert.match(r.message,/scheduled for deletion/);});
test("disabled and anonymized accounts are blocked",async()=>{for(const account_status of ["disabled","anonymized","suspended"]){assert.equal((await verifyAccountLifecycle(client({account_status,account_deletion_pending:false}),{id:uid})).status,403);}});
test("missing profile is unavailable",async()=>assert.equal((await verifyAccountLifecycle(client(null),{id:uid})).status,401));
test("unmapped lifecycle state is blocked pending verification",async()=>{const r=await verifyAccountLifecycle(client({account_status:null,account_deletion_pending:null}),{id:uid});assert.equal(r.status,403);assert.match(r.message,/pending migration verification/);});
test("malformed or failed profile reads fail closed",async()=>{assert.equal((await verifyAccountLifecycle(client({account_status:7,account_deletion_pending:false}),{id:uid})).status,503);assert.equal((await verifyAccountLifecycle(client(null,{message:"db"}),{id:uid})).status,503);});
