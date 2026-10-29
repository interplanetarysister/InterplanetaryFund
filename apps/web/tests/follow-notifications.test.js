import test from "node:test";
import assert from "node:assert/strict";
import {listMyFollows,setCampaignFollow,changeFollow,validateFollowPrefs,
  DEFAULT_FOLLOW_PREFS} from "../src/lib/followedCampaigns.js";
import {loadNotifications,acknowledgeNotification,acknowledgeAllNotifications,
  safeNoticeDestination} from "../src/lib/notifications.js";

const owner="caa180c2-f802-46d5-8300-2f7d09806ea1";
const other="9b090da1-8c86-4505-b87d-55c502890180";
const campaign="d4bd3494-32dc-4b56-90b8-97c4b88e7ff0";
const row="a6978467-5a68-4edf-bf44-9a620abb1d98";
const make=(responses=[],uid=owner)=>{
  const calls=[];
  let index=0;
  const query={
    select(...args){calls.push(["select",...args]);return this},
    eq(...args){calls.push(["eq",...args]);return this},
    in(...args){calls.push(["in",...args]);return this},
    order(...args){calls.push(["order",...args]);return this},
    update(...args){calls.push(["update",...args]);return this},
    upsert(...args){calls.push(["upsert",...args]);return this},
    delete(){calls.push(["delete"]);return this},
    limit(...args){calls.push(["limit",...args]);return Promise.resolve(responses[index++]||{data:[],error:null})},
    maybeSingle(){calls.push(["maybeSingle"]);return Promise.resolve(responses[index++]||{data:null,error:null})}
  };
  return {calls,client:{auth:{getUser:async()=>({data:{user:uid?{id:uid,email_confirmed_at:"2026-10-29T00:00:00.000Z"}:null},error:null})},
    from(table){calls.push(["from",table]);return query}}};
};

test("following source defaults retain ten boolean preferences",()=>{
  assert.equal(Object.keys(DEFAULT_FOLLOW_PREFS).length,10);
  assert.equal(DEFAULT_FOLLOW_PREFS.comments,false);
  assert.deepEqual(validateFollowPrefs({...DEFAULT_FOLLOW_PREFS}),DEFAULT_FOLLOW_PREFS);
  assert.throws(()=>validateFollowPrefs({...DEFAULT_FOLLOW_PREFS,unknown:true}),/Invalid/);
  assert.throws(()=>validateFollowPrefs({...DEFAULT_FOLLOW_PREFS,updates:"true"}),/Invalid/);
});
test("unauthenticated follows never query data",async()=>{
  const x=make([],null);
  await assert.rejects(()=>listMyFollows(x.client),/Sign in/);
  await assert.rejects(()=>setCampaignFollow(x.client,campaign,true),/Sign in/);
  assert.equal(x.calls.length,0);
});
test("follows list is owner-scoped and returns only active campaign details",async()=>{
  const x=make([
    {data:[{id:row,owner_id:owner,campaign_id:campaign,pinned:false,archived:false}],error:null},
    {data:[{id:campaign,title:"Real cause",status:"active"}],error:null}
  ]);
  const items=await listMyFollows(x.client);
  assert.equal(items.length,1);
  assert.equal(items[0].campaign.title,"Real cause");
  assert.ok(x.calls.some(v=>v[0]==="eq"&&v[1]==="owner_id"&&v[2]===owner));
  assert.ok(x.calls.some(v=>v[0]==="eq"&&v[1]==="status"&&v[2]==="active"));
});
test("following inactive campaign is refused before write",async()=>{
  const x=make([{data:null,error:null}]);
  await assert.rejects(()=>setCampaignFollow(x.client,campaign,true),/not available/);
  assert.ok(!x.calls.some(v=>v[0]==="upsert"));
});
test("pin and archive cannot change owner or arbitrary fields",async()=>{
  const x=make([{data:{id:row,owner_id:owner,pinned:true},error:null}]);
  const item=await changeFollow(x.client,row,{pinned:true});
  assert.equal(item.pinned,true);
  assert.ok(x.calls.some(v=>v[0]==="eq"&&v[1]==="owner_id"&&v[2]===owner));
  await assert.rejects(()=>changeFollow(x.client,row,{owner_id:other}),/Unsupported/);
  await assert.rejects(()=>changeFollow(x.client,row,{pinned:1}),/Invalid/);
});
test("notifications only expose owner rows; unexpected owners never render",async()=>{
  const x=make([{data:[{id:row,owner_id:other,title:"private"}],error:null}]);
  await assert.rejects(()=>loadNotifications(x.client),/ownership/);
  assert.ok(x.calls.some(v=>v[0]==="eq"&&v[1]==="owner_id"&&v[2]===owner));
});
test("notification acknowledgement requires database-confirmed owner and read state",async()=>{
  const x=make([{data:{id:row,owner_id:owner,read:true},error:null}]);
  assert.equal(await acknowledgeNotification(x.client,row),row);
  assert.ok(x.calls.some(v=>v[0]==="update"&&v[1].read===true));
  const bad=make([{data:{id:row,owner_id:other,read:true},error:null}]);
  await assert.rejects(()=>acknowledgeNotification(bad.client,row),/not confirmed/);
});
test("mark all read does not report another user's changes as success",async()=>{
  const x=make([{data:[{id:row,owner_id:other,read:true}],error:null}]);
  await assert.rejects(()=>acknowledgeAllNotifications(x.client),/not confirmed/);
});
test("notification destinations are strictly local, contextual, and token-free",()=>{
  assert.equal(safeNoticeDestination("/campaign/"+campaign),"/campaign/"+campaign);
  assert.equal(safeNoticeDestination("/dashboard"),"/dashboard");
  for(const path of ["https://evil.invalid","//evil.invalid","/not-implemented",
    "/%2f%2fevil.invalid","/dashboard\\evil","/auth/callback?token_hash=secret",
    "/dashboard\nLocation: https://evil.invalid"]){
    assert.equal(safeNoticeDestination(path),null,path);
  }
});
