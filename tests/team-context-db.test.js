import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, as } from "./fixtures/storyDatabase.js";

const OWNER="11111111-1111-4111-8111-111111111111";
const OTHER="22222222-2222-4222-8222-222222222222";
const CAMPAIGN="33333333-3333-4333-8333-333333333333";
const USER_EVENT="44444444-4444-4444-8444-444444444444";
const AGENT_EVENT="55555555-5555-4555-8555-555555555555";
const script=readFileSync(new URL("../supabase/migrations/20261115094500_ifund_shared_agent_team_events.sql",import.meta.url),"utf8");

async function setup(){
  const db=await fixture({workforce:true});
  await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$
    select jsonb_build_object('sub',current_setting('test.uid',true),'is_anonymous',false)
  $$;`);
  await db.exec(script);
  const executorKey="a".repeat(64);
  await db.query("update ifund_ops.workforce_control set worker_secret_sha256=encode(sha256(convert_to($1,'UTF8')),'hex') where singleton",[executorKey]);
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({"x-ifund-workforce-key":executorKey})]);
  await db.query("insert into public.ifund_campaigns(id,owner_id,title) values($1,$2,'Fictional pantry')",[CAMPAIGN,OWNER]);
  return db;
}

test("all team agents share only the authenticated owner's saved conversation",async()=>{
  const db=await setup();
  try{
    await as(db,OWNER);
    const saved=await db.query("select public.ifund_team_record_user($1,'story','Help me describe our $4,800 pantry budget.',$2) id",[USER_EVENT,CAMPAIGN]);
    assert.ok(saved.rows[0].id);
    const repeat=await db.query("select public.ifund_team_record_user($1,'story','Help me describe our $4,800 pantry budget.',$2) id",[USER_EVENT,CAMPAIGN]);
    assert.equal(saved.rows[0].id,repeat.rows[0].id);
    const history=await db.query("select * from public.ifund_team_recent(null,30)");
    assert.equal(history.rows.length,1);
    assert.equal(history.rows[0].agent_id,"story");
    await as(db,OTHER);
    const otherHistory=await db.query("select * from public.ifund_team_recent(null,30)");
    assert.equal(otherHistory.rows.length,0);
    await assert.rejects(db.query("select public.ifund_team_recent($1,10)",[CAMPAIGN]),/Owned campaign required/);
    await assert.rejects(db.query("select public.ifund_team_record_user($1,'echo','Impersonate campaign.',$2)",[AGENT_EVENT,CAMPAIGN]),/Owned campaign required/);
    await as(db,null,"anon");
    await assert.rejects(db.query("select * from public.ifund_team_recent(null,30)"),/permission denied|Verified member required/);
  } finally {await db.close();}
});

test("untrusted browser cannot forge agent reply; member can erase only own event",async()=>{
  const db=await setup();
  try{
    await as(db,OWNER);
    await db.query("select public.ifund_team_record_user($1,'pulse','Prepare a consented outreach plan.',null)",[USER_EVENT]);
    await db.query("select set_config('request.headers','{}',false)");
    await assert.rejects(db.query("select public.ifund_team_record_agent($1,'orbit','Verified financial receipt',null)",[AGENT_EVENT]),/Verified executor required/);
    await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({"x-ifund-workforce-key":"a".repeat(64)})]);
    await as(db,OTHER);
    assert.equal((await db.query("select public.ifund_team_erase($1) result",[USER_EVENT])).rows[0].result,false);
    await as(db,OWNER);
    assert.equal((await db.query("select public.ifund_team_erase($1) result",[USER_EVENT])).rows[0].result,true);
    assert.equal((await db.query("select count(*)::int n from public.ifund_team_recent(null,30)")).rows[0].n,0);
  } finally {await db.close();}
});

test("rejects mismatched replay and direct client mutation of transcript",async()=>{
  const db=await setup();
  try{
    await as(db,OWNER);
    await assert.rejects(db.query("select * from public.ifund_agent_team_events"),/permission denied/);
    await db.query("select public.ifund_team_record_user($1,'story','The first description of this plan.',null)",[USER_EVENT]);
    await assert.rejects(db.query("select public.ifund_team_record_user($1,'orbit','Different contents.',null)",[USER_EVENT]),/conflict/);
    await assert.rejects(db.query("insert into public.ifund_agent_team_events(owner_id,event_key,agent_id,speaker,source_kind,content) values($1,$2,'story','user','user_statement','forged')",[OTHER,AGENT_EVENT]),/permission denied/);
  }finally{await db.close();}
});

test("owner correction replaces prior user statement without altering another user",async()=>{
  const db=await setup();
  try{
    await as(db,OWNER);
    await db.query("select public.ifund_team_record_user($1,'story','Old budget estimate.',null)",[USER_EVENT]);
    const changed=await db.query("select public.ifund_team_correct($1,$2,'Corrected budget estimate.') id",[USER_EVENT,AGENT_EVENT]);
    assert.ok(changed.rows[0].id);
    const history=await db.query("select speaker,content from public.ifund_team_recent(null,30)");
    assert.deepEqual(history.rows,[{speaker:"user",content:"Corrected budget estimate."}]);
    await as(db,OTHER);
    await assert.rejects(
      db.query("select public.ifund_team_correct($1,$2,'Hijacked correction.')",[AGENT_EVENT,"66666666-6666-4666-8666-666666666666"]),
      /Owned active statement required/
    );
  }finally{await db.close();}
});

test("authenticated member without Worker attestation cannot create a user-labeled agent event",async()=>{
  const db=await setup();
  try{
    await as(db,OWNER);
    await db.query("select set_config('request.headers','{}',false)");
    await assert.rejects(
      db.query("select public.ifund_team_record_user($1,'story','Browser forged user exchange.',null)",[USER_EVENT]),
      /Verified executor required/
    );
  }finally{await db.close();}
});
