import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
test("profile and editorial RPCs enforce ownership, visibility and account status", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);
  create table public.ifund_profiles(id uuid primary key,display_name text,handle text,account_status text default 'active',account_deletion_pending bool default false);
  create table public.ifund_campaigns(id uuid,owner_id uuid,title text,summary text,status text);
  create table public.ifund_follows(owner_id uuid,campaign_id uuid,archived bool);
  create table public.ifund_posts(id uuid,author_id uuid,body text,created_at timestamptz default now());
  create table public.ifund_social_post(id text,content text,created_date timestamptz,created_at timestamptz default now(),author_name text,source_platform text,external_url text,media_url text,source_system text);
  create table public.ifund_blogs(id text primary key,owner_auth_user_id uuid,legacy_owner_user_id text,type text,title text,description text,slug text,status text,created_at timestamptz,updated_at timestamptz);
  create table public.ifund_blog_entries(id text primary key,blog_id text,owner_auth_user_id uuid,legacy_owner_user_id text,type text,title text,summary text,body text,status text,featured bool,published_at timestamptz,created_at timestamptz,updated_at timestamptz);
  create function public.ifund_current_user_has_current_terms() returns boolean language sql as $$select true$$;
  create function public.ifund_blog_author_entitled(p_owner_id uuid) returns boolean language sql as $$select p_owner_id::text like 'a%'$$;
  create function public.ifund_current_user_is_verified_super_admin() returns boolean language sql as $$select false$$;
`);
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20261111071500_ifund_social_archive_member_profile.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const owner = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
    other = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
  const campaign = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
  await db.exec(`
  insert into auth.users(id,email_confirmed_at) values ('${owner}',now()),('${other}',now());
  insert into public.ifund_profiles(id) values ('${owner}'),('${other}');
  insert into public.ifund_campaigns values ('${campaign}','${owner}','Public cause','','active');
  insert into public.ifund_posts(id,author_id,body) values (gen_random_uuid(),'${owner}','native post');
  insert into public.ifund_social_post(id,content,source_system) values ('one','legacy public','base44_public_social_archive'),('two','legacy private','base44');
`);
  const call = async (sql, args = []) => (await db.query(sql, args)).rows;
  const identity = (id) =>
    db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role anon");
  assert.deepEqual(
    await call(
      "select body from public.ifund_public_social_feed() order by body",
    ),
    [{ body: "legacy public" }, { body: "native post" }],
  );
  assert.equal(
    (
      await call("select public.ifund_public_member_profile($1) result", [
        owner,
      ])
    )[0].result,
    null,
  );
  await assert.rejects(
    call("select public.ifund_my_profile_settings()"),
    /permission denied/,
  );
  await db.exec("set role authenticated");
  await identity(owner);
  const [saved] = await call(
    "select public.ifund_save_my_profile('Owner','handle','bio',true,false,$1) p",
    [[campaign]],
  );
  assert.equal(saved.p.id, owner);
  assert.equal(
    (await call("select public.ifund_public_member_profile($1) p", [owner]))[0]
      .p.campaigns[0].id,
    campaign,
  );
  assert.equal(
    (
      await call(
        "select * from public.ifund_public_social_feed(null,null,$1)",
        [owner],
      )
    ).length,
    0,
  );
  assert.equal(
    (await call("select public.ifund_set_my_avatar($1,null) ok", [campaign]))[0]
      .ok,
    true,
  );
  assert.equal(
    (await call("select public.ifund_set_my_avatar(null,null) ok"))[0].ok,
    false,
  );
  assert.equal(
    (await call("select public.ifund_set_my_avatar(null,$1) ok", [campaign]))[0]
      .ok,
    true,
  );
  const blog = (
    await call(
      "select public.ifund_create_member_blog('A blog','Description') id",
    )
  )[0].id;
  const draft = (
    await call(
      "select public.ifund_save_blog_story($1,null,'Story','Summary','Body','draft') e",
      [blog],
    )
  )[0].e;
  assert.equal(draft.status, "draft");
  assert.equal(
    (
      await call(
        "select public.ifund_save_blog_story($1,$2,'Story','Summary','Body','published') e",
        [blog, draft.id],
      )
    )[0].e.status,
    "published",
  );
  await identity(other);
  assert.equal(
    (await call("select public.ifund_my_blog_workspace() w"))[0].w.blogs.length,
    0,
  );
  await assert.rejects(
    call(
      "select public.ifund_save_blog_story($1,$2,'Story','Summary','Body','published')",
      [blog, draft.id],
    ),
    /do not have publishing access/,
  );
  await assert.rejects(
    call(
      "select public.ifund_save_my_profile('Other',null,'bio',true,true,$1)",
      [[campaign]],
    ),
    /Invalid profile settings/,
  );
  await db.exec("reset role");
  await db.query(
    "update public.ifund_profiles set account_status='suspended' where id=$1",
    [owner],
  );
  await db.exec("set role authenticated");
  await identity(owner);
  assert.equal(
    (await call("select public.ifund_public_member_profile($1) p", [owner]))[0]
      .p,
    null,
  );
  await assert.rejects(
    call(
      "select public.ifund_save_my_profile('Owner',null,'bio',true,true,'{}')",
    ),
    /Verified active account required/,
  );
});
