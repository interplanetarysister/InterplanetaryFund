import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261113010000_ifund_social_community.sql", import.meta.url), "utf8");
const owner = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const reporter = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const admin = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
const native = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

test("community migration creates permissioned native/archive discussions and moderation", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table auth.users(
      id uuid primary key, email_confirmed_at timestamptz,
      is_anonymous boolean default false);
    create function public.ifund_current_user_has_current_terms()
      returns boolean language sql stable as $terms$
      select coalesce(current_setting('test.terms_accepted',true),'yes')='yes' $terms$;
    create table public.ifund_profiles(
      id uuid primary key, display_name text,
      public_profile_enabled boolean default true,
      account_status text default 'active',
      account_deletion_pending boolean default false,
      show_posts boolean default true);
    create table public.ifund_posts(
      id uuid primary key, author_id uuid references auth.users(id),
      body text, created_at timestamptz default now());
    create table public.ifund_social_post(
      id text primary key, content text, created_date timestamptz,
      created_at timestamptz default now(),
      author_name text, source_platform text, external_url text,
      media_url text, source_system text);
    create table public.ifund_campaigns(
      id uuid primary key, owner_id uuid, status text);
    create table public.ifund_blogs(
      id text primary key, owner_auth_user_id uuid, type text, status text);
    create table public.ifund_blog_entries(
      id text primary key, blog_id text, status text);
    create function public.ifund_my_profile_settings() returns jsonb
      language sql stable security definer set search_path = '' as $$
      select to_jsonb(p) from public.ifund_profiles p
      join auth.users u on u.id=p.id
      where p.id=auth.uid() and p.account_status='active'
      and not p.account_deletion_pending
      and u.email_confirmed_at is not null and not u.is_anonymous
      and public.ifund_current_user_has_current_terms() $;
    create function public.ifund_current_user_is_verified_admin()
      returns boolean language sql stable security definer set search_path = ''
      as $$ select auth.uid()='cccccccc-cccc-4ccc-cccc-cccccccccccc'::uuid $$;
    create table public.ifund_social_post_archive_placeholder(id text);
    alter table public.ifund_posts enable row level security;
    create policy ifund_posts_public_read on public.ifund_posts
      for select to anon,authenticated using (true);
    create policy ifund_posts_insert on public.ifund_posts
      for insert to authenticated with check(author_id=auth.uid());
    grant usage on schema public to anon,authenticated;
    grant select on public.ifund_posts to anon,authenticated;
    grant insert,update,delete on public.ifund_posts to authenticated;
    create policy legacy_permissive_insert on public.ifund_posts for insert to authenticated with check(true);
    create policy legacy_permissive_update on public.ifund_posts for update to authenticated using(true) with check(true);
    create policy legacy_permissive_delete on public.ifund_posts for delete to authenticated using(true);
    insert into auth.users(id,email_confirmed_at) values
      ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',now()),
      ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',now()),
      ('cccccccc-cccc-4ccc-cccc-cccccccccccc',now());
    insert into public.ifund_profiles(id,display_name)
      values ('aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Creator'),
      ('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb','Reader'),
      ('cccccccc-cccc-4ccc-cccc-cccccccccccc','Moderator');
    insert into public.ifund_posts(id,author_id,body)
      values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Real social update');
    insert into public.ifund_social_post(id,content,source_system)
      values ('arc1','Archived public update','base44_public_social_archive');
  `);
  await db.exec(migration);
  const query = async (sql, params=[]) => (await db.query(sql,params)).rows;
  const who = async (id,role="authenticated") => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
    await db.exec("set role "+role);
  };
  await who(reporter);
  await db.query("select set_config('test.terms_accepted','no',false)");
  await assert.rejects(
    query("select public.ifund_social_like($1,true)",[native]),
    /Active verified member required/
  );
  await db.query("select set_config('test.terms_accepted','yes',false)");
  await db.exec("reset role");
  await db.query("update auth.users set email_confirmed_at=null where id=$1",[reporter]);
  await who(reporter);
  await assert.rejects(
    query("select public.ifund_social_reply($1,'Unverified reply')",[native]),
    /Active verified member required/
  );
  await db.exec("reset role");
  await db.query("update auth.users set email_confirmed_at=now() where id=$1",[reporter]);
  await who(reporter);
  await assert.rejects(
    query("insert into public.ifund_posts(id,author_id,body) values(gen_random_uuid(),$1,'impersonation')",[owner]),
    /Verified owner account required/
  );
  await assert.rejects(
    query("update public.ifund_posts set body='tampered' where id=$1",[native]),
    /Only a post owner may modify/
  );
  await query("select public.ifund_social_like($1,true)",[native]);
  assert.equal(Number((await query("select like_count from public.ifund_social_like_summary($1)",[[native]]))[0].like_count),1);
  await query("select public.ifund_social_reply($1,'Helpful update')",[native]);
  assert.equal((await query("select body from public.ifund_social_replies_read($1)",[native]))[0].body,"Helpful update");
  await query("select public.ifund_social_archive_like('arc1',true)");
  assert.equal(Number((await query("select like_count from public.ifund_social_archive_like_summary(ARRAY['arc1'])"))[0].like_count),1);
  await query("select public.ifund_social_archive_reply('arc1','Hello from IFund')");
  assert.equal((await query("select body from public.ifund_social_archive_replies_read('arc1')"))[0].body,"Hello from IFund");
  await query("select public.ifund_social_report($1,'This post has misleading claims')",[native]);
  await assert.rejects(query("delete from public.ifund_posts where id=$1",[native]), /Reported content is preserved/);
  assert.equal((await query("select count(*)::int n from public.ifund_public_social_feed() where id=$1",["post-"+native]))[0].n,0);
  await assert.rejects(query("select public.ifund_social_reply($1,'not allowed')",[native]),/Post unavailable/);
  await who(admin);
  const report=(await query("select id from public.ifund_social_moderation_queue() where post_id=$1",[native]))[0];
  assert.ok(report);
  await query("select public.ifund_social_review($1,'restore')",[report.id]);
  await who(reporter);
  assert.equal((await query("select count(*)::int n from public.ifund_public_social_feed() where id=$1",["post-"+native]))[0].n,1);
  await query("select public.ifund_social_friend($1,'request')",[owner]);
  await who(owner);
  assert.equal((await query("select count(*)::int n from public.ifund_social_friend_requests()"))[0].n,1);
  assert.equal((await query("select public.ifund_social_friend($1,'accept') state",[reporter]))[0].state,"accepted");
  await who(reporter);
  assert.equal((await query("select public.ifund_social_friend_status($1) state",[owner]))[0].state,"friends");
});
