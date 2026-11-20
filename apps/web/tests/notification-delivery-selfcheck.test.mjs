import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyInAppNotificationDelivery } from "../src/lib/notifications.js";

const owner="11111111-1111-4111-8111-111111111111";
const notice="22222222-2222-4222-8222-222222222222";
function clientFor({id=owner,receiptId=notice,recordOwner=owner,failRpc=false,failRead=false}={}){
  let rpcCount=0,reads=0,filters=[];
  const client={
    auth:{async getUser(){return {data:{user:{id,email_confirmed_at:"2026-11-19T12:00:00Z"}},error:null}}},
    async rpc(fn){rpcCount++;assert.equal(fn,"ifund_notification_delivery_selfcheck");return {
      data:failRpc?null:[{notification_id:receiptId,delivered_at:"2026-11-19T12:00:00Z",already_exists:false}],
      error:failRpc?{message:"denied"}:null
    }},
    from(name){assert.equal(name,"ifund_notifications");return {
      select(columns){assert.match(columns,/owner_id/);return this},
      eq(key,value){filters.push([key,value]);return this},
      async maybeSingle(){reads++;return {data:failRead?null:{id:notice,owner_id:recordOwner,title:"Your iFund inbox is connected",type:"system"},error:null}}
    }},
  };
  return {client,inspect:()=>({rpcCount,reads,filters})};
}
test("verified member requests one notice, reads own record back and returns receipt",async()=>{
 const {client,inspect}=clientFor();
 const r=await verifyInAppNotificationDelivery(client);
 assert.equal(r.id,notice);assert.equal(r.alreadyExists,false);
 assert.deepEqual(inspect(),{rpcCount:1,reads:1,filters:[["owner_id",owner],["id",notice]]});
});
test("a foreign owner row, unreadable row, or invalid receipt does not count as delivered",async()=>{
 for(const opts of [{recordOwner:"33333333-3333-4333-8333-333333333333"},{failRpc:true},{failRead:true},{receiptId:"invalid"}]){
  await assert.rejects(()=>verifyInAppNotificationDelivery(clientFor(opts).client));
 }
});
test("no guest or browser-direct recipient creation is exposed",()=>{
 const ui=readFileSync(new URL("../src/pages/Notifications.jsx",import.meta.url),"utf8");
 const api=readFileSync(new URL("../src/lib/notifications.js",import.meta.url),"utf8");
 const sql=readFileSync(new URL("../../../supabase/migrations/20261119194500_ifund_owner_notification_delivery_selfcheck.sql",import.meta.url),"utf8");
 assert.match(ui,/onClick=\{testDelivery\}/);
 assert.match(ui,/verifyInAppNotificationDelivery\(authClient\(\)\)/);
 assert.match(api,/\.rpc\("ifund_notification_delivery_selfcheck"\)/);
 assert.match(sql,/revoke all on function public\.ifund_notification_delivery_selfcheck\(\)[\s\S]*from public, anon/);
 assert.match(sql,/on conflict \(canonical_operation_id\)/);
 assert.match(sql,/v_owner uuid := auth\.uid\(\)/);
 assert.doesNotMatch(sql,/http_|net\.http_|send_email|smtp|service_role/);
});
