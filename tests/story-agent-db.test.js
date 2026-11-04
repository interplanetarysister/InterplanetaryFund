import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  rid = "33333333-3333-4333-8333-333333333333";
const hash = "a".repeat(64);
const suggestion = {
  titles: ["A", "B", "C", "D", "E"],
  summaries: ["Summary A", "Summary B"],
  story: "A true story",
  image_prompt: "Mission image",
};
async function fixture() {
  const db = new PGlite();
  await db.exec(`create schema auth; create schema ifund_ops; create role anon; create role authenticated;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create table public.ifund_profiles(id uuid primary key,account_status text,account_deletion_pending boolean);
 create table public.ifund_legal_acceptances(owner_id uuid,terms_version text,explicit_consent boolean);
 create table public.ifund_campaigns(id uuid primary key,owner_id uuid,title text,summary text,story text,category text,goal_amount numeric);
 create table ifund_ops.workflow_jobs(id bigint generated always as identity primary key,workflow_key text not null,source_event_id text not null,owner_id uuid,payload jsonb not null default '{}',status text not null default 'paused' check(status in ('paused','pending','running','succeeded','failed','cancelled')),run_after timestamptz not null default now(),attempt_count integer not null default 0,max_attempts integer not null default 3,lease_until timestamptz,last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),lease_token uuid,unique(workflow_key,source_event_id));`);
  // Execute the actual generated entity DDL including its real enum constraints.
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const name of ["ifund_agent_content_draft", "ifund_agent_activity"]) {
    const start = sql.indexOf(
      "create table if not exists public." + name + " (",
    );
    const end = sql.indexOf(
      "\n\n",
      sql.indexOf("revoke all on public." + name, start),
    );
    await db.exec(sql.slice(start, end));
  }
  await db.exec(
    readFileSync(
      new URL("../docs/agents/sql/story_agent_preview.sql", import.meta.url),
      "utf8",
    ),
  );
  await db.exec("update ifund_story_runtime.control set enabled=true");
  for (const id of [uid, other]) {
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query(
      "insert into public.ifund_profiles values($1,'active',false)",
      [id],
    );
    await db.query(
      "insert into public.ifund_legal_acceptances values($1,'2026-10-13-v3',true)",
      [id],
    );
  }
  return db;
}
async function as(db, id, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('test.uid',$1,false)", [id || ""]);
  await db.exec("set role " + role);
}
async function begin(db, id = rid) {
  return (
    await db.query("select public.ifund_story_begin($1,$2,null) r", [id, hash])
  ).rows[0].r;
}
async function finish(db, lease, result = suggestion) {
  return (
    await db.query("select public.ifund_story_finish($1,$2,$3) r", [
      rid,
      lease,
      result,
    ])
  ).rows[0].r;
}
async function drafts(db) {
  return (await db.query("select public.ifund_story_drafts() r")).rows[0].r;
}
test("actual SQL executes: owner-scoped draft lifecycle, receipt replay, cancellation and no campaign changes", async () => {
  const db = await fixture();
  try {
    await as(db, uid);
    const claim = await begin(db);
    assert.equal(claim.state, "claimed");
    const draft = await finish(db, claim.lease);
    assert.equal(draft.status, "draft");
    assert.equal((await drafts(db)).length, 1);
    const replay = await begin(db);
    assert.equal(replay.state, "completed");
    assert.equal(replay.draft.id, draft.id);
    await as(db, other);
    assert.deepEqual(await drafts(db), []);
    await assert.rejects(
      db.query("select public.ifund_story_cancel($1)", [draft.id]),
    );
    await assert.rejects(finish(db, claim.lease));
    await as(db, uid);
    assert.equal(
      (await db.query("select public.ifund_story_cancel($1) r", [draft.id]))
        .rows[0].r.status,
      "cancelled",
    );
    await assert.rejects(
      db.exec("select * from public.ifund_agent_content_draft"),
    );
    await as(db, null, "anon");
    await assert.rejects(db.exec("select public.ifund_story_drafts()"));
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*)::int n from public.ifund_campaigns"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.ifund_agent_activity",
        )
      ).rows[0].n,
      2,
    );
  } finally {
    await db.close();
  }
});
test("unconfirmed, suspended, deletion-pending and no-consent accounts cannot claim or read", async () => {
  const db = await fixture();
  try {
    for (const update of [
      "update auth.users set email_confirmed_at=null",
      "update public.ifund_profiles set account_status='suspended'",
      "update public.ifund_profiles set account_deletion_pending=true",
      "delete from public.ifund_legal_acceptances",
    ]) {
      await db.exec("reset role");
      await db.exec("begin");
      await db.exec(update);
      await as(db, uid);
      await assert.rejects(begin(db));
      await db.exec("rollback");
    }
  } finally {
    await db.close();
  }
});
test("mismatched input, cross-owner campaign, duplicate, lease theft, malformed result and global daily cap", async () => {
  const db = await fixture();
  try {
    await db.query(
      "insert into public.ifund_campaigns(id,owner_id) values($1,$2)",
      [other, other],
    );
    await as(db, uid);
    await assert.rejects(
      db.query("select public.ifund_story_context($1)", [other]),
    );
    const claim = await begin(db);
    assert.equal((await begin(db)).state, "in_progress");
    assert.equal(
      (
        await db.query("select public.ifund_story_begin($1,$2,null) r", [
          rid,
          "b".repeat(64),
        ])
      ).rows[0].r.state,
      "conflict",
    );
    await assert.rejects(finish(db, other));
    await assert.rejects(finish(db, claim.lease, {}));
    await finish(db, claim.lease, null);
    assert.equal((await begin(db)).state, "failed");
    await as(db, other);
    assert.equal((await begin(db, other)).state, "claimed");
    await as(db, uid);
    assert.equal((await begin(db, uid)).state, "limited");
  } finally {
    await db.close();
  }
});

test("database activation is independently fail-closed and expired inference leases cannot write", async () => {
  const db = await fixture();
  try {
    await as(db, uid);
    const claim = await begin(db);
    await db.exec("reset role");
    await db.exec(
      "update ifund_ops.workflow_jobs set lease_until=now()-interval '1 second'",
    );
    await as(db, uid);
    assert.equal((await begin(db)).state, "failed");
    await assert.rejects(finish(db, claim.lease));
    await db.exec("reset role");
    await db.exec("update ifund_story_runtime.control set enabled=false");
    await as(db, uid);
    await assert.rejects(begin(db));
    await assert.rejects(drafts(db));
  } finally {
    await db.close();
  }
});
