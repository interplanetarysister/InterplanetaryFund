import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration=readFileSync(new URL("../supabase/migrations/20261113080000_ifund_member_connections_hub.sql",import.meta.url),"utf8");
const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const stranger="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ownedCampaign="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const foreignCampaign="dddddddd-dddd-4ddd-8ddd-dddddddddddd";

test("public page links and sharing choices are private and never count as OAuth grants",async t=>{
 const db=new PGlite();
 t.after(()=>db.close());
 await db.exec([
  "create role anon; create role authenticated;",
  "create schema auth;",
  "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
  "grant usage on schema auth to anon,authenticated;",
  "grant execute on function auth.uid() to anon,authenticated;",
  "create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);",
  "create table public.ifund_campaigns(id uuid primary key,owner_id uuid);",
  "create function public.ifund_current_account_is_active() returns boolean language sql stable as $active$",
  " select exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null and u.is_anonymous is false) $active$;",
  "insert into auth.users(id,email_confirmed_at) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',now());",
  "insert into public.ifund_campaigns(id,owner_id) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');"
 ].join("\n"));
 await db.exec(migration);
 const query=(q,args=[])=>db.query(q,args);
 const who=async(id,role="authenticated")=>{
  await db.exec("reset role");
  await query("select set_config('request.jwt.claim.sub',$1,false)",[id||""]);
  await db.exec("set role "+role);
 };
 assert.equal((await query("select has_function_privilege('anon','public.ifund_save_public_link(text,text,text,uuid)','execute') ok")).rows[0].ok,false);
 assert.equal((await query("select has_table_privilege('authenticated','public.ifund_member_public_links','select') ok")).rows[0].ok,false);
 await who(owner);
 await assert.rejects(query("select * from public.ifund_member_public_links"),/permission denied/);
 await assert.rejects(query("select public.ifund_save_public_link($1,$2,$3,$4)",[
  "gofundme","https://gofundme.com.evil.org/f/fake","fake",null
 ]),/selected platform/);
 await assert.rejects(query("select public.ifund_save_public_link($1,$2,$3,$4)",[
  "gofundme","http://www.gofundme.com/f/no","fake",null
 ]),/secure public page/);
 await assert.rejects(query("select public.ifund_save_public_link($1,$2,$3,$4)",[
  "gofundme","https://www.gofundme.com/f/real","Our effort",foreignCampaign
 ]),/campaign you manage/);
 await query("select public.ifund_save_public_link($1,$2,$3,$4)",[
  "gofundme","https://www.gofundme.com/f/real?token=sensitive#private","Our effort",ownedCampaign
 ]);
 const owned=(await query("select * from public.ifund_my_public_links()")).rows;
 assert.equal(owned.length,1);
 assert.equal(owned[0].page_url,"https://www.gofundme.com/f/real");
 assert.equal(owned[0].campaign_id,ownedCampaign);
 await query("select public.ifund_set_share_choice($1,$2)",["facebook","review"]);
 const prefs=(await query("select provider,choice from public.ifund_my_share_choices()")).rows;
 assert.deepEqual(prefs,[{provider:"facebook",choice:"review"}]);
 await assert.rejects(query("select public.ifund_set_share_choice($1,$2)",["fake","review"]),/Invalid sharing preference/);
 await assert.rejects(query("select public.ifund_set_share_choice($1,$2)",["facebook","automatic"]),/Invalid sharing preference/);
 await assert.rejects(query("select * from public.ifund_member_connection_assistance"),/permission denied/);
 assert.equal((await query("select * from public.ifund_my_connection_assistance()")).rows.length,0);
 assert.equal((await query("select public.ifund_set_connection_assistance($1) enabled",[true])).rows[0].enabled,true);
 assert.equal((await query("select enabled from public.ifund_my_connection_assistance()")).rows[0].enabled,true);
 assert.equal((await query("select public.ifund_set_connection_assistance($1) enabled",[false])).rows[0].enabled,true);
 assert.equal((await query("select enabled from public.ifund_my_connection_assistance()")).rows[0].enabled,false);
 await assert.rejects(query("select public.ifund_set_connection_assistance($1)",[null]),/Choose whether connection guidance/);
 await who(stranger);
 assert.equal((await query("select * from public.ifund_my_connection_assistance()")).rows.length,0);
 assert.equal((await query("select * from public.ifund_my_public_links()")).rows.length,0);
 assert.equal((await query("select * from public.ifund_my_share_choices()")).rows.length,0);
 await db.exec("reset role");
 await query("update auth.users set email_confirmed_at=null where id=$1",[stranger]);
 await who(stranger);
 await assert.rejects(query("select public.ifund_save_public_link($1,$2,$3,$4)",[
  "gofundme","https://www.gofundme.com/f/test","Test",null
 ]),/Verified active account required/);
 await who(owner);
 assert.equal((await query("select public.ifund_remove_public_link($1) removed",["gofundme"])).rows[0].removed,true);
 assert.equal((await query("select * from public.ifund_my_public_links()")).rows.length,0);
 await who(null,"anon");
 await assert.rejects(query("select * from public.ifund_my_connection_assistance()"),/permission denied/);
 await assert.rejects(query("select * from public.ifund_my_public_links()"),/permission denied/);
});
