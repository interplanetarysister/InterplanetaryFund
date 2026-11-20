import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadInAppReminders,scheduleInAppReminder,cancelInAppReminder} from "../src/lib/inAppReminders.mjs";

const OWNER="11111111-1111-4111-8111-111111111111";
const OTHER="22222222-2222-4222-8222-222222222222";
const ID="33333333-3333-4333-8333-333333333333";
const due=new Date(Date.now()+3600_000).toISOString();
const base={id:ID,owner_id:OWNER,title:"Review campaign",body:"Check the progress dashboard.",due_at:due,status:"queued",attempts:0,notification_id:null,created_at:new Date().toISOString()};
function fake({user=OWNER,record=base,rows=[base],rpcError=null,readError=null}={}){
 let last=null;let selections=[];
 const client={
  auth:{getUser:async()=>({data:{user:{id:user,email_confirmed_at:"2026-11-19T00:00:00Z",is_anonymous:false}},error:null})},
  rpc:async(name,args)=>{last={name,args};return {
   data:rpcError?null:name==="ifund_schedule_inapp_reminder"
    ?[{reminder_id:ID,reminder_status:"queued",scheduled_for:due}]
    :[{reminder_id:ID,reminder_status:"cancelled"}],
   error:rpcError?{message:rpcError}:null
  }},
  from(name){assert.equal(name,"ifund_inapp_reminder_queue");return {
   select(fields){assert.match(fields,/owner_id/);return this},
   eq(key,value){selections.push([key,value]);return this},
   order(){return this},
   async limit(){return {data:rows,error:readError?{message:"denied"}:null}},
   async maybeSingle(){return {data:record,error:readError?{message:"denied"}:null}}
  }}
 };
 return {client,last:()=>last,selections};
}
test("verified owner schedules and confirms their private queue record",async()=>{
 const mock=fake();
 const row=await scheduleInAppReminder(mock.client,{title:base.title,body:base.body,dueAt:due,requestId:ID});
 assert.equal(row.owner_id,OWNER);assert.equal(row.id,ID);
 assert.equal(mock.last().name,"ifund_schedule_inapp_reminder");
 assert.deepEqual(mock.selections,[["owner_id",OWNER],["id",ID]]);
});
test("cross-account queue reads and mismatched receipts fail closed",async()=>{
 await assert.rejects(()=>loadInAppReminders(fake({rows:[{...base,owner_id:OTHER}]}).client),/private reminder queue/);
 await assert.rejects(()=>scheduleInAppReminder(fake({record:{...base,owner_id:OTHER}}).client,{title:base.title,body:base.body,dueAt:due,requestId:ID}),/confirmed/);
 await assert.rejects(()=>scheduleInAppReminder(fake({rpcError:"denied"}).client,{title:base.title,body:base.body,dueAt:due,requestId:ID}),/denied/);
});
test("cancellation reports only verified owner rows",async()=>{
 const ok=fake({record:{...base,status:"cancelled"}});
 const result=await cancelInAppReminder(ok.client,ID);
 assert.equal(result.status,"cancelled");assert.equal(ok.last().name,"ifund_cancel_inapp_reminder");
 await assert.rejects(()=>cancelInAppReminder(fake({record:{...base,owner_id:OTHER,status:"cancelled"}}).client,ID));
 await assert.rejects(()=>cancelInAppReminder(ok.client,"/other-user"));
});
test("database dispatch is cron-only with hard boundaries",()=>{
 const sql=readFileSync(new URL("../../../supabase/migrations/20261119195500_ifund_owner_inapp_reminder_queue.sql",import.meta.url),"utf8");
 const component=readFileSync(new URL("../src/components/notifications/InAppReminders.jsx",import.meta.url),"utf8");
 const notifications=readFileSync(new URL("../src/pages/Notifications.jsx",import.meta.url),"utf8");
 assert.match(sql,/revoke all on function public\.ifund_dispatch_inapp_reminders\(integer\)[\s\S]*from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.ifund_dispatch_inapp_reminders\(integer\) to postgres/);
 assert.match(sql,/for update skip locked/);
 assert.match(sql,/on conflict \(canonical_operation_id\)/);
 assert.match(sql,/ifund-inapp-reminders-dispatch/);
 assert.match(sql,/ifund_current_account_is_active/);
 assert.match(sql,/auth\.uid\(\)/);
 assert.match(component,/onSubmit=\{schedule\}/);
 assert.match(component,/cancelInAppReminder\(authClient\(\),id\)/);
 assert.match(notifications,/<InAppReminders\s*\/>/);
 assert.doesNotMatch(sql,/net\.http|smtp|paypal|publishCampaign|service_role/i);
});
