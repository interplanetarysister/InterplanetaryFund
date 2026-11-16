import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
const owner="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222",campaign="33333333-3333-4333-8333-333333333333";
async function as(db,id){await db.exec("reset role");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec("set role authenticated");}
test("applied setup owner policies and restrictive email policies deny cross-owner and anonymous authoring",async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   grant usage on schema auth to authenticated;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.jwt() returns jsonb language sql stable as $$select '{"aal":"aal1"}'::jsonb$$;
   create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean);
   create table public.ifund_campaigns(id uuid primary key,owner_id uuid);
   grant select on public.ifund_campaigns to authenticated;
   create function public.ifund_current_account_is_active() returns boolean language sql stable as $$select true$$;
   create function public.ifund_current_user_has_current_terms() returns boolean language sql stable as $$select true$$;
   create table public.ifund_posts(id uuid);create table public.ifund_campaign_translation(id uuid);create table public.ifund_campaign_update(id uuid);create table public.ifund_profiles(id uuid);`);
  await db.exec(readFileSync(new URL("../supabase/migrations/20261110225840_ifund_campaign_creation_state_20261110.sql",import.meta.url),"utf8"));
  await db.exec(readFileSync(new URL("../supabase/migrations/20261110_ifund_email_authoring_deferred_withdrawal_mfa.sql",import.meta.url),"utf8"));
  await db.query("insert into auth.users values($1,now(),false),($2,now(),false)",[owner,other]);
  await db.query("insert into ifund_campaigns values($1,$2)",[campaign,owner]);
  await as(db,other);
  await assert.rejects(db.query("insert into ifund_campaign_creation_state(campaign_id,owner_id,draft_step) values($1,$2,2)",[campaign,other]),/row-level security/);
  await assert.rejects(db.query("insert into ifund_campaign_creation_state(campaign_id,owner_id) values($1,$2)",[campaign,owner]),/row-level security/);
  await as(db,owner);await db.query("insert into ifund_campaign_creation_state(campaign_id,owner_id,draft_step) values($1,$2,2)",[campaign,owner]);
  assert.equal((await db.query("select draft_step from ifund_campaign_creation_state")).rows[0].draft_step,2);
  await db.query("update ifund_campaign_creation_state set draft_step=3");
  await as(db,other);assert.equal((await db.query("select * from ifund_campaign_creation_state")).rows.length,0);
  assert.equal((await db.query("update ifund_campaign_creation_state set draft_step=0 returning campaign_id")).rows.length,0);
  await db.exec("reset role");await db.query("update auth.users set is_anonymous=true where id=$1",[owner]);
  await as(db,owner);assert.equal((await db.query("update ifund_campaign_creation_state set draft_step=1 returning campaign_id")).rows.length,0);
  await db.exec("reset role");
  const policies=await db.query("select policyname,permissive from pg_policies where tablename='ifund_campaign_creation_state'");
  assert.equal(policies.rows.filter(row=>row.policyname.startsWith("ifund_email_content_")).every(row=>row.permissive==="RESTRICTIVE"),true);
 }finally{await db.close();}
});
