import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fixture, as } from "./fixtures/storyDatabase.js";
import { allServicePositions } from "../worker/services/catalog.js";

const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
const rid = "33333333-3333-4333-8333-333333333333",
  rid2 = "44444444-4444-4444-8444-444444444444",
  rid3 = "55555555-5555-4555-8555-555555555555";
const secret = "e".repeat(64),
  hash = "a".repeat(64),
  task = { details: "Our community needs school supplies.", section: null };
const result = {
  titles: ["A", "B", "C", "D", "E"],
  summaries: ["One summary", "Another summary"],
  story: "A true story",
  image_prompt: "Mission-specific image",
};
async function setup({ enabled = true, tested = true } = {}) {
  const db = await fixture();
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20261104055345_ifund_collective_workforce.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.equal(
    (await db.query("select count(*) n from ifund_ops.service_positions"))
      .rows[0].n,
    allServicePositions().length,
  );
  await db.query(
    "update ifund_ops.workforce_control set enabled=$1,free_plan_verified_until=now()+interval '1 day',free_plan_evidence='test free account',worker_secret_sha256=encode(sha256(convert_to($2,'UTF8')),'hex')",
    [enabled, secret],
  );
  await db.query(
    `insert into ifund_ops.workforce_implementations(id,revision,provider,adapter,model,available,tested,assigned_positions,capabilities,tested_capabilities,reservation_units,cost,evaluation)
    values('writer_v1','1','cloudflare','workers_ai','@cf/meta/llama-3.3-70b-instruct-fp8-fast',true,$1,'{story_agent}','{story.draft.v1,story.section.v1}','{story.draft.v1,story.section.v1}',1200,
    jsonb_build_object('verified',true,'additional_cost',0,'trial',false,'hard_stop',true,'evidence','official free terms','expires_at',now()+interval '1 day'),
    jsonb_build_object('passed',true,'revision','1','evidence','contract validation','expires_at',now()+interval '1 day'))`,
    [tested],
  );
  await actor(db, uid);
  return db;
}
async function actor(db, id, key = secret) {
  await as(db, id);
  await db.query("select set_config('request.headers',$1,false)", [
    JSON.stringify(key ? { "x-ifund-workforce-key": key } : {}),
  ]);
}
async function begin(db, id = rid, impl = "writer_v1", changes = {}) {
  const input = {
    hash,
    campaign: null,
    contract: "story.draft.v1",
    bytes: 4000,
    task,
    ...changes,
  };
  return (
    await db.query(
      "select public.ifund_workforce_begin($1,$2,$3,$4,$5,$6,$7) r",
      [
        id,
        input.hash,
        input.campaign,
        impl,
        input.contract,
        input.bytes,
        input.task,
      ],
    )
  ).rows[0].r;
}
async function start(db, id, lease) {
  return (
    await db.query("select public.ifund_workforce_started($1,$2) r", [
      id,
      lease,
    ])
  ).rows[0].r;
}
async function finish(
  db,
  id,
  lease,
  payload = result,
  outcome = payload ? "succeeded" : "unknown",
) {
  return (
    await db.query("select public.ifund_workforce_finish($1,$2,$3,$4) r", [
      id,
      lease,
      payload,
      outcome,
    ])
  ).rows[0].r;
}

test("dormant and untested implementations cannot dispatch or manufacture operational state", async () => {
  const db = await setup({ enabled: false });
  try {
    assert.equal((await begin(db)).state, "unavailable");
    await db.exec(
      "reset role; update ifund_ops.workforce_control set enabled=true; update ifund_ops.workforce_implementations set tested=false",
    );
    await actor(db, uid);
    assert.equal((await begin(db)).state, "queued");
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*) n from ifund_ops.workforce_assignments"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("server execution key, confirmed active member and owner permission are required independently", async () => {
  const db = await setup();
  try {
    for (const key of [null, "f".repeat(64)]) {
      await actor(db, uid, key);
      await assert.rejects(begin(db), /Verified executor required/);
      await assert.rejects(
        db.query("select public.ifund_workforce_snapshot()"),
        /Verified executor required/,
      );
    }
    await actor(db, null);
    await assert.rejects(begin(db), /Member access required/);
    await actor(db, uid);
    await assert.rejects(
      begin(db, rid, "writer_v1", { campaign: other }),
      /Owned campaign required/,
    );
    await db.exec("reset role");
    await db.query(
      "update public.ifund_profiles set account_status='suspended' where id=$1",
      [uid],
    );
    await actor(db, uid);
    await assert.rejects(begin(db), /Member access required/);
  } finally {
    await db.close();
  }
});

test("immutable identities, assignment history, model replacement and successful receipt replay", async () => {
  const db = await setup();
  try {
    const claim = await begin(db);
    assert.equal(claim.state, "claimed");
    assert.equal(await start(db, rid, claim.lease), true);
    await assert.rejects(start(db, rid, claim.lease), /already dispatched/);
    const receipt = await finish(db, rid, claim.lease);
    assert.equal(receipt.status, "draft");
    const replay = await begin(db);
    assert.equal(replay.state, "completed");
    assert.equal(replay.draft.id, receipt.id);
    assert.equal(
      (await begin(db, rid, "writer_v1", { hash: "b".repeat(64) })).state,
      "conflict",
    );
    assert.equal(
      (
        await begin(db, rid, "writer_v1", {
          task: { ...task, details: "Other details using same hash." },
        })
      ).state,
      "conflict",
    );
    await db.exec("reset role");
    await assert.rejects(
      db.exec(
        "update ifund_ops.service_positions set title='New Title' where id='story_agent'",
      ),
      /identity is immutable/,
    );
    await assert.rejects(
      db.exec("delete from ifund_ops.service_positions where id='story_agent'"),
      /cannot be deleted/,
    );
    await assert.rejects(
      db.exec(
        "update ifund_ops.workforce_implementations set model='different' where id='writer_v1'",
      ),
      /new implementation revision/,
    );
    const rows = (
      await db.query(
        "select a.position_id,a.implementation_revision,a.status,i.successful_runs from ifund_ops.workforce_assignments a join ifund_ops.workforce_implementations i on i.id=a.implementation_id",
      )
    ).rows;
    assert.deepEqual(rows, [
      {
        position_id: "story_agent",
        implementation_revision: "1",
        status: "succeeded",
        successful_runs: 1,
      },
    ]);
  } finally {
    await db.close();
  }
});

test("quota exhaustion queues once, preserves context, and resumes the same job after free capacity returns", async () => {
  const db = await setup();
  try {
    const first = await begin(db);
    await finish(db, rid, first.lease, null);
    const second = await begin(db, rid2);
    await finish(db, rid2, second.lease, null);
    const waiting = await begin(db, rid3);
    assert.equal(waiting.state, "queued");
    assert.equal((await begin(db, rid3)).state, "queued");
    const queue = (await db.query("select public.ifund_workforce_queued() r"))
      .rows[0].r;
    assert.equal(queue.length, 1);
    assert.deepEqual(queue[0].task, task);
    await db.exec(
      "reset role; update ifund_ops.workforce_assignments set assigned_at=now()-interval '1 day'; update ifund_ops.workflow_jobs set created_at=now()-interval '1 day' where status<>'paused'",
    );
    await actor(db, uid);
    const resumed = await begin(db, rid3);
    assert.equal(resumed.state, "claimed");
    await start(db, rid3, resumed.lease);
    await finish(db, rid3, resumed.lease);
    await db.exec("reset role");
    assert.equal(
      (
        await db.query(
          "select count(*) n from ifund_ops.workflow_jobs where source_event_id=$1",
          [uid + ":" + rid3],
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select count(*) n from ifund_ops.workflow_execution_log where event_type='capacity_wait'",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});

test("member cannot forge completions, steal leases, inspect private records or view another queue", async () => {
  const db = await setup();
  try {
    const claim = await begin(db);
    await actor(db, uid, null);
    await assert.rejects(
      finish(db, rid, claim.lease),
      /Verified executor required/,
    );
    await actor(db, other);
    await assert.rejects(finish(db, rid, claim.lease), /Invalid assignment/);
    await assert.rejects(
      db.query("select * from ifund_ops.workforce_assignments"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select public.ifund_workforce_admin_status()"),
      /Verified administrator required/,
    );
    await actor(db, uid);
    await begin(db, rid2, null);
    await actor(db, other);
    assert.deepEqual(
      (await db.query("select public.ifund_workforce_queued() r")).rows[0].r,
      [],
    );
  } finally {
    await db.close();
  }
});

test("expired leases and provider uncertainty cannot retry inference or refund consumed capacity", async () => {
  const db = await setup();
  try {
    const claim = await begin(db);
    await start(db, rid, claim.lease);
    await db.exec(
      "reset role; update ifund_ops.workflow_jobs set lease_until=now()-interval '1 second'",
    );
    await actor(db, uid);
    assert.equal((await begin(db)).state, "failed");
    await assert.rejects(
      finish(db, rid, claim.lease),
      /Invalid assignment|Invalid lease/,
    );
    await db.exec("reset role");
    assert.equal(
      (await db.query("select status from ifund_ops.workforce_assignments"))
        .rows[0].status,
      "unknown",
    );
    assert.equal(
      (
        await db.query(
          "select reserved_units from ifund_ops.workforce_capacity_days",
        )
      ).rows[0].reserved_units,
      1200,
    );
  } finally {
    await db.close();
  }
});

test("free cost/evaluation evidence and account attestation are rechecked atomically at assignment", async () => {
  const db = await setup();
  try {
    await db.exec(
      "reset role; update ifund_ops.workforce_implementations set cost=jsonb_set(cost,'{additional_cost}','1')",
    );
    await actor(db, uid);
    assert.equal((await begin(db)).state, "queued");
    await db.exec(
      "reset role; update ifund_ops.workforce_control set free_plan_verified_until=now()-interval '1 second'",
    );
    await actor(db, uid);
    assert.equal((await begin(db, rid2)).state, "unavailable");
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*) n from ifund_ops.workforce_assignments"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("queued private text can be erased only by its owner even after plan and execution expiry", async () => {
  const db = await setup();
  try {
    assert.equal((await begin(db, rid, null)).state, "queued");
    await actor(db, other, null);
    await assert.rejects(
      db.query("select public.ifund_workforce_cancel_queued($1)", [rid]),
      /Queued request unavailable/,
    );
    await db.exec(
      "reset role; update ifund_ops.workforce_control set enabled=false; update ifund_access.member_entitlements set verified_at=now()-interval '2 days',valid_until=now()-interval '1 day'",
    );
    await actor(db, uid, null);
    assert.equal(
      (await db.query("select public.ifund_workforce_queued() r")).rows[0].r
        .length,
      1,
    );
    const cancelled = (
      await db.query("select public.ifund_workforce_cancel_queued($1) r", [rid])
    ).rows[0].r;
    assert.equal(cancelled.status, "cancelled");
    await db.exec("reset role");
    const row = (
      await db.query("select status,payload from ifund_ops.workflow_jobs")
    ).rows[0];
    assert.equal(row.status, "cancelled");
    assert.equal(row.payload.task, undefined);
    assert.ok(row.payload.input_hash);
    assert.ok(row.payload.draft_id);
  } finally {
    await db.close();
  }
});

test("queued requests cannot disable the legacy path, while resumed assignments still consume its daily limit", async () => {
  const db = await setup();
  try {
    assert.equal((await begin(db, rid, null)).state, "queued");
    assert.equal((await begin(db, rid2, null)).state, "queued");
    const legacy = (
      await db.query("select public.ifund_story_begin($1,$2,null) r", [
        rid3,
        hash,
      ])
    ).rows[0].r;
    assert.equal(legacy.state, "claimed");
    await db.exec(
      "reset role; update ifund_ops.workflow_jobs set created_at=now()-interval '1 day' where status='paused'",
    );
    await actor(db, uid);
    assert.equal((await begin(db, rid)).state, "claimed");
    const limited = (
      await db.query("select public.ifund_story_begin($1,$2,null) r", [
        "66666666-6666-4666-8666-666666666666",
        hash,
      ])
    ).rows[0].r;
    assert.equal(limited.state, "limited");
  } finally {
    await db.close();
  }
});

test("erasing unexecuted queue requests does not consume inference capacity", async () => {
  const db = await setup();
  try {
    for (const id of [rid, rid2]) {
      assert.equal((await begin(db, id, null)).state, "queued");
      await db.query("select public.ifund_workforce_cancel_queued($1)", [id]);
    }
    assert.equal((await begin(db, rid3)).state, "claimed");
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*) n from ifund_ops.workforce_assignments"))
        .rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select reserved_units from ifund_ops.workforce_capacity_days",
        )
      ).rows[0].reserved_units,
      1200,
    );
  } finally {
    await db.close();
  }
});
