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
 create table public.ifund_profiles(id uuid primary key,account_status text,account_deletion_pending boolean,display_name text,handle text);
 create function public.ifund_current_user_is_verified_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'')=auth.uid()::text $$;
 create table public.ifund_legal_acceptances(owner_id uuid,terms_version text,explicit_consent boolean);
 create table public.ifund_campaigns(id uuid primary key,owner_id uuid,title text,summary text,story text,category text,goal_amount numeric,status text,updated_at timestamptz default now());
 create table public.ifund_connections(id uuid primary key,owner_id uuid,provider text,status text,verified_at timestamptz,created_at timestamptz default now());
 create table public.ifund_posts(id uuid primary key,author_id uuid,body text,created_at timestamptz default now());
 create table ifund_ops.workflow_jobs(id bigint generated always as identity primary key,workflow_key text not null,source_event_id text not null,owner_id uuid,payload jsonb not null default '{}',status text not null default 'paused' check(status in ('paused','pending','running','succeeded','failed','cancelled')),run_after timestamptz not null default now(),attempt_count integer not null default 0,max_attempts integer not null default 3,lease_until timestamptz,last_error text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),lease_token uuid,unique(workflow_key,source_event_id));`);
  // Execute the actual generated entity DDL including its real enum constraints.
  const sql = readFileSync(
    new URL(
      "../supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const name of [
    "ifund_agent_content_draft",
    "ifund_agent_activity",
    "ifund_writing_research_brief",
  ]) {
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
      new URL(
        "../supabase/migrations/20261104043420_ifund_story_preview_contracts.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec("update ifund_story_runtime.control set enabled=true");
  for (const id of [uid, other]) {
    await db.query("insert into auth.users values($1,now())", [id]);
    await db.query(
      "insert into public.ifund_profiles(id,account_status,account_deletion_pending) values($1,'active',false)",
      [id],
    );
    await db.query(
      "insert into ifund_access.member_entitlements(owner_id,tier,status,verified_at,valid_until,provider,receipt_id) values($1,'basic','active',now(),now()+interval '1 day','paypal',$2)",
      [id, "verified-test-" + id],
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

test("eligibility is server-owned, denies stale claims, honors verified admin and expires trials and day passes", async () => {
  const db = await fixture();
  try {
    await as(db, uid);
    assert.equal(
      (await db.query("select public.ifund_story_subscription() r")).rows[0].r
        .level,
      1,
    );
    await assert.rejects(
      db.exec("update ifund_access.member_entitlements set tier='enterprise'"),
    );
    await db.exec("reset role");
    await db.query(
      "delete from ifund_access.member_entitlements where owner_id=$1",
      [uid],
    );
    await as(db, uid);
    assert.equal(
      (await db.query("select public.ifund_story_subscription() r")).rows[0].r
        .active,
      false,
    );
    await assert.rejects(begin(db));
    // Privileged provider integration seeds a typed receipt; staged/user metadata is never read.
    await db.exec("reset role");
    await db.query(
      "insert into ifund_access.member_entitlements(owner_id,tier,status,trial_started_at,trial_end,verified_at,valid_until,provider,receipt_id) values($1,'professional','trialing',now()-interval '2 days',now()-interval '1 day',now(),now()+interval '1 day','paypal','trial-receipt')",
      [uid],
    );
    await as(db, uid);
    assert.equal(
      (await db.query("select public.ifund_story_subscription() r")).rows[0].r
        .level,
      0,
    );
    await db.exec("reset role");
    await db.query(
      "update ifund_access.member_entitlements set day_pass_expires_at=now()+interval '1 hour' where owner_id=$1",
      [uid],
    );
    await as(db, uid);
    assert.equal(
      (await db.query("select public.ifund_story_subscription() r")).rows[0].r
        .status,
      "day_pass",
    );
    await db.exec("reset role");
    await db.query(
      "update ifund_access.member_entitlements set valid_until=verified_at+interval '1 microsecond' where owner_id=$1",
      [uid],
    );
    await as(db, uid);
    await assert.rejects(begin(db));
    await db.exec("reset role");
    await db.query("select set_config('test.admin',$1,false)", [uid]);
    await as(db, uid);
    assert.equal(
      (await db.query("select public.ifund_story_subscription() r")).rows[0].r
        .level,
      4,
    );
    await db.exec("reset role");
    await db.query(
      "update public.ifund_profiles set account_status='suspended' where id=$1",
      [uid],
    );
    await as(db, uid);
    await assert.rejects(db.exec("select public.ifund_story_subscription()"));
  } finally {
    await db.close();
  }
});

test("fresh account context is owner-scoped and uses verified research only, with honest unavailable fields", async () => {
  const db = await fixture();
  try {
    await db.query(
      "insert into public.ifund_campaigns(id,owner_id,title,status) values($1,$2,'Private other campaign','draft')",
      [other, other],
    );
    await db.query(
      "insert into public.ifund_connections(id,owner_id,provider,status) values($1,$2,'private-other-provider','connected')",
      [other, other],
    );
    await db.query(
      "insert into public.ifund_posts(id,author_id,body) values($1,$2,'Private other post')",
      [other, other],
    );
    await db.exec(
      "insert into public.ifund_writing_research_brief(id,status,summary,created_at) values('unsafe','needs_review','UNVERIFIED DO NOT USE',now())",
    );
    await as(db, uid);
    let ctx = (await db.query("select public.ifund_story_context(null) r"))
      .rows[0].r;
    assert.deepEqual(ctx.campaigns, []);
    assert.deepEqual(ctx.connections, []);
    assert.deepEqual(ctx.ifund_posts, []);
    assert.equal(ctx.research.available, false);
    assert.equal(ctx.data_complete, false);
    assert.ok(ctx.data_unavailable_sources.includes("historical_memory"));
    await db.exec("reset role");
    await db.exec(
      "insert into public.ifund_writing_research_brief(id,status,summary,guidance,source_urls,created_at) values('verified','verified_sources','Verified general guidance','[\"Be truthful\"]','[\"https://example.org/research\"]',now())",
    );
    await as(db, uid);
    ctx = (await db.query("select public.ifund_story_context(null) r")).rows[0]
      .r;
    assert.equal(ctx.research.available, true);
    assert.equal(ctx.research.summary, "Verified general guidance");
    assert.doesNotMatch(
      JSON.stringify(ctx),
      /Private other|private-other|UNVERIFIED/,
    );
  } finally {
    await db.close();
  }
});

test("explicit choices produce source-compatible drafts idempotently; edits reject stale revisions, identity changes and publication fields", async () => {
  const db = await fixture();
  try {
    await db.query(
      "insert into public.ifund_campaigns(id,owner_id,title,status) values($1,$2,'Existing campaign','draft')",
      [uid, uid],
    );
    await as(db, uid);
    const claim = await begin(db);
    const suggestion = await finish(db, claim.lease);
    const select = async (args = {}) =>
      (
        await db.query(
          "select public.ifund_story_select($1,$2,$3,$4,$5,$6) r",
          [
            rid,
            suggestion.id,
            args.revision || suggestion.updated_at,
            uid,
            args.title_index ?? 2,
            1,
          ],
        )
      ).rows[0].r;
    const chosen = await select();
    assert.equal(chosen.campaign_changed, false);
    assert.equal(chosen.needs_owner_review, true);
    assert.deepEqual(chosen.draft.payload, {
      title: "C",
      summary: "Summary B",
      story: "A true story",
    });
    assert.equal(chosen.draft.status, "draft");
    assert.equal((await select()).draft.id, chosen.draft.id);
    await assert.rejects(select({ title_index: 1 }));
    await as(db, other);
    await assert.rejects(
      db.query("select public.ifund_story_revise($1,$2,$3)", [
        chosen.draft.id,
        chosen.draft.updated_at,
        chosen.draft.payload,
      ]),
    );
    await as(db, uid);
    await assert.rejects(
      db.query("select public.ifund_story_revise($1,$2,$3)", [
        chosen.draft.id,
        chosen.draft.updated_at,
        { ...chosen.draft.payload, status: "active" },
      ]),
    );
    const revised = (
      await db.query("select public.ifund_story_revise($1,$2,$3) r", [
        chosen.draft.id,
        chosen.draft.updated_at,
        { ...chosen.draft.payload, title: "My revised title" },
      ])
    ).rows[0].r;
    assert.equal(revised.payload.title, "My revised title");
    await assert.rejects(
      db.query("select public.ifund_story_revise($1,$2,$3)", [
        chosen.draft.id,
        chosen.draft.updated_at,
        chosen.draft.payload,
      ]),
    );
    await db.exec("reset role");
    assert.equal(
      (
        await db.query("select title from public.ifund_campaigns where id=$1", [
          uid,
        ])
      ).rows[0].title,
      "Existing campaign",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from public.ifund_agent_content_draft where source_system='ifund_story_accepted_v1'",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});

test("explicit memory corrections are scoped, concurrency-checked and deletable after plan expiry without exposing another owner", async () => {
  const db = await fixture();
  try {
    await db.query(
      "insert into public.ifund_campaigns(id,owner_id,title,status) values($1,$2,'First campaign','draft'),($3,$2,'Second campaign','draft')",
      [uid, uid, rid],
    );
    await as(db, uid);
    const save = async (campaign, revision, values) =>
      (
        await db.query(
          "select public.ifund_story_save_preferences($1,$2,$3,0) r",
          [campaign, revision, values],
        )
      ).rows[0].r;
    const global = await save(null, null, {
      tone: "Hopeful",
      never_change: "Use only verified facts",
    });
    await assert.rejects(save(null, null, { tone: "Stale create" }));
    const first = await save(uid, null, { tone: "Calm" });
    let ctx = (await db.query("select public.ifund_story_context($1) r", [uid]))
      .rows[0].r;
    assert.equal(ctx.preferences.find((x) => x.key === "tone").value, "Calm");
    assert.equal(
      ctx.preferences.find((x) => x.key === "never_change").value,
      "Use only verified facts",
    );
    ctx = (await db.query("select public.ifund_story_context($1) r", [rid]))
      .rows[0].r;
    assert.equal(
      ctx.preferences.find((x) => x.key === "tone").value,
      "Hopeful",
    );
    const corrected = await save(uid, first.revision, { tone: "Direct" });
    assert.notEqual(corrected.revision, first.revision);
    await assert.rejects(
      save(uid, first.revision, { tone: "Stale overwrite" }),
    );
    await assert.rejects(save(null, global.revision, { role: "admin" }));
    await assert.rejects(
      save(null, global.revision, { tone: "Bearer abcdefghijklmnopqrstuvw" }),
    );
    await as(db, other);
    assert.deepEqual(
      (await db.query("select public.ifund_story_preferences(null) r")).rows[0]
        .r.preferences,
      {},
    );
    await db.query("select public.ifund_story_clear_preferences(null,true)");
    await as(db, uid);
    assert.equal(
      (await db.query("select public.ifund_story_preferences(null) r")).rows[0]
        .r.preferences.tone,
      "Hopeful",
    );
    await db.exec("reset role");
    await db.query(
      "delete from ifund_access.member_entitlements where owner_id=$1",
      [uid],
    );
    await db.exec("update ifund_story_runtime.control set enabled=false");
    await as(db, uid);
    await db.query("select public.ifund_story_clear_preferences(null,true)");
    await db.exec("reset role");
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from ifund_story_runtime.preferences where owner_id=$1",
          [uid],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("clear invalidates delayed first saves and campaign deletion is not blocked by a selection receipt", async () => {
  const db = await fixture();
  try {
    await db.query(
      "insert into public.ifund_campaigns(id,owner_id,title,status) values($1,$1,'Delete this draft','draft')",
      [uid],
    );
    await as(db, uid);
    const initial = (
      await db.query("select public.ifund_story_preferences(null) r")
    ).rows[0].r;
    assert.equal(initial.generation, 0);
    const cleared = (
      await db.query("select public.ifund_story_clear_preferences(null,true) r")
    ).rows[0].r;
    assert.equal(cleared.generation, 1);
    await assert.rejects(
      db.query("select public.ifund_story_save_preferences(null,null,$1,$2)", [
        { tone: "Delayed obsolete value" },
        initial.generation,
      ]),
    );
    await db.query(
      "select public.ifund_story_save_preferences(null,null,$1,$2)",
      [{ tone: "Fresh value" }, cleared.generation],
    );
    const claim = await begin(db);
    const suggestion = await finish(db, claim.lease);
    await db.query("select public.ifund_story_select($1,$2,$3,$4,0,0)", [
      rid,
      suggestion.id,
      suggestion.updated_at,
      uid,
    ]);
    await db.exec("reset role");
    await db.query(
      "delete from public.ifund_campaigns where id=$1 and owner_id=$1",
      [uid],
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from ifund_story_runtime.suggestion_choices",
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
