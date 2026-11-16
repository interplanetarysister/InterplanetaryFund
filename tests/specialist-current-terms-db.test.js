import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { communicationsRoute } from '../worker/agents/communications.js';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333';
const source=name=>readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8');
const schemas=['ifund_strategy_runtime','ifund_growth_runtime','ifund_communications_runtime','ifund_connections_runtime'];
async function act(db,id){await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[id]);await db.exec('set role authenticated');}
async function fixture(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);
 create table public.ifund_profiles(id uuid primary key,account_status text,account_deletion_pending boolean,comm_prefs jsonb default '{"in_app_updates":true}');
 create table public.ifund_legal_acceptances(owner_id uuid,terms_version text,explicit_consent boolean,accepted_at timestamptz default now());
 create table public.ifund_campaigns(id uuid primary key,owner_id uuid);
 create table public.ifund_donations(campaign_id uuid,donor_id uuid,status text,paypal_capture_id text,captured_at timestamptz);
 create function public.ifund_current_account_is_active() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.ifund_profiles where id=auth.uid() and account_status='active' and account_deletion_pending=false)$$;
 create schema ifund_story_runtime;
 -- Entitlement dependency models the verified lifecycle boundary; the actual
 -- specialist entitlement implementation is exercised by the existing DB suites.
 create function ifund_story_runtime.subscription() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('level',case when exists(select 1 from auth.users u join public.ifund_profiles p on p.id=u.id where u.id=auth.uid() and u.email_confirmed_at is not null and u.is_anonymous=false and p.account_status='active' and p.account_deletion_pending=false) then 2 else 0 end)$$;`);
 for(const schema of schemas)await db.exec(`create schema ${schema};grant usage on schema ${schema} to authenticated;create table ${schema}.control(enabled boolean,delivery_enabled boolean);insert into ${schema}.control values(true,true);`);
 await db.exec(source('20261110_ifund_current_legal_terms_sync.sql'));
 await db.exec(source('20261113_ifund_explicit_marketing_consent.sql'));
 await db.exec(source('20261116110427_ifund_specialist_current_terms_and_explicit_delivery_consent.sql'));
 for(const id of [A,B]){await db.query('insert into auth.users values($1,now(),false)',[id]);await db.query("insert into public.ifund_profiles(id,account_status,account_deletion_pending) values($1,'active',false)",[id]);await db.query("insert into public.ifund_legal_acceptances(owner_id,terms_version,explicit_consent) values($1,'2026-11-10-v4',true)",[id]);}
 await db.query('insert into public.ifund_campaigns values($1,$2)',[C,A]);await db.query("insert into public.ifund_donations values($1,$2,'captured','verified-provider-capture',now())",[C,B]);
 return db;
}
test('all four specialists accept current terms and deny stale, missing and unconfirmed consent',async()=>{
 const db=await fixture();try{
  await act(db,A);for(const s of schemas)assert.equal((await db.query(`select ${s}.require_member() as id`)).rows[0].id,A);
  await db.exec('reset role');await db.query("update public.ifund_legal_acceptances set terms_version='2026-10-13-v3' where owner_id=$1",[A]);
  await act(db,A);for(const s of schemas)await assert.rejects(db.query(`select ${s}.require_member()`),/Member access required/);
  await db.exec('reset role');await db.query("update public.ifund_legal_acceptances set terms_version='2026-11-10-v4',accepted_at=null where owner_id=$1",[A]);
  await act(db,A);for(const s of schemas)await assert.rejects(db.query(`select ${s}.require_member()`),/Member access required/);
 }finally{await db.close();}
});
test('legacy update defaults never authorize outreach and current opt-out immediately removes eligibility',async()=>{
 const db=await fixture();const eligible=()=>db.query('select * from ifund_communications_runtime.eligible_recipients($1)',[C]);
 try{
  await act(db,A);assert.equal((await eligible()).rows.length,0);
  await act(db,B);await db.query('select * from public.ifund_set_marketing_consent(true)');
  await act(db,A);assert.equal((await eligible()).rows.length,1);
  await act(db,B);await db.query('select * from public.ifund_set_marketing_consent(false)');
  await act(db,A);assert.equal((await eligible()).rows.length,0);
  await act(db,B);await assert.rejects(eligible(),/Owned campaign required/);
 }finally{await db.close();}
});
test('confirmed-like anonymous identities and inactive owners cannot enter the reconciled contracts',async()=>{
 const db=await fixture();try{
  await db.query('update auth.users set is_anonymous=true where id=$1',[A]);await act(db,A);
  for(const s of schemas)await assert.rejects(db.query(`select ${s}.require_member()`),/Member access required/);
  await db.exec('reset role');await db.query('update auth.users set is_anonymous=false where id=$1',[A]);await db.query("update public.ifund_profiles set account_status='suspended' where id=$1",[A]);await act(db,A);
  for(const s of schemas)await assert.rejects(db.query(`select ${s}.require_member()`),/Member access required/);
 }finally{await db.close();}
});
test('communications refuses delivery against old or missing database consent contracts',async()=>{
 for(const contract of [1,null]){
  let sent=0;const response=await communicationsRoute(new Request('https://ifund.test/api/agents/communications/send',{method:'POST',headers:{authorization:'Bearer synthetic.owner','content-type':'application/json'},body:JSON.stringify({preview_id:C,confirm_owner_review:true})}),{SUPABASE_URL:'https://ssibsfmtodgximseeqsv.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-test',IFUND_COMMUNICATIONS_ENABLED:'enabled',IFUND_COMMUNICATIONS_SEND_ENABLED:'enabled'},async url=>{
   if(url.endsWith('/user'))return Response.json({id:A,email_confirmed_at:'yes',is_anonymous:false});
   if(url.endsWith('_delivery_contract'))return Response.json(contract);
   if(url.endsWith('_send'))sent++;throw Error('Delivery must not run');
  });assert.equal(response.status,503);assert.equal(sent,0);
 }
});
