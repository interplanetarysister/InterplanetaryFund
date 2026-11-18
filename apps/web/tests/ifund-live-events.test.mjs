import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateLiveEvent, isLiveEventPublic } from "../src/api/liveEvents.js";

const read = path => readFileSync(new URL("../" + path, import.meta.url),"utf8");
const scheduled_at = new Date(Date.now()+24*60*60*1000).toISOString();
const event={title:"An IFund Community Conversation",description:"How to tell a clear story",scheduled_at,campaign_id:null,recording_consent:false};

test("public listing never equates unverified live with verified broadcast",()=>{
  const base={...event,public_visible:true};
  assert.equal(isLiveEventPublic({...base,status:"scheduled"}),true);
  assert.equal(isLiveEventPublic({...base,status:"draft"}),false);
  assert.equal(isLiveEventPublic({...base,status:"live",provider_status:"unconfigured"}),false);
  assert.equal(isLiveEventPublic({...base,status:"live",provider_status:"verified",verified_live_at:null}),false);
  assert.equal(isLiveEventPublic({...base,status:"live",provider_status:"verified",verified_live_at:new Date().toISOString()}),true);
  assert.equal(isLiveEventPublic({...base,status:"ended",verified_live_at:null}),false);
  assert.equal(isLiveEventPublic({...base,status:"ended",verified_live_at:new Date().toISOString()}),true);
  assert.equal(isLiveEventPublic({...base,status:"live",provider_status:"verified",verified_live_at:new Date().toISOString(),public_visible:false}),false);
});
test("event validation refuses missing time, malformed campaign and misleading title",()=>{
  assert.deepEqual(validateLiveEvent(event,{publishing:true}).title,event.title);
  assert.throws(()=>validateLiveEvent({...event,title:"Tiny"}),/title between/);
  assert.throws(()=>validateLiveEvent({...event,scheduled_at:""},{publishing:true}),/future/);
  assert.throws(()=>validateLiveEvent({...event,scheduled_at:new Date(Date.now()-10000).toISOString()},{publishing:true}),/future/);
  assert.throws(()=>validateLiveEvent({...event,campaign_id:"not-a-uuid"}),/valid owned campaign/);
  assert.throws(()=>validateLiveEvent({...event,description:"x".repeat(2001)}),/description/);
  assert.equal(validateLiveEvent({...event,recording_consent:"yes"}).recording_consent,false);
});
test("database is fail-closed for owner creation and verified broadcasts",()=>{
  const sql=read("../../supabase/migrations/20261118170000_ifund_live_events_foundation.sql");
  assert.match(sql,/enable row level security/i);
  assert.match(sql,/revoke all on public\.ifund_live_events from public, anon, authenticated/i);
  assert.match(sql,/ifund_live_verified_creator\(\)/);
  assert.match(sql,/security definer set search_path = ''/);
  assert.match(sql,/status='draft' and public_visible=false/);
  assert.match(sql,/provider_status='unconfigured' and verified_live_at is null/);
  assert.match(sql,/status in \('draft','scheduled','cancelled'\)/);
  assert.match(sql,/c\.owner_id=\(select auth\.uid\(\)\)/);
  assert.match(sql,/status not in \('live','ended'\)/);
  assert.doesNotMatch(sql,/grant\s+delete\s+on public\.ifund_live_events to authenticated/i);
});
test("management route is member guarded and source manifest is pending",()=>{
  const app=read("src/App.jsx");
  assert.match(app,/path="\/live\/manage" element={<MemberAccess><ManageLiveEvents \/><\/MemberAccess>}/);
  const manifest=JSON.parse(read("ci/route-acceptance.json"));
  const row=manifest.routes.find(r=>r.route==="/live/manage");
  assert.equal(row?.role,"member");
  assert.equal(row?.source_status,"not_verified");
});


test("shareable event page is public but never embeds unverified playback",()=>{
  const app=read("src/App.jsx");
  const view=read("src/pages/LiveEventDetail.jsx");
  const feed=read("src/pages/IFundLive.jsx");
  const api=read("src/api/liveEvents.js");
  assert.match(app,/path="\\/live\\/:id" element={<LiveEventDetail \\/>}/);
  assert.match(view,/getPublicLiveEvent/);
  assert.match(view,/not yet supported/);
  assert.match(feed,/to={`\\/live\\/\\$\{encodeURIComponent\(event.id\)\}`}/);
  assert.match(api,/eq\("public_visible", true\)\.maybeSingle\(\)/);
  const manifest=JSON.parse(read("ci/route-acceptance.json"));
  assert.equal(manifest.routes.find(r=>r.route==="/live/:id")?.source_status,"not_verified");
});
