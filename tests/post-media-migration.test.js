import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const migration = readFileSync(new URL("../supabase/migrations/20261126200000_ifund_social_post_media_attach.sql", import.meta.url), "utf8");
const projectionMigration = readFileSync(new URL("../supabase/migrations/20261126200100_ifund_social_post_media_feed_projection.sql", import.meta.url), "utf8");
const owner = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const videoId = "c1111111-1111-4111-8111-111111111111";
const imageId = "c2222222-2222-4222-8222-222222222222";
const audioId = "c3333333-3333-4333-8333-333333333333";
const othersVideoId = "c4444444-4444-4444-8444-444444444444";
const postId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

test("post media migration enforces own image/video attachment and projects public paths", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create table public.ifund_profiles(
      id uuid primary key, display_name text, public_profile_enabled boolean default true,
      account_status text default 'active', account_deletion_pending boolean default false,
      show_posts boolean default true);
    create table public.ifund_posts(
      id uuid primary key default gen_random_uuid(), author_id uuid references auth.users(id),
      body text, created_at timestamptz default now());
    create table public.ifund_member_media(
      id uuid primary key, owner_id uuid not null, content_kind text not null,
      content_type text not null, file_size integer not null, object_path text not null,
      object_etag text not null, object_sha256 text not null,
      deletion_requested_at timestamptz, created_at timestamptz default now());
    create table public.ifund_social_reports(
      id uuid primary key default gen_random_uuid(), post_id uuid, status text);
    create table public.ifund_social_archive_reports(archive_id text, status text);
    create table public.ifund_social_post(
      id text primary key, content text, created_date timestamptz,
      created_at timestamptz default now(), author_name text, source_platform text,
      external_url text, media_url text, source_system text);
    create function public.ifund_post_visible(p_post uuid)
    returns boolean language sql stable as $$
      select not exists(select 1 from public.ifund_social_reports r
      where r.post_id=p_post and r.status in ('open','removed')) $$;
    insert into auth.users(id) values ('${owner}'), ('${other}');
    insert into public.ifund_profiles(id,display_name) values ('${owner}','Creator'), ('${other}','Other');
    insert into public.ifund_member_media(id,owner_id,content_kind,content_type,file_size,object_path,object_etag,object_sha256) values
      ('${videoId}','${owner}','video','video/mp4',1024,'private/member-media/${owner}/${videoId}.mp4','etag','${"a".repeat(64)}'),
      ('${imageId}','${owner}','image','image/png',1024,'private/member-media/${owner}/${imageId}.png','etag','${"a".repeat(64)}'),
      ('${audioId}','${owner}','audio','audio/mpeg',1024,'private/member-media/${owner}/${audioId}.mp3','etag','${"a".repeat(64)}'),
      ('${othersVideoId}','${other}','video','video/mp4',1024,'private/member-media/${other}/${othersVideoId}.mp4','etag','${"a".repeat(64)}');
  `);
  await db.exec(migration);
  await db.exec(projectionMigration);
  const query = async (sql, params = []) => (await db.query(sql, params)).rows;

  // Happy paths: no media, own video, own image.
  await query("insert into public.ifund_posts(id,author_id,body) values($1,$2,'plain')", [postId, owner]);
  await query("insert into public.ifund_posts(author_id,body,media_id) values($1,'with video',$2)", [owner, videoId]);
  await query("insert into public.ifund_posts(author_id,body,media_id) values($1,'with image',$2)", [owner, imageId]);

  // The database boundary rejects every non-own / wrong-kind attachment,
  // whichever client (Worker route or direct PostgREST) attempts it.
  for (const bad of [othersVideoId, audioId,
                     "c5555555-5555-4555-8555-555555555555"]) {
    await assert.rejects(
      query("insert into public.ifund_posts(author_id,body,media_id) values($1,'bad',$2)", [owner, bad]),
      /Attached media must be your own image or video|violates foreign key/,
    );
  }
  // Pending-deletion media cannot be attached, and re-pointing an existing
  // post at someone else's file is rejected on UPDATE as well.
  await query("update public.ifund_member_media set deletion_requested_at=now() where id=$1", [imageId]);
  await assert.rejects(
    query("insert into public.ifund_posts(author_id,body,media_id) values($1,'late',$2)", [owner, imageId]),
    /Attached media must be your own image or video/,
  );
  await query("update public.ifund_member_media set deletion_requested_at=null where id=$1", [imageId]);
  await assert.rejects(
    query("update public.ifund_posts set media_id=$2 where id=$1", [postId, othersVideoId]),
    /Attached media must be your own image or video/,
  );

  // The browser insert path received exactly the new column grant.
  assert.equal((await query(
    "select has_column_privilege('authenticated','public.ifund_posts','media_id','INSERT') as ok"))[0].ok, true);
  assert.equal((await query(
    "select has_column_privilege('authenticated','public.ifund_posts','author_id','INSERT') as ok"))[0].ok, false);

  // Feed + permalink projections expose the public playback path, and the
  // path disappears when the library item is pending deletion.
  const feed = await query("select id,media_url from public.ifund_public_social_feed()");
  const videoPost = feed.find(row => row.media_url && row.media_url.endsWith(".mp4"));
  assert.equal(videoPost.media_url, `/api/media/public/file/${videoId}.mp4`);
  const imagePost = feed.find(row => row.media_url && row.media_url.endsWith(".png"));
  assert.equal(imagePost.media_url, `/api/media/public/file/${imageId}.png`);
  const single = await query("select media_url from public.ifund_public_social_post($1)", ["post-" +
    (await query("select id from public.ifund_posts where body='with video'"))[0].id]);
  assert.equal(single[0].media_url, `/api/media/public/file/${videoId}.mp4`);
  await query("update public.ifund_member_media set deletion_requested_at=now() where id=$1", [videoId]);
  const feedAfter = await query("select media_url from public.ifund_public_social_feed()");
  assert.ok(feedAfter.every(row => row.media_url === null || !row.media_url.endsWith(".mp4")));
});
