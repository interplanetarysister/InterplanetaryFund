import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {buildCampaignPayload,publishReadiness} from '../apps/web/src/lib/campaignLifecycle.js';

const migration=readFileSync(new URL('../supabase/migrations/20261116115043_ifund_campaign_atlas_write_grants.sql',import.meta.url),'utf8');
const terms=readFileSync(new URL('../supabase/migrations/20261110_ifund_current_legal_terms_sync.sql',import.meta.url),'utf8');
const publicationGate=readFileSync(new URL('../supabase/migrations/20261113_ifund_prepublication_quality_and_agent_review.sql',import.meta.url),'utf8');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const existing='33333333-3333-4333-8333-333333333333';
const story=Array.from({length:2},()=>Array.from({length:4},()=>
 'Our organizers recorded a synthetic neighborhood need and will explain every proposed budget item, '+
 'with regular factual progress reports and careful public updates so supporters can assess the plan, '+
 'while preserving the privacy of the people involved and distinguishing estimates from confirmed expenses, '.repeat(5)+
 'and they will invite questions when new information becomes available.'
).join(' ')).join('\n\n');
const form={title:'Synthetic campaign',summary:'A local campaign with a documented spending plan.',story,
 category:'community',goal_amount:'500.00',cover_image_url:'',map_opt_in:false,
 public_location_label:'',map_latitude:'',map_longitude:''};
const optedIn={...form,map_opt_in:true,public_location_label:'Seattle, Washington',map_latitude:'47.6',map_longitude:'-122.3'};
async function as(db,id=owner,role='authenticated'){
 await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[id]);
 await db.exec('set role '+role);
}
// Snapshot of the production campaign grants and policies inspected read-only
// on 2026-11-16. Keeping these independently restricted is essential: broad
// table INSERT/UPDATE fixtures would conceal the real column-denial defect.
async function fixture(){
 const db=new PGlite();
 await db.exec(`
  create role anon;create role authenticated;
  create schema auth;create schema ifund_private;
  grant usage on schema auth,ifund_private to authenticated;
  create function auth.uid() returns uuid language sql stable as $$
   select nullif(current_setting('test.uid',true),'')::uuid $$;
  create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean);
  create table public.ifund_profiles(id uuid primary key,account_status text,account_deletion_pending boolean);
  create table public.ifund_legal_acceptances(owner_id uuid,terms_version text,explicit_consent boolean,accepted_at timestamptz);
  create table public.ifund_donations(campaign_id uuid,donor_id uuid,status text);
  grant select on public.ifund_profiles,public.ifund_legal_acceptances,public.ifund_donations to authenticated;
  create function public.ifund_current_account_is_active() returns boolean language sql stable set search_path='' as $$
   select exists(select 1 from public.ifund_profiles p where p.id=auth.uid()
    and p.account_status='active' and p.account_deletion_pending is false) $$;
  create function ifund_private.verified_email_creator() returns boolean language sql stable security definer set search_path='' as $$
   select exists(select 1 from auth.users u where u.id=auth.uid()
    and u.email_confirmed_at is not null and u.is_anonymous is false) $$;
  revoke all on function ifund_private.verified_email_creator() from public,anon;
  grant execute on function ifund_private.verified_email_creator() to authenticated;
  create table public.ifund_campaigns(
   id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id),
   title text not null default '',summary text not null default '',story text not null default '',
   category text not null default 'community',goal_amount numeric(14,2) not null default 0,
   cover_image_url text not null default '',status text not null default 'draft',
   created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
   map_opt_in boolean not null default false,public_location_label text,
   map_latitude numeric(3,1),map_longitude numeric(4,1),
   constraint ifund_campaigns_status_check check(status in('draft','active','paused','completed')),
   constraint ifund_publish_complete check(status<>'active' or(length(btrim(title))>0 and length(btrim(summary))>0 and length(btrim(story))>0 and goal_amount>0)),
   constraint ifund_campaigns_approximate_map_location_check check(
    (map_opt_in=false and map_latitude is null and map_longitude is null and public_location_label is null)
    or(map_opt_in=true and map_latitude between -90 and 90 and map_longitude between -180 and 180
      and public_location_label is not null and length(btrim(public_location_label)) between 2 and 80))
  );
  alter table public.ifund_campaigns enable row level security;
  revoke all on public.ifund_campaigns from public,anon,authenticated;
  grant select(category,cover_image_url,created_at,goal_amount,id,map_latitude,map_longitude,map_opt_in,public_location_label,status,story,summary,title,updated_at)
   on public.ifund_campaigns to anon;
  grant select(category,cover_image_url,created_at,goal_amount,id,map_latitude,map_longitude,map_opt_in,owner_id,public_location_label,status,story,summary,title,updated_at)
   on public.ifund_campaigns to authenticated;
  grant insert(category,cover_image_url,goal_amount,owner_id,status,story,summary,title) on public.ifund_campaigns to authenticated;
  grant update(category,cover_image_url,goal_amount,status,story,summary,title) on public.ifund_campaigns to authenticated;
 `);
 await db.exec(terms);
 await db.exec(`
  create policy ifund_campaigns_anon_read on public.ifund_campaigns for select to anon using(status='active');
  create policy ifund_campaigns_authenticated_read on public.ifund_campaigns for select to authenticated using(
   status='active' or(ifund_current_account_is_active() and(owner_id=auth.uid() or exists(
    select 1 from public.ifund_donations d where d.campaign_id=ifund_campaigns.id and d.donor_id=auth.uid() and d.status='captured'))));
  create policy ifund_campaigns_insert on public.ifund_campaigns for insert to authenticated with check(
   owner_id=auth.uid() and status in('draft','active') and ifund_current_account_is_active() and ifund_current_user_has_current_terms());
  create policy ifund_campaigns_update on public.ifund_campaigns for update to authenticated using(
   owner_id=auth.uid() and ifund_current_account_is_active() and ifund_current_user_has_current_terms()) with check(
   owner_id=auth.uid() and status in('draft','active') and ifund_current_account_is_active() and ifund_current_user_has_current_terms());
  create policy ifund_email_content_insert on public.ifund_campaigns as restrictive for insert to authenticated with check(ifund_private.verified_email_creator());
  create policy ifund_email_content_update on public.ifund_campaigns as restrictive for update to authenticated
   using(ifund_private.verified_email_creator()) with check(ifund_private.verified_email_creator());
 `);
 await db.exec(publicationGate);
 await db.query('insert into auth.users values($1,now(),false),($2,now(),false)',[owner,other]);
 await db.query("insert into public.ifund_profiles values($1,'active',false),($2,'active',false)",[owner,other]);
 await db.query("insert into public.ifund_legal_acceptances values($1,'2026-11-10-v4',true,now()),($2,'2026-11-10-v4',true,now())",[owner,other]);
 await db.query("insert into public.ifund_campaigns(id,owner_id,title) values($1,$2,'Existing draft')",[existing,owner]);
 return db;
}
function insert(db,values=form,ownerId=owner,status='draft'){
 const payload={...buildCampaignPayload(values,status),owner_id:ownerId},keys=Object.keys(payload);
 return db.query('insert into public.ifund_campaigns('+keys.join(',')+') values('+keys.map((_,i)=>'$'+(i+1)).join(',')+') returning id,status,map_opt_in,public_location_label,map_latitude,map_longitude',Object.values(payload));
}
function update(db,id=existing,values=form,status='draft'){
 const payload=buildCampaignPayload(values,status),keys=Object.keys(payload);
 return db.query('update public.ifund_campaigns set '+keys.map((k,i)=>k+'=$'+(i+1)).join(',')+' where id=$'+(keys.length+1)+' returning id,status,map_opt_in,public_location_label,map_latitude,map_longitude',[...Object.values(payload),id]);
}
const denied=promise=>assert.rejects(promise,error=>error.code==='42501');

test('actual complete client insert and update fail on hosted column grants, then succeed after the narrow repair',async()=>{
 const db=await fixture();try{
  await as(db);await denied(insert(db));await denied(update(db));
  await db.exec('reset role');await db.exec(migration);await as(db);
  const saved=(await insert(db)).rows[0];assert.equal(saved.status,'draft');assert.equal(saved.map_opt_in,false);assert.equal(saved.map_latitude,null);
  const located=(await insert(db,optedIn)).rows[0];assert.equal(located.map_opt_in,true);assert.equal(Number(located.map_latitude),47.6);
  const placed=(await update(db,saved.id,optedIn)).rows[0];assert.equal(placed.map_opt_in,true);assert.equal(Number(placed.map_latitude),47.6);assert.equal(Number(placed.map_longitude),-122.3);
  const optedOut=(await update(db,saved.id,form)).rows[0];assert.equal(optedOut.map_opt_in,false);assert.equal(optedOut.public_location_label,null);
 }finally{await db.close();}
});
test('an explicitly accepted owner can publish a valid campaign and only public fields become anonymously readable',async()=>{
 const db=await fixture();try{
  assert.equal(publishReadiness(form).ready,true);
  await db.exec(migration);await as(db);const saved=(await insert(db)).rows[0];
  assert.equal((await update(db,saved.id,optedIn,'active')).rows[0].status,'active');
  await as(db,'','anon');assert.equal((await db.query('select title,map_opt_in from public.ifund_campaigns where id=$1',[saved.id])).rows.length,1);
  await denied(db.query('select owner_id from public.ifund_campaigns'));
 }finally{await db.close();}
});
test('column repair preserves owner, server metadata, anonymous and table-level privilege boundaries',async()=>{
 const db=await fixture();try{
  const policies=JSON.stringify((await db.query("select policyname,permissive,qual,with_check from pg_policies where tablename='ifund_campaigns' order by policyname")).rows);
  const constraints=JSON.stringify((await db.query("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.ifund_campaigns'::regclass order by conname")).rows);
  await db.exec(migration);await db.exec(migration);
  assert.equal(JSON.stringify((await db.query("select policyname,permissive,qual,with_check from pg_policies where tablename='ifund_campaigns' order by policyname")).rows),policies);
  assert.equal(JSON.stringify((await db.query("select conname,pg_get_constraintdef(oid) definition from pg_constraint where conrelid='public.ifund_campaigns'::regclass order by conname")).rows),constraints);
  for(const column of ['owner_id','id','created_at','updated_at'])assert.equal((await db.query("select has_column_privilege('authenticated','public.ifund_campaigns',$1,'UPDATE') allowed",[column])).rows[0].allowed,false);
  assert.equal((await db.query("select has_table_privilege('authenticated','public.ifund_campaigns','UPDATE') allowed")).rows[0].allowed,false);
  await as(db,'','anon');await denied(insert(db));await denied(update(db));
  await as(db,other);await denied(insert(db,form,owner));assert.equal((await update(db)).rows.length,0);
 }finally{await db.close();}
});
for(const [name,sql] of [
 ['inactive owner',"update public.ifund_profiles set account_status='suspended' where id=$1"],
 ['deletion-pending owner','update public.ifund_profiles set account_deletion_pending=true where id=$1'],
 ['missing current agreement','delete from public.ifund_legal_acceptances where owner_id=$1'],
 ['stale agreement',"update public.ifund_legal_acceptances set terms_version='2026-11-03-v3' where owner_id=$1"],
 ['unconfirmed owner','update auth.users set email_confirmed_at=null where id=$1'],
 ['anonymous authenticated identity','update auth.users set is_anonymous=true where id=$1'],
])test(name+' remains unable to insert or publish after the grant repair',async()=>{
 const db=await fixture();try{
  await db.exec(migration);await db.query(sql,[owner]);await as(db);
  await denied(insert(db));assert.equal((await update(db,existing,form,'active')).rows.length,0);
 }finally{await db.close();}
});
test('approximate-map and full-story constraints remain authoritative after the grant repair',async()=>{
 const db=await fixture();try{
  await db.exec(migration);await as(db);
  await assert.rejects(insert(db,{...optedIn,map_latitude:'91'}),error=>error.code==='23514');
  await assert.rejects(insert(db,{...form,story:'Too short'},owner,'active'),error=>error.code==='23514');
 }finally{await db.close();}
});
test('repair refuses to grant browser write columns if the existing campaign RLS has been disabled',async()=>{
 const db=await fixture();try{
  await db.exec('alter table public.ifund_campaigns disable row level security');
  await assert.rejects(db.exec(migration),/RLS-protected campaign table/);await db.exec('rollback');
  assert.equal((await db.query("select has_column_privilege('authenticated','public.ifund_campaigns','map_opt_in','INSERT') allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
